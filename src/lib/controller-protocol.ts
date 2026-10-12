// Mã hoá gói tay cầm của moonlight-web v2.10 (streamer/src/transport/mod.rs +
// web/stream/input.ts). Toàn bộ số nhiều byte là BIG-ENDIAN (ByteBuffer mặc định
// của client web). Phần thuần, không phụ thuộc React Native để test được bằng node.

export type ControllerState = {
  /** Cờ nút Moonlight (A=0x1000, B=0x2000, X=0x4000, Y=0x8000, …). */
  buttons: number;
  lt: number;
  rt: number;
  lx: number;
  ly: number;
  rx: number;
  ry: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function packet(length: number, write: (view: DataView) => void): Uint8Array {
  const bytes = new Uint8Array(length);
  write(new DataView(bytes.buffer));
  return bytes;
}

/** Kênh `controllers`: [0][slot u8][supportedButtons u32][capabilities u16]. */
export function encodeControllerAdd(slot: number, supportedButtons: number, capabilities: number): Uint8Array {
  return packet(8, (view) => {
    view.setUint8(0, 0);
    view.setUint8(1, slot);
    view.setUint32(2, supportedButtons >>> 0);
    view.setUint16(6, capabilities);
  });
}

/** Kênh `controllers`: [1][slot u8]. */
export function encodeControllerRemove(slot: number): Uint8Array {
  return packet(2, (view) => {
    view.setUint8(0, 1);
    view.setUint8(1, slot);
  });
}

/**
 * Kênh `controller{slot}`: [0][buttons u32][lt u8][rt u8][lx i16][ly i16][rx i16][ry i16].
 * Cò 0..1 -> 0..255; cần -1..1 -> ±32767 (I16_MAX), Y bị đảo dấu như client web
 * (Gamepad API: lên là âm; Moonlight: lên là dương).
 */
export function encodeControllerState(state: ControllerState): Uint8Array {
  const trigger = (value: number) => Math.round(clamp(value, 0, 1) * 255);
  const stick = (value: number) => Math.round(clamp(value, -1, 1) * 32767);
  return packet(15, (view) => {
    view.setUint8(0, 0);
    view.setUint32(1, state.buttons >>> 0);
    view.setUint8(5, trigger(state.lt));
    view.setUint8(6, trigger(state.rt));
    view.setInt16(7, stick(state.lx));
    view.setInt16(9, stick(-state.ly));
    view.setInt16(11, stick(state.rx));
    view.setInt16(13, stick(-state.ry));
  });
}

export type RumbleMessage = { slot: number; low: number; high: number; triggerLeft?: number; triggerRight?: number };

/** Gói từ PC trên kênh `controllers`: [0][slot][low u16][high u16] hoặc [1][slot][left u16][right u16]. */
export function decodeControllerMessage(buffer: ArrayBuffer): RumbleMessage | null {
  if (buffer.byteLength < 6) return null;
  const view = new DataView(buffer);
  const kind = view.getUint8(0);
  const slot = view.getUint8(1);
  if (kind === 0) return { slot, low: view.getUint16(2) / 65535, high: view.getUint16(4) / 65535 };
  if (kind === 1) {
    return { slot, low: 0, high: 0, triggerLeft: view.getUint16(2) / 65535, triggerRight: view.getUint16(4) / 65535 };
  }
  return null;
}
