import {
  MediaStream,
  MediaStreamTrack,
  RTCPeerConnection,
  RTCRtpReceiver,
  RTCSessionDescription,
} from 'react-native-webrtc';

import { apiFetch } from '@/lib/api';
import {
  decodeControllerMessage, encodeControllerAdd, encodeControllerRemove, encodeControllerState,
  type ControllerState,
} from '@/lib/controller-protocol';
import { getBackendBaseUrl } from '@/lib/config';
import type { DeviceId } from '@/lib/devices';
import { buildRtcIceConfig } from '@/lib/ice-config';
import type { IceMode, MoonlightSettings } from '@/lib/stream-settings';
import { optimizeSdpForUltraSmooth } from '@/lib/stream-sdp';

type RTCDataChannel = ReturnType<RTCPeerConnection['createDataChannel']>;
type NativeWebSocketConstructor = new (
  uri: string,
  protocols?: string | string[] | null,
  options?: { headers: Record<string, string> },
) => WebSocket;

type MoonlightTarget = {
  hostId: number;
  appId: number;
};

type NativeStreamCallbacks = {
  onStatus: (message: string) => void;
  onStream: (url: string) => void;
  onReady: (dimensions: { width: number; height: number } | null) => void;
  onVideoDimensions: (dimensions: { width: number; height: number }) => void;
  onInputReady: () => void;
  onAudioReady: () => void;
  onError: (message: string) => void;
  /**
   * Đường mạng rớt SAU KHI stream đã lên (Wi-Fi chập chờn, signaling qua backend
   * đứt). Client đã tự dừng; phía gọi nên nối lại thay vì báo lỗi. Thiếu callback
   * này thì rơi về onError như cũ.
   */
  onDropped?: (message: string) => void;
  /** The host intentionally ended the session (including physical PC takeover). */
  onTerminated: () => void;
  /** PC báo rung cho một tay cầm (slot do app đặt khi add). Giá trị 0..1. */
  onRumble?: (rumble: { slot: number; low: number; high: number; triggerLeft?: number; triggerRight?: number }) => void;
};

type WebRtcDescription = {
  Description: {
    ty: string;
    sdp: string;
  };
};

type WebRtcCandidate = {
  AddIceCandidate: {
    candidate: string;
    sdp_mid?: string | null;
    sdp_mline_index?: number | null;
    username_fragment?: string | null;
  };
};

type WebRtcSignal = WebRtcDescription | WebRtcCandidate;

/** Lệnh pointer co-control từ viewer, host route vào kênh input của mình. */
export type CoControlPointerInput = {
  type: 'move' | 'down' | 'up' | 'wheel';
  x?: number;
  y?: number;
  button?: keyof typeof MOUSE_BUTTON | number;
  deltaX?: number;
  deltaY?: number;
};

type ControlMessage = {
  Setup?: { ice_servers?: { urls?: string | string[]; username?: string; credential?: string }[] };
  WebRtc?: WebRtcSignal;
  DebugLog?: { message?: string; ty?: string };
  ConnectionComplete?: {
    width?: number;
    height?: number;
  };
  ConnectionTerminated?: { error_code?: number | string };
};

const CHANNEL = {
  GENERAL: 'GENERAL',
  MOUSE_RELIABLE: 'MOUSE_RELIABLE',
  MOUSE_ABSOLUTE: 'MOUSE_ABSOLUTE',
  MOUSE_RELATIVE: 'MOUSE_RELATIVE',
  KEYBOARD: 'KEYBOARD',
  CONTROLLERS: 'CONTROLLERS',
  RTT: 'RTT',
} as const;

/** Mỗi tay cầm một kênh riêng: CONTROLLER0..CONTROLLER15 (không có thứ tự, không bảo đảm). */
const controllerChannel = (slot: number) => `CONTROLLER${slot}`;

const MOUSE_BUTTON = {
  LEFT: 1,
  MIDDLE: 2,
  RIGHT: 3,
} as const;

