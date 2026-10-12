// Giữ màn loading che khung hình stream cho tới khi game thật sự lên — KHÔNG
// hỏi thăm (polling).
//
// Luồng: bấm Play -> PC bật booster ngay -> app nối stream -> stream lên thì báo
// `start` để PC mở game -> khi cửa sổ game đứng ở foreground (màn loading của
// chính game) PC báo `running` -> màn loading của app tan ra, người dùng đi thẳng
// vào màn loading của game, không thấy desktop Windows ở giữa.
//
// Mọi chuyển pha của PC đến app bằng SỰ KIỆN: game-booster.ps1 ghi từng pha lên
// bảng `pc_game_sessions` (Supabase) và app nghe qua Realtime. Một lần đọc ảnh
// chụp lúc đăng ký kênh để không lỡ pha xảy ra trước khi kênh mở. Không có vòng
// lặp nào ở đây; các timer chỉ là:
//   - đồng hồ chờ pha hết hạn (game không lên foreground sau X giây),
//   - dây an toàn khi PC chưa bắn sự kiện nào (agent cũ chưa cập nhật) — khi đó
//     đọc đúng MỘT lần REST rồi chấp nhận kết quả, không lặp lại.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import {
  boostHighlights,
  clearPendingGameLaunch,
  gameLaunchErrorMessage,
  gameLaunchStage,
  isTerminalGamePhase,
  COVER_SKIP_AFTER_MS,
  LAUNCH_REVEAL_AFTER_MS,
  STARTING_REVEAL_AFTER_MS,
  type GameBoostSummary,
  type GameSessionPhase,
  type GameSessionStatus,
  type PendingGameLaunch,
} from '@/lib/game-launch';
import { PC_ROUTES, pcFetch, pcPostJson } from '@/lib/pc-api';
import { realtimeChannelInstance } from '@/lib/realtime-channels';
import { createClient } from '@/lib/supabase';

/** Không có sự kiện nào trong chừng này thì đọc một lần REST (agent PC chưa đẩy sự kiện). */
const FIRST_EVENT_GRACE_MS = 12_000;
/** Ở chế độ dự phòng không có sự kiện `running`, nên chỉ còn cách tin khoảng chờ này sau khi đã báo start. */
const FALLBACK_REVEAL_AFTER_START_MS = 40_000;
const START_RETRY_DELAYS_MS = [1_500, 3_000, 6_000];

type Row = {
  id: string;
  game_id: string;
  title: string;
  phase: GameSessionPhase;
  timed_out: boolean | null;
  error: string | null;
  boost: GameBoostSummary | null;
};

function rowToStatus(row: Row): GameSessionStatus {
  return {
    id: row.id,
    gameId: row.game_id,
    title: row.title,
    phase: row.phase,
    timedOut: Boolean(row.timed_out),
    error: row.error,
    boost: row.boost ?? null,
  };
}

export type GameLaunchGate = {
  /** Giữ màn loading che stream đang sống. */
  covering: boolean;
  label: string;
  progress: number;
  highlights: string[];
  /** Thông điệp một lần khi màn loading tan mà game chưa hiện lên. */
  notice: string | null;
  /** Đang chạy bằng đọc dự phòng vì PC chưa đẩy sự kiện. */
  degraded: boolean;
  /** Màn loading đã che đủ lâu để cho người chơi tự tan nó. */
  skippable: boolean;
  /** Người chơi tự tan màn loading để thao tác trên desktop (launcher cần bấm "Enter Game"...). */
  skip: () => void;
};

type Snapshot = { status: GameSessionStatus; phaseSince: number };

