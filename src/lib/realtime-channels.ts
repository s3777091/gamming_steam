// Supabase multiplexes these topics over one Realtime WebSocket. Keep each
// responsibility in its own namespace so an access-request event can never be
// confused with session occupancy or the stream owner's session lifecycle.
//
// Port nguyên văn từ jetsona-ui/src/lib/realtime-channels.ts.

export const realtimeChannels = {
  accessOwnerInbox: (ownerId: string) => `jetsona:access:owner-inbox:${ownerId}`,
  accessRequesterResult: (requestId: string) => `jetsona:access:requester-result:${requestId}`,
  sessionOccupancy: 'jetsona:session:occupancy',
  sessionOwner: (sessionId: string) => `jetsona:session:owner:${sessionId}`,
  devicePresence: (resourceKey: string) => `jetsona:device:presence:${resourceKey}`,
  // P3 watch party: state (viewer list, control grant) tách khỏi party (broadcast
  // signaling/cursor/reaction) để một subscriber không phải lọc hàng nghìn event
  // của cái kia.
  watchRoomState: (sessionId: string) => `jetsona:watch:state:${sessionId}`,
  watchParty: (sessionId: string) => `jetsona:watch:party:${sessionId}`,
} as const;

/**
 * Supabase keeps a channel object alive briefly while an async unsubscribe is
 * finishing. A fresh instance suffix prevents Fast Refresh or a quick remount
 * from attaching callbacks to that already-subscribed object.
 */
export function realtimeChannelInstance(topic: string): string {
  return `${topic}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}