const H264_CODEC_MASK = 1;
const HEVC_CODEC_MASK = 2;
const AV1_CODEC_MASK = 8;
const AUDIO_SAMPLE_QUEUE_SIZE = 20;
const WEBRTC_CONNECT_TIMEOUT_MS = 45_000;
/** Cho ICE tự hồi sau `disconnected` chừng này trước khi coi là rớt. */
const DISCONNECT_GRACE_MS = 15_000;
const INPUT_CHANNELS = [
  CHANNEL.MOUSE_RELIABLE,
  CHANNEL.MOUSE_ABSOLUTE,
  CHANNEL.MOUSE_RELATIVE,
  CHANNEL.KEYBOARD,
  // Controller registration must reach the host before any state packet on
  // CONTROLLER0..15. Data channels can open in any order, so treating input as
  // ready before this channel opens can make the host drop the gamepad entirely.
  CHANNEL.CONTROLLERS,
  controllerChannel(0),
] as const;

function prefixFor(targetId: DeviceId): '/pc' | '/vm' {
  return targetId === 'vm' ? '/vm' : '/pc';
}

type VideoCodecCapability = { h264: boolean; hevc: boolean; av1: boolean };

/**
 * Khảo sát năng lực giải mã của react-native-webrtc qua RTCRtpReceiver.getCapabilities.
 * P1 yêu cầu "audit trước khi đổi" NativeMoonlightClient (đang ghim H.264 + hdr:false).
 * H264 luôn được giả định có (fallback an toàn); hevc/av1 chỉ bật khi capability báo.
 */
function auditVideoCodecCapability(): VideoCodecCapability {
  let h264 = true;
  let hevc = false;
  let av1 = false;
  try {
    const caps = (RTCRtpReceiver as unknown as {
      getCapabilities?: (kind: string) => { codecs?: { mimeType?: string }[] } | null;
    }).getCapabilities?.('video');
    const codecs = caps?.codecs ?? [];
    const names = codecs.map((codec) => (codec.mimeType ?? '').toLowerCase());
    if (names.length) h264 = names.some((name) => name.includes('h264')) || h264;
    hevc = names.some((name) => name.includes('h265') || name.includes('hevc'));
    av1 = names.some((name) => name.includes('av01') || name.includes('av1'));
  } catch {
    // older native layer không expose getCapabilities -> giữ fallback H264.
  }
  return { h264, hevc, av1 };
}

type CodecPlan = { supportedCodecsMask: number; hdr: boolean };

/**
 * Chọn mask codec + hdr cho StartStream từ preference ( MoonlightSettings.videoCodec:
 * 'auto'|'av1'|'h265'|'h264' ) và năng lực thiết bị. HDR chỉ bật cùng codec 10-bit
 * (hevc/av1) và khi user bật 'on'. 'auto' giữ H264 an toàn (server chọn h264) trừ
 * khi thiết bị rõ ràng báo hevc/av1.
 *
 * Mask bit: H264=1, HEVC=2, AV1=8 (theo moonlight common). Cần xác nhận lại với
 * phiên moonlight-web đang deploy ở lần test thiết bị đầu tiên.
 */
function resolveCodecPlan(
  codecPref: MoonlightSettings['videoCodec'],
  hdrOn: boolean,
  capability: VideoCodecCapability,
): CodecPlan {
  const base: CodecPlan = { supportedCodecsMask: H264_CODEC_MASK, hdr: false };
  if (codecPref === 'h264') return base;
  if (codecPref === 'h265') {
    if (!capability.hevc) return base;
    return { supportedCodecsMask: H264_CODEC_MASK | HEVC_CODEC_MASK, hdr: hdrOn };
  }
  if (codecPref === 'av1') {
    if (capability.av1) return { supportedCodecsMask: H264_CODEC_MASK | AV1_CODEC_MASK, hdr: hdrOn };
    if (capability.hevc) return { supportedCodecsMask: H264_CODEC_MASK | HEVC_CODEC_MASK, hdr: hdrOn };
    return base;
  }
  // auto
  let mask = H264_CODEC_MASK;
  if (capability.hevc) mask |= HEVC_CODEC_MASK;
  if (capability.av1) mask |= AV1_CODEC_MASK;
  const hdr = hdrOn && (capability.hevc || capability.av1);
  return { supportedCodecsMask: mask, hdr };
}

