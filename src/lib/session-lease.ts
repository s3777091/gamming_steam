// Hợp đồng setup-lease (P0). Thay claim_stream_session cũ bằng claim_stream_target_lease:
// mỗi lần mở stream sinh một setupToken UUID v4 mới, claim gắn token + generation,
// heartbeat/release đều mang theo token + generation để cleanup cũ KHÔNG BAO GIỜ
// giải phóng phiên kế cận (generation guard).
//
// RPC (SECURITY DEFINER) — chữ ký ĐÚNG THEO migration 202608040001. PostgREST
// phân giải hàm theo TÊN THAM SỐ, nên thừa một tham số là hỏng cả lời gọi với
// lỗi "Could not find the function ...":
//   claim_stream_target_lease(p_target_id, p_client_device_id, p_setup_token)
//     -> row stream_sessions (đọc id + setup_generation)
//   heartbeat_stream_session_lease(p_session_id, p_setup_token)
//     -> boolean (false = phiên đã thuộc thiết bị/token khác)
//   release_stream_session_lease(p_session_id, p_setup_token, p_reason)
//
// Generation KHÔNG phải tham số RPC: bản thân setup_token đã là chốt chặn (mỗi
// lần mở sinh token mới, claim tăng setup_generation lên và heartbeat của token
// cũ trả false). Cột setup_generation vẫn cần cho tầng HTTP bên dưới.
//
// HTTP (jetsona-ui, xác minh JWT qua apiFetch): /api/session/claim|beat|release,
// body mang đủ setupToken + setupGeneration + clientDeviceId — tầng này BẮT BUỘC
// có generation (server.mjs từ chối nếu thiếu hoặc < 1).
//
// Realtime: theo dõi row stream_sessions; state === 'released' => phiên đã kết thúc
// (bởi chủ khác hoặc server) -> onReleased.

import type { SupabaseClient } from '@supabase/supabase-js';

import { apiFetch } from '@/lib/api';
import { realtimeChannelInstance, realtimeChannels } from '@/lib/realtime-channels';
import { asSetupGeneration, isSafeSetupGeneration } from './setup-token';
import type { DeviceId } from './devices';

/** Một lease đã claim thành công; giữ token + generation để heartbeat/release. */
export type LeaseHandle = {
  sessionId: string;
  setupToken: string;
  generation: number;
};

export type ClaimLeaseResult = LeaseHandle;

/**
 * Claim lease cho target. Throw nếu RPC lỗi hoặc data.id / setup_generation không
 * an toàn (id rỗng hoặc generation < 1 / không nguyên). Target đang bận thì throw
 * error chứa 'target_in_use' để caller quyết định request-access hay retry.
 */
export async function claimLease(
  supabase: SupabaseClient,
  targetId: DeviceId,
  clientDeviceId: string,
  setupToken: string,
): Promise<ClaimLeaseResult> {
  const claim = await supabase.rpc('claim_stream_target_lease', {
    p_target_id: targetId,
    p_client_device_id: clientDeviceId,
    p_setup_token: setupToken,
  });
  if (claim.error) throw claim.error;
  const data = claim.data as { id?: unknown; setup_generation?: unknown } | null;
  const sessionId = data?.id;
  if (typeof sessionId !== 'string' || !sessionId) {
    throw new Error('claim_stream_target_lease không trả id phiên.');
  }
  const generation = asSetupGeneration(data?.setup_generation);
  if (generation === null) {
    throw new Error('setup_generation không hợp lệ (phải là số nguyên >= 1).');
  }
  return { sessionId, setupToken, generation };
}

/** Heartbeat RPC. False => phiên đã thuộc thiết bị khác (chuyển phiên). */
export async function heartbeatLeaseRpc(
  supabase: SupabaseClient,
  handle: LeaseHandle,
): Promise<boolean> {
  const result = await supabase.rpc('heartbeat_stream_session_lease', {
    p_session_id: handle.sessionId,
    p_setup_token: handle.setupToken,
  });
  if (result.error) throw result.error;
  return Boolean(result.data);
}

/** Release RPC. Generation guard: chỉ giải phóng đúng generation này. */
export async function releaseLeaseRpc(
  supabase: SupabaseClient,
  handle: LeaseHandle,
  reason: string,
): Promise<void> {
  await supabase.rpc('release_stream_session_lease', {
    p_session_id: handle.sessionId,
    p_setup_token: handle.setupToken,
    p_reason: reason,
  });
}

// ---- HTTP (jetsona-ui) ----

type SessionHttpBody = {
  hostId?: number;
  clientId: string;
  targetId: DeviceId;
  cloudSessionId: string;
  setupToken: string;
  setupGeneration: number;
  clientDeviceId: string;
  reason?: string;
};

function postSession(path: string, body: SessionHttpBody): Promise<Response> {
  return apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function postSessionClaim(
  target: { hostId: number },
  clientId: string,
  targetId: DeviceId,
  handle: LeaseHandle,
  clientDeviceId: string,
): Promise<{ ok: boolean; action?: string; error?: string }> {
  const response = await postSession('/api/session/claim', {
    hostId: target.hostId,
    clientId,
    targetId,
    cloudSessionId: handle.sessionId,
    setupToken: handle.setupToken,
    setupGeneration: handle.generation,
    clientDeviceId,
  });
  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; action?: string; error?: string }
    | null;
  return {
    ok: Boolean(data?.ok),
    action: data?.action,
    error: data?.error ?? (response.ok ? undefined : `HTTP ${response.status}`),
  };
}

/** 410 Gone => phiên đã chuyển thiết bị khác. */
export async function postSessionBeat(
  body: Omit<SessionHttpBody, 'hostId'>,
): Promise<number> {
  const response = await postSession('/api/session/beat', body);
  return response.status;
}

export async function postSessionRelease(
  body: Omit<SessionHttpBody, 'hostId'> & { reason: string },
): Promise<void> {
  await postSession('/api/session/release', body);
}

// ---- Realtime: state 'released' kết thúc phiên ----

/**
 * Theo dõi row stream_sessions; khi state chuyển sang 'released' (hoặc row bị xoá)
 * thì gọi onReleased. Trả về hàm huỷ theo dõi. Dùng instance suffix để Fast Refresh
 * /remount không dây vào channel đang unsubscribe.
 */
export function watchSessionReleased(
  supabase: SupabaseClient,
  sessionId: string,
  onReleased: () => void,
): () => void {
  let closed = false;
  const channel = supabase.channel(
    realtimeChannelInstance(realtimeChannels.sessionOwner(sessionId)),
    { config: { broadcast: { self: false } } },
  );
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'stream_sessions',
      filter: `id=eq.${sessionId}`,
    },
    (payload) => {
      if (closed) return;
      const newRow = (payload as { new?: { state?: unknown } | null }).new;
      const eventType = (payload as { eventType?: string }).eventType;
      if (eventType === 'DELETE' || newRow?.state === 'released') onReleased();
    },
  );
  channel.subscribe();
  return () => {
    closed = true;
    try {
      void supabase.removeChannel(channel);
    } catch {
      // channel có thể đã bị xoá.
    }
  };
}

export { isSafeSetupGeneration };