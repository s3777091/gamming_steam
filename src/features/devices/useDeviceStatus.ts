// Trạng thái nguồn PC, ĐẨY thay vì hỏi thăm.
//
// Jetson ping máy tính trên LAN rồi upsert `device_status` trong Supabase; hook
// này đọc hàng đó một lần rồi nghe thay đổi qua Realtime. Cố ý không có đường
// poll /api/wol/status dự phòng như bản jetson-phone cũ: không có tin mới thì
// trạng thái đứng nguyên, và khi tin quá cũ (Jetson mất kết nối) thì báo
// `unknown` — thà nói chưa rõ còn hơn lặp lời hỏi suốt.

import { useEffect, useState } from 'react';

import { realtimeChannelInstance, realtimeChannels } from '@/lib/realtime-channels';
import { createClient } from '@/lib/supabase';

export const HOME_PC_RESOURCE = 'home-pc';
const FRESH_MS = 70_000;

export type DevicePowerStage = 'offline' | 'signal_sent' | 'network' | 'ready' | 'unknown';

type Row = { online?: boolean; detail?: string; updated_at?: string };

function normalizeStage(value: unknown, online: boolean): DevicePowerStage {
  if (value === 'offline' || value === 'signal_sent' || value === 'network' || value === 'ready') return value;
  return online ? 'ready' : 'offline';
}

export type DeviceStatus = {
  /** null = chưa biết (chưa có tin hoặc tin đã cũ). */
  online: boolean | null;
  stage: DevicePowerStage;
  ready: boolean;
};

export function useDeviceStatus(resourceKey: string = HOME_PC_RESOURCE): DeviceStatus {
  const [row, setRow] = useState<{ online: boolean; stage: DevicePowerStage; at: number } | null>(null);
  const [fresh, setFresh] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setReady(true); return; }
    let active = true;
    const apply = (next: Row | null) => {
      if (!active || !next) return;
      const at = next.updated_at ? Date.parse(next.updated_at) : NaN;
      const online = Boolean(next.online);
      const stamp = Number.isFinite(at) ? at : Date.now();
      setRow({ online, stage: normalizeStage(next.detail, online), at: stamp });
      setFresh(Date.now() - stamp < FRESH_MS);
    };
    const channel = supabase
      .channel(realtimeChannelInstance(realtimeChannels.devicePresence(resourceKey)))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'device_status', filter: `resource_key=eq.${resourceKey}` },
        (payload) => apply(payload.new as Row),
      )
      .subscribe((state) => {
        if (state !== 'SUBSCRIBED') return;
        void supabase
          .from('device_status')
          .select('online,detail,updated_at')
          .eq('resource_key', resourceKey)
          .maybeSingle()
          .then(({ data }) => { apply(data as Row | null); if (active) setReady(true); });
      });
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [resourceKey]);

  // Một timeout đúng lúc tin hết hạn, không phải đồng hồ chạy mỗi vài giây.
  useEffect(() => {
    if (!row) return;
    const remaining = FRESH_MS - (Date.now() - row.at);
    if (remaining <= 0) { setFresh(false); return; }
    setFresh(true);
    const timer = setTimeout(() => setFresh(false), remaining);
    return () => clearTimeout(timer);
  }, [row]);

  if (!row || !fresh) return { online: null, stage: 'unknown', ready };
  return { online: row.online, stage: row.stage, ready };
}