function appFor(targetId: DeviceId): { title: string; strict: boolean } {
  return targetId === 'steam'
    ? { title: 'Steam Big Picture', strict: true }
    : { title: 'Desktop', strict: false };
}

function controlSocketUrl(targetId: DeviceId): string {
  const url = new URL(`${getBackendBaseUrl().replace(/\/+$/, '')}${prefixFor(targetId)}/api/host/stream`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function packet(length: number, write: (view: DataView) => void): Uint8Array {
  const bytes = new Uint8Array(length);
  write(new DataView(bytes.buffer));
  return bytes;
}

function encodeUtf8(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x7f) {
      bytes.push(code);
    } else if (code <= 0x7ff) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code <= 0xffff) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return Uint8Array.from(bytes);
}

function messageFromUnknown(value: unknown): string {
  if (value instanceof Error) return value.message;
  return typeof value === 'string' ? value : 'Kết nối WebRTC thất bại.';
}

/**
 * Tìm đúng host/app từ Moonlight-Web. Endpoint /hosts trả NDJSON; snapshot ở
 * dòng đầu là đủ để lấy host đã pair, đúng như client web hiện tại.
 */
export async function fetchMoonlightTarget(targetId: DeviceId): Promise<MoonlightTarget> {
  const prefix = prefixFor(targetId);
  const hostsResponse = await apiFetch(`${prefix}/api/hosts`);
  if (!hostsResponse.ok) throw new Error(`Không đọc được host (${hostsResponse.status}).`);
  const firstLine = (await hostsResponse.text())
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0);
  const host = firstLine
    ? (JSON.parse(firstLine) as { hosts?: { host_id?: number }[] }).hosts?.[0]
    : null;
  if (!host?.host_id) throw new Error('Không tìm thấy host Moonlight đã ghép đôi.');

  const appsResponse = await apiFetch(`${prefix}/api/apps?host_id=${host.host_id}`);
  if (!appsResponse.ok) throw new Error(`Không đọc được ứng dụng stream (${appsResponse.status}).`);
  const apps = ((await appsResponse.json()) as {
    apps?: { app_id: number; title: string }[];
  }).apps ?? [];
  const wanted = appFor(targetId);
  const app = apps.find((item) => item.title === wanted.title) ?? (wanted.strict ? undefined : apps[0]);
  if (!app) throw new Error(`Không tìm thấy ứng dụng “${wanted.title}” trên Sunshine.`);
  return { hostId: host.host_id, appId: app.app_id };
}

/**
 * Client native cho protocol signaling của Moonlight-Web.
 *
 * WebSocket này chỉ mang JSON signaling/control. Video, audio và input được
 * nhận/gửi trên RTCPeerConnection và các RTCDataChannel do streamer tạo.
 */
export class NativeMoonlightClient {
  private readonly targetId: DeviceId;
  private readonly target: MoonlightTarget;
  private readonly token: string;
  private readonly settings: MoonlightSettings;
  private readonly iceMode: IceMode;
  private readonly codecPlan: CodecPlan;
  private audioMuted: boolean;
  private audioVolume: number;
  private readonly callbacks: NativeStreamCallbacks;

  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private stopped = false;
  private ready = false;
  private connected = false;
  private remoteStream: MediaStream | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly channels = new Map<string, RTCDataChannel>();
  private readonly pendingPackets = new Map<string, Uint8Array[]>();
  private readonly pendingCandidates: WebRtcCandidate['AddIceCandidate'][] = [];
  private inputReady = false;
  // P3 watch party: giữ track inbound để host re-broadcast cho viewer mà không
  // phải re-encode canvas hay stop track gốc.
  private remoteVideoTrack: MediaStreamTrack | null = null;
  private remoteAudioTrack: MediaStreamTrack | null = null;