export function useGameLaunchGate(launch: PendingGameLaunch | null, streamLive: boolean): GameLaunchGate {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [skippable, setSkippable] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const startSent = useRef(false);
  const startedAt = useRef<number | null>(null);
  const sessionId = launch?.sessionId ?? null;
  const done = !launch || revealed;

  const apply = useCallback((status: GameSessionStatus) => {
    setSnapshot((previous) => {
      const at = Date.now();
      return {
        status,
        phaseSince: previous && previous.status.phase === status.phase ? previous.phaseSince : at,
      };
    });
    setNow(Date.now());
  }, []);

  // Bàn giao chỉ dùng một lần: mở lại app hay một phiên thủ công sau đó phải ra desktop trơn.
  useEffect(() => {
    if (launch) clearPendingGameLaunch();
  }, [launch]);

  // Rời màn trước khi đã báo start thì huỷ phiên để PC trả cấu hình ngay.
  useEffect(() => {
    if (!sessionId) return;
    return () => {
      if (startSent.current) return;
      void pcPostJson(PC_ROUTES.gameSession, { id: sessionId, action: 'cancel' }, 'cancel').catch(() => {});
    };
  }, [sessionId]);

  // Nghe sự kiện pha của phiên chơi.
  useEffect(() => {
    if (!sessionId || done) return;
    const supabase = createClient();
    if (!supabase) return;
    let disposed = false;
    let channel: RealtimeChannel | null = null;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    let sawEvent = false;

    const handleRow = (row: Row | null | undefined) => {
      if (disposed || !row || row.id !== sessionId) return;
      sawEvent = true;
      clearTimeout(graceTimer);
      apply(rowToStatus(row));
    };

    const readSnapshot = async () => {
      const { data } = await supabase
        .from('pc_game_sessions')
        .select('id,game_id,title,phase,timed_out,error,boost')
        .eq('id', sessionId)
        .maybeSingle();
      handleRow(data as Row | null);
    };

    // Dây an toàn: PC chưa đẩy sự kiện nào -> hỏi agent đúng một lần.
    const fallbackOnce = async () => {
      if (disposed || sawEvent) return;
      setDegraded(true);
      try {
        const response = await pcFetch(PC_ROUTES.gameSession, { cache: 'no-store' });
        const body = await response.json().catch(() => null) as
          | { ok?: boolean; session?: GameSessionStatus | null }
          | null;
        if (disposed || sawEvent) return;
        const session = body?.ok ? body.session : null;
        if (!session || session.id !== sessionId) {
          setNotice('Chưa theo dõi được trò chơi trên máy tính.');
          setRevealed(true);
          return;
        }
        apply(session);
      } catch {
        if (disposed) return;
        setNotice('Chưa theo dõi được trò chơi trên máy tính.');
        setRevealed(true);
      }
    };

    channel = supabase
      .channel(realtimeChannelInstance(`jetsona:game-session:${sessionId}`))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pc_game_sessions', filter: `id=eq.${sessionId}` },
        (payload) => handleRow(payload.new as Row),
      )
      .subscribe((state) => {
        if (disposed) return;
        if (state === 'SUBSCRIBED') {
          void readSnapshot().catch(() => {});
          graceTimer = setTimeout(() => void fallbackOnce(), FIRST_EVENT_GRACE_MS);
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          void fallbackOnce();
        }
      });

    return () => {
      disposed = true;
      clearTimeout(graceTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [apply, done, sessionId]);

  const status = snapshot?.status ?? null;
  const phaseSinceMs = snapshot ? Math.max(0, now - snapshot.phaseSince) : 0;
  const stage = useMemo(
    () => gameLaunchStage(launch?.title ?? '', status, streamLive, phaseSinceMs),
    [launch?.title, phaseSinceMs, status, streamLive],
  );

  // Pha `launching`/`starting` hết hạn thì màn loading phải tự tan: hẹn ĐÚNG lúc
  // hết hạn rồi tính lại, không canh từng giây.
  useEffect(() => {
    if (done || !snapshot) return;
    const limit = snapshot.status.phase === 'launching'
      ? LAUNCH_REVEAL_AFTER_MS
      : snapshot.status.phase === 'starting'
        ? STARTING_REVEAL_AFTER_MS
        : null;
    if (limit === null) return;
    const remaining = limit - (Date.now() - snapshot.phaseSince);
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, remaining) + 40);
    return () => clearTimeout(timer);
  }, [done, snapshot]);

  // Báo `start` đúng một lần khi stream đã lên và PC đã tối ưu xong. Lỗi mạng thì thử lại vài nhịp ngắn.
  useEffect(() => {
    if (!sessionId || !stage.shouldStart || startSent.current) return;
    startSent.current = true;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const send = (attempt: number) => {
      void pcPostJson(PC_ROUTES.gameSession, { id: sessionId, action: 'start' }, 'start')
        .then(() => { startedAt.current = Date.now(); })
        .catch(() => {
          if (cancelled || attempt >= START_RETRY_DELAYS_MS.length) {
            if (!cancelled) startSent.current = false;
            return;
          }
          timers.push(setTimeout(() => send(attempt + 1), START_RETRY_DELAYS_MS[attempt]));
        });
    };
    send(0);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [sessionId, stage.shouldStart]);

  // Dự phòng không có sự kiện `running`: sau khi báo start, tin khoảng chờ một lần.
  useEffect(() => {
    if (done || !degraded || !startedAt.current) return;
    const timer = setTimeout(() => {
      setNotice('Trò chơi chưa hiện lên — kiểm tra màn hình máy tính.');
      setRevealed(true);
    }, FALLBACK_REVEAL_AFTER_START_MS);
    return () => clearTimeout(timer);
  }, [done, degraded, snapshot]);

  // Tan màn loading khi stream đã sống mà không còn lý do che.
  useEffect(() => {
    if (revealed || !launch || !streamLive || stage.covering) return;
    setRevealed(true);
    if (status?.phase === 'failed') setNotice(gameLaunchErrorMessage(status.error));
    else if (status?.timedOut || status?.phase === 'launching' || status?.phase === 'starting') {
      setNotice('Trò chơi chưa hiện lên — kiểm tra màn hình máy tính.');
    }
  }, [launch, revealed, stage.covering, status, streamLive]);

  // Phiên kết thúc/huỷ/hỏng trước khi stream lên: không còn gì để chờ.
  useEffect(() => {
    if (revealed || !status) return;
    if (isTerminalGamePhase(status.phase)) {
      if (status.phase === 'failed') setNotice(gameLaunchErrorMessage(status.error));
      if (streamLive) setRevealed(true);
    }
  }, [revealed, status, streamLive]);

  const coveringNow = Boolean(launch) && !revealed && stage.covering && streamLive;
  useEffect(() => {
    if (!coveringNow) { setSkippable(false); return; }
    const timer = setTimeout(() => setSkippable(true), COVER_SKIP_AFTER_MS);
    return () => clearTimeout(timer);
  }, [coveringNow]);

  const skip = useCallback(() => {
    setNotice(null);
    setRevealed(true);
  }, []);

  return {
    skip,
    skippable,
    covering: Boolean(launch) && !revealed && stage.covering,
    label: stage.label,
    progress: stage.progress,
    highlights: boostHighlights(status?.boost ?? null),
    notice,
    degraded,
  };
}