  constructor(
    targetId: DeviceId,
    target: MoonlightTarget,
    token: string,
    settings: MoonlightSettings,
    audio: { muted: boolean; volume: number },
    callbacks: NativeStreamCallbacks,
    iceMode: IceMode = 'direct',
  ) {
    this.targetId = targetId;
    this.target = target;
    this.token = token;
    this.settings = settings;
    this.iceMode = iceMode;
    this.codecPlan = resolveCodecPlan(settings.videoCodec, settings.hdr, auditVideoCodecCapability());
    this.audioMuted = audio.muted;
    this.audioVolume = audio.volume;
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.ws || this.stopped) return;
    this.callbacks.onStatus('Đang mở kênh điều phối…');
    const WebSocketWithHeaders = WebSocket as unknown as NativeWebSocketConstructor;
    const ws = new WebSocketWithHeaders(controlSocketUrl(this.targetId), [], {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    this.ws = ws;
    ws.onopen = () => {
      if (this.stopped || this.ws !== ws) return;
      this.callbacks.onStatus('Đang chuẩn bị WebRTC trực tiếp…');
      this.sendControl({
        Init: {
          host_id: this.target.hostId,
          app_id: this.target.appId,
          video_frame_queue_size: this.settings.videoFrameQueueSize,
          audio_sample_queue_size: AUDIO_SAMPLE_QUEUE_SIZE,
        },
      });
    };
    ws.onmessage = (event) => {
      if (this.stopped || this.ws !== ws || typeof event.data !== 'string') return;
      try {
        void this.handleControl(JSON.parse(event.data) as ControlMessage);
      } catch (error) {
        this.fail(messageFromUnknown(error));
      }
    };
    ws.onerror = () => {
      if (this.stopped || this.ws !== ws) return;
      if (this.ready) this.drop('Kênh signaling Moonlight bị gián đoạn.');
      else this.fail('Không mở được kênh signaling Moonlight.');
    };
    ws.onclose = (event) => {
      if (this.stopped || this.ws !== ws) return;
      if (this.ready) this.drop(event.reason || 'Kênh signaling Moonlight đã đóng.');
      else this.fail(event.reason || 'Kênh signaling Moonlight đã đóng.');
    };
    this.connectTimer = setTimeout(() => {
      if (!this.ready && !this.stopped) this.fail('Kết nối WebRTC quá thời gian chờ.');
    }, WEBRTC_CONNECT_TIMEOUT_MS);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.connectTimer) clearTimeout(this.connectTimer);
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    this.connectTimer = null;
    this.disconnectTimer = null;
    this.channels.forEach((channel) => {
      try {
        channel.close();
      } catch {
        // Peer close phía dưới vẫn thu hồi channel.
      }
    });
    this.channels.clear();
    this.pendingPackets.clear();
    try {
      this.pc?.close();
    } catch {
      // Đã đóng từ native.
    }
    this.pc = null;
    try {
      this.ws?.close();
    } catch {
      // Đã đóng từ native.
    }
    this.ws = null;
    this.remoteStream?.release(false);
    this.remoteStream = null;
    this.remoteVideoTrack = null;
    this.remoteAudioTrack = null;
  }

  // ---- P3 watch party: host re-broadcast inbound tracks (không re-encode, không
  // stop track gốc) và nhận input co-control từ viewer. ----

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  getRemoteVideoTrack(): MediaStreamTrack | null {
    return this.remoteVideoTrack;
  }

  getRemoteAudioTrack(): MediaStreamTrack | null {
    return this.remoteAudioTrack;
  }

  isInputReady(): boolean {
    return this.inputReady;
  }

  /** Timed mapping actions must never enter the pre-connection packet queue. */
  isPointerInputReady(): boolean {
    return !this.stopped && this.inputReady && this.channels.get(CHANNEL.MOUSE_RELIABLE)?.readyState === 'open';
  }

  setAudio(audio: { muted?: boolean; volume?: number }): void {
    if (typeof audio.muted === 'boolean') {
      this.audioMuted = audio.muted;
      if (this.remoteAudioTrack) {
        this.remoteAudioTrack.enabled = !audio.muted;
      }
    }
    if (typeof audio.volume === 'number') {
      this.audioVolume = audio.volume;
      const gain = Math.min(1, Math.max(0, audio.volume / 100));
      (this.remoteAudioTrack as { _setVolume?: (vol: number) => void } | null)?._setVolume?.(gain);
    }
  }

  /**
   * Toast một lệnh pointer co-control từ viewer vào kênh input của host. Host giữ
   * quyền điều khiển; viewer được approve thì input của nó đi qua đây. Tọa độ (x,y)
   * đã chuẩn hoá về [0,1] trên khung stream.
   */
  routeCoControlPointer(input: CoControlPointerInput): void {
    switch (input.type) {
      case 'move':
        if (input.x != null && input.y != null) this.sendMousePosition(input.x, input.y, true);
        break;
      case 'down':
        this.sendMouseButton(true, input.button ?? NativeMouseButton.LEFT);
        break;
      case 'up':
        this.sendMouseButton(false, input.button ?? NativeMouseButton.LEFT);
        break;
      case 'wheel':
        this.sendScroll(input.deltaX ?? 0, input.deltaY ?? 0);
        break;
    }
  }

  sendMousePosition(x: number, y: number, reliable = false): void {
    const px = clampInteger(x * 4096, 0, 4096);
    const py = clampInteger(y * 4096, 0, 4096);
    const data = packet(9, (view) => {
      view.setUint8(0, 1);
      view.setInt16(1, px);
      view.setInt16(3, py);
      view.setInt16(5, 4096);
      view.setInt16(7, 4096);
    });
    this.sendChannel(reliable ? CHANNEL.MOUSE_RELIABLE : CHANNEL.MOUSE_ABSOLUTE, data);
  }

  sendMouseMove(dx: number, dy: number): void {
    const data = packet(5, (view) => {
      view.setUint8(0, 0);
      view.setInt16(1, clampInteger(dx, -32768, 32767));
      view.setInt16(3, clampInteger(dy, -32768, 32767));
    });
    this.sendChannel(CHANNEL.MOUSE_RELATIVE, data);
  }

  sendMouseButton(down: boolean, button: keyof typeof MOUSE_BUTTON | number): void {
    const resolved = typeof button === 'number' ? button : MOUSE_BUTTON[button];
    const data = packet(3, (view) => {
      view.setUint8(0, 2);
      view.setUint8(1, down ? 1 : 0);
      view.setUint8(2, resolved);
    });
    this.sendChannel(CHANNEL.MOUSE_RELIABLE, data);
  }

  sendScroll(deltaX: number, deltaY: number): void {
    const data = packet(5, (view) => {
      view.setUint8(0, 3);
      view.setInt16(1, clampInteger(deltaX, -32768, 32767));
      view.setInt16(3, clampInteger(deltaY, -32768, 32767));
    });
    this.sendChannel(CHANNEL.MOUSE_RELATIVE, data);
  }

  sendKey(down: boolean, virtualKey: number, modifiers = 0): void {
    const data = packet(5, (view) => {
      view.setUint8(0, 0);
      view.setUint8(1, down ? 1 : 0);
      view.setUint8(2, modifiers);
      view.setUint16(3, clampInteger(virtualKey, 0, 65535));
    });
    this.sendChannel(CHANNEL.KEYBOARD, data);
  }

  /**
   * Khai báo một tay cầm với PC (kênh CONTROLLERS). supportedButtons là bitmask
   * cờ nút Moonlight; capabilities bit 0 = rung, bit 1 = rung cò.
   */
  sendControllerAdd(slot: number, supportedButtons: number, capabilities: number): void {
    this.sendChannel(CHANNEL.CONTROLLERS, encodeControllerAdd(slot, supportedButtons, capabilities));
  }

  sendControllerRemove(slot: number): void {
    this.sendChannel(CHANNEL.CONTROLLERS, encodeControllerRemove(slot));
  }

  /**
   * Trạng thái một tay cầm. Cờ nút theo Moonlight; cò 0..1; cần -1..1 theo quy
   * ước Gamepad API (lên là âm) — Y được đảo dấu ở đây đúng như client web.
   */
  sendControllerState(slot: number, state: ControllerState): void {
    this.sendChannel(controllerChannel(slot), encodeControllerState(state), 4);
  }

  /** Số liệu WebRTC cho HUD (RTT, jitter, bitrate, khung rớt, loại đường). */
  async getStats(): Promise<Record<string, unknown>[]> {
    const pc = this.pc;
    if (!pc) return [];
    try {
      const report = await pc.getStats();
      const rows: Record<string, unknown>[] = [];
      report.forEach((value: unknown) => rows.push(value as Record<string, unknown>));
      return rows;
    } catch {
      return [];
    }
  }

  sendText(text: string): void {
    if (!text) return;
    const encoded = encodeUtf8(text);
    for (let offset = 0; offset < encoded.length; offset += 255) {
      const slice = encoded.slice(offset, offset + 255);
      const data = new Uint8Array(slice.length + 2);
      data[0] = 1;
      data[1] = slice.length;
      data.set(slice, 2);
      this.sendChannel(CHANNEL.KEYBOARD, data);
    }
  }

  private sendControl(message: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private async handleControl(message: ControlMessage): Promise<void> {
    if (this.stopped) return;
    if (message.DebugLog?.message) {
      const detail = message.DebugLog.message;
      if (/permission/i.test(detail)) this.callbacks.onStatus('Đã xác nhận quyền truy cập…');
      else if (/starting stream/i.test(detail)) this.callbacks.onStatus('Đang khởi động hình ảnh…');
      else if (/connection complete/i.test(detail)) this.callbacks.onStatus('Đang chờ khung hình đầu tiên…');
      if (/fatal|error/i.test(message.DebugLog.ty ?? '') && !/web socket open/i.test(detail)) {
        this.fail(detail);
      }
      return;
    }

    if (message.Setup) {
      await this.startPeer(message.Setup.ice_servers ?? []);
      return;
    }

    if (message.WebRtc) {
      await this.handleWebRtcSignal(message.WebRtc);
      return;
    }

    if (message.ConnectionComplete) {
      this.ready = true;
      if (this.connectTimer) clearTimeout(this.connectTimer);
      this.connectTimer = null;
      const width = Number(message.ConnectionComplete.width);
      const height = Number(message.ConnectionComplete.height);
      this.callbacks.onReady(
        Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
          ? { width, height }
          : null,
      );
      return;
    }

    if (message.ConnectionTerminated) {
      const code = message.ConnectionTerminated.error_code;
      if (code === 0 || code === '0') {
        this.stop();
        this.callbacks.onTerminated();
        return;
      }
      this.fail(`Sunshine đã kết thúc phiên (${message.ConnectionTerminated.error_code ?? 'không rõ mã'}).`);
    }
  }

  private async startPeer(
    iceServers: { urls?: string | string[]; username?: string; credential?: string }[],
  ): Promise<void> {
    if (this.pc || this.stopped) return;
    this.sendControl({ SetTransport: 'WebRTC' });
    // P1: áp ice_mode lên peer thật. auto -> Setup.ice_servers nguyên vẹn;
    // direct -> lọc turn:/turns:; relay -> giữ servers + iceTransportPolicy 'relay'.
    const ice = buildRtcIceConfig(this.iceMode, iceServers);
    const pc = new RTCPeerConnection({
      bundlePolicy: 'max-bundle',
      iceServers: ice.iceServers,
      ...(ice.iceTransportPolicy ? { iceTransportPolicy: ice.iceTransportPolicy } : {}),
    });
    this.pc = pc;

    pc.onicecandidate = (event: unknown) => {
      const candidate = (event as unknown as {
        candidate: {
          toJSON: () => {
            candidate: string;
            sdpMid?: string | null;
            sdpMLineIndex?: number | null;
          };
        } | null;
      }).candidate;
      if (!candidate) return;
      const json = candidate.toJSON();
      this.sendControl({
        WebRtc: {
          AddIceCandidate: {
            candidate: json.candidate,
            sdp_mid: json.sdpMid ?? null,
            sdp_mline_index: json.sdpMLineIndex ?? null,
            username_fragment: null,
          },
        },
      });
    };

    pc.ontrack = (event: unknown) => {
      const trackEvent = event as unknown as {
        streams?: MediaStream[];
        track?: {
          kind?: string;
          enabled: boolean;
          _setVolume?: (volume: number) => void;
          getSettings?: () => { width?: number; height?: number };
        } | null;
      };
      const track = trackEvent.track;
      let stream = trackEvent.streams?.[0] ?? null;
      if (!stream && track) {
        this.remoteStream ??= new MediaStream();
        this.remoteStream.addTrack(track as never);
        stream = this.remoteStream;
      } else if (stream) {
        this.remoteStream = stream;
      }
      if (track?.kind === 'audio') {
        track.enabled = !this.audioMuted;
        track._setVolume?.(Math.min(1, Math.max(0, this.audioVolume / 100)));
        this.remoteAudioTrack = (track as unknown as MediaStreamTrack) ?? null;
        this.callbacks.onAudioReady();
      }
      if (stream && track?.kind === 'video') {
        this.remoteVideoTrack = (track as unknown as MediaStreamTrack) ?? null;
        this.applyPlayoutPacing();
        const dimensions = track.getSettings?.();
        if (
          dimensions
          && Number(dimensions.width) > 0
          && Number(dimensions.height) > 0
        ) {
          this.callbacks.onVideoDimensions({
            width: Number(dimensions.width),
            height: Number(dimensions.height),
          });
        }
        this.callbacks.onStream(stream.toURL());
      }
    };

    pc.ondatachannel = (event: unknown) => {
      const channel = (event as unknown as { channel: RTCDataChannel }).channel;
      const key = channel.label.toUpperCase();
      channel.binaryType = 'arraybuffer';
      this.channels.set(key, channel);
      const opened = () => {
        if (this.stopped || this.channels.get(key) !== channel) return;
        this.flushChannel(key, channel);
        this.checkInputReady();
      };
      channel.onopen = opened;
      if (channel.readyState === 'open') opened();
      if (key === CHANNEL.CONTROLLERS) {
        channel.onmessage = (messageEvent: unknown) => {
          const data = (messageEvent as { data?: unknown }).data;
          if (data instanceof ArrayBuffer) this.handleControllerMessage(data);
        };
      }
      if (key === CHANNEL.RTT) {
        channel.onmessage = (messageEvent: unknown) => {
          const data = (messageEvent as { data?: unknown }).data;
          if (channel.readyState === 'open' && data instanceof ArrayBuffer) {
            channel.send(data);
          }
        };
      }
    };

    pc.onconnectionstatechange = () => {
      if (this.stopped || this.pc !== pc) return;
      if (pc.connectionState === 'connected') {
        this.connected = true;
        if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
        this.disconnectTimer = null;
        this.callbacks.onStatus('WebRTC trực tiếp đã kết nối…');
      } else if (pc.connectionState === 'disconnected') {
        // `disconnected` chỉ là vài nhịp consent STUN bị lỡ (Wi-Fi chuyển kênh,
        // máy PC khựng lúc mở game) và libwebrtc thường tự hồi lại; cắt sớm là
        // giết một phiên còn cứu được.
        if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
        this.disconnectTimer = setTimeout(() => {
          if (!this.stopped && pc.connectionState === 'disconnected') {
            this.drop('Kết nối WebRTC trực tiếp đã bị gián đoạn.');
          }
        }, DISCONNECT_GRACE_MS);
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        if (this.connected) this.drop('Kết nối WebRTC trực tiếp đã mất.');
        else this.fail('Không thiết lập được đường WebRTC trực tiếp.');
      }
    };

    this.callbacks.onStatus('Đang thương lượng WebRTC/UDP…');
    this.sendControl({
      StartStream: {
        settings: {
          bitrate_kbps: this.settings.bitrate,
          fps: this.settings.fps,
          width: this.settings.videoSizeCustom.width,
          height: this.settings.videoSizeCustom.height,
          play_audio_local: false,
          supported_codecs: this.codecPlan.supportedCodecsMask,
          hdr: this.codecPlan.hdr,
        },
      },
    });
  }

  private applyPlayoutPacing(): void {
    if (!this.pc) return;
    try {
      const receivers = this.pc.getReceivers?.() ?? [];
      // Đệm đúng 1 khung hình (8ms ở 120fps, 16ms ở 60fps) làm bộ giảm xóc triệt tiêu micro-stutter
      const delaySeconds = this.settings.fps >= 120 ? 0.008 : 0.016;
      for (const rx of receivers) {
        const receiver = rx as unknown as {
          playoutDelayHint?: number;
          track?: { kind?: string };
          _track?: { kind?: string };
        };
        const kind = receiver.track?.kind ?? receiver._track?.kind;
        if (kind === 'video' && 'playoutDelayHint' in receiver) {
          receiver.playoutDelayHint = delaySeconds;
        }
      }
    } catch {
      // Bỏ qua nếu native layer không hỗ trợ playoutDelayHint
    }
  }

  private async handleWebRtcSignal(message: WebRtcSignal): Promise<void> {
    if ('Description' in message) {
      const pc = this.pc;
      if (!pc) return;
      const remote = new RTCSessionDescription({
        type: message.Description.ty,
        sdp: message.Description.sdp,
      });
      await pc.setRemoteDescription(remote);
      if (message.Description.ty === 'offer') {
        const answer = await pc.createAnswer();
        const optimizedSdp = optimizeSdpForUltraSmooth(answer.sdp, {
          bitrateKbps: this.settings.bitrate,
          fps: this.settings.fps,
        });
        const tunedAnswer = new RTCSessionDescription({
          type: answer.type,
          sdp: optimizedSdp,
        });
        await pc.setLocalDescription(tunedAnswer);
        const local = pc.localDescription ?? tunedAnswer;
        if (!local) throw new Error('Không tạo được SDP answer.');
        this.sendControl({
          WebRtc: {
            Description: {
              ty: local.type,
              sdp: optimizedSdp,
            },
          },
        });
        this.applyPlayoutPacing();
      }
      await this.flushPendingCandidates();
      return;
    }

    if ('AddIceCandidate' in message) {
      if (!this.pc?.remoteDescription) {
        this.pendingCandidates.push(message.AddIceCandidate);
        return;
      }
      await this.addRemoteCandidate(message.AddIceCandidate);
    }
  }

  private async addRemoteCandidate(candidate: WebRtcCandidate['AddIceCandidate']): Promise<void> {
    await this.pc?.addIceCandidate({
      candidate: candidate.candidate,
      sdpMid: candidate.sdp_mid ?? null,
      sdpMLineIndex: candidate.sdp_mline_index ?? null,
      usernameFragment: candidate.username_fragment ?? undefined,
    });
  }

  private async flushPendingCandidates(): Promise<void> {
    for (const candidate of this.pendingCandidates.splice(0)) {
      await this.addRemoteCandidate(candidate);
    }
  }

  private sendChannel(label: string, data: Uint8Array, keepPending = 48): void {
    const channel = this.channels.get(label);
    if (!channel || channel.readyState !== 'open') {
      const pending = this.pendingPackets.get(label) ?? [];
      pending.push(data);
      if (pending.length > keepPending) pending.splice(0, pending.length - keepPending);
      this.pendingPackets.set(label, pending);
      return;
    }
    channel.send(data);
  }

  private flushChannel(label: string, channel: RTCDataChannel): void {
    if (channel.readyState !== 'open') return;
    const pending = this.pendingPackets.get(label);
    if (!pending?.length) return;
    this.pendingPackets.delete(label);
    pending.forEach((data) => channel.send(data));
  }

  private checkInputReady(): void {
    if (
      this.inputReady
      || !INPUT_CHANNELS.every((label) => this.channels.get(label)?.readyState === 'open')
    ) {
      return;
    }
    this.inputReady = true;
    this.callbacks.onInputReady();
  }

  /** Gói từ PC trên kênh controllers: 0 = rung 2 động cơ, 1 = rung cò. */
  private handleControllerMessage(buffer: ArrayBuffer): void {
    const rumble = decodeControllerMessage(buffer);
    if (rumble) this.callbacks.onRumble?.(rumble);
  }

  private fail(message: string): void {
    if (this.stopped) return;
    this.callbacks.onError(message);
  }

  /** Rớt mạng giữa phiên: dừng sạch rồi để phía gọi nối lại. */
  private drop(message: string): void {
    if (this.stopped) return;
    const onDropped = this.callbacks.onDropped;
    if (!onDropped) {
      this.fail(message);
      return;
    }
    this.stop();
    onDropped(message);
  }
}

export const NativeMouseButton = MOUSE_BUTTON;
