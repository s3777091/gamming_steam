import { PanResponder } from 'react-native';

import { DEFAULT_INPUT_SETTINGS, type InputSettings } from '@/lib/input-settings';
import { NativeMouseButton, type NativeMoonlightClient } from '@/lib/moonlight-native';
import { pointOnStream } from '@/lib/stream-fit';

const TAP_THRESHOLD = 9;
type Size = { width: number; height: number };
type GestureState = {
  startX: number; startY: number; lastX: number; lastY: number; moved: number;
  twoFinger: boolean; scrolling: boolean; leftDown: boolean;
};
type TouchpadContext = {
  live: boolean;
  videoSize: Size;
  stage: Size;
  allowStretch?: boolean;
  getClient: () => NativeMoonlightClient | null;
  getSettings: () => InputSettings;
  onManualInput?: () => void;
  onTouchPoint?: (point: { x: number; y: number }) => void;
};

/** Keeps an in-progress native gesture independent of React render attempts. */
export class StreamTouchpad {
  private dragClient: NativeMoonlightClient | null = null;
  private context: TouchpadContext = {
    live: false, videoSize: { width: 16, height: 9 }, stage: { width: 1, height: 1 },
    getClient: () => null, getSettings: () => DEFAULT_INPUT_SETTINGS,
  };
  private gesture: GestureState = {
    startX: 0, startY: 0, lastX: 0, lastY: 0, moved: 0,
    twoFinger: false, scrolling: false, leftDown: false,
  };

  update(context: TouchpadContext) {
    if ((this.dragClient && this.dragClient !== context.getClient()) || (this.context.live && !context.live)) this.release();
    this.context = context;
  }

  release = () => {
    if (!this.gesture.leftDown) return;
    (this.dragClient ?? this.context.getClient())?.sendMouseButton(false, NativeMouseButton.LEFT);
    this.dragClient = null;
    this.gesture.leftDown = false;
  };

  private point(x: number, y: number) {
    return pointOnStream(x, y, this.context.videoSize, this.context.stage, this.context.allowStretch);
  }

  readonly panHandlers = PanResponder.create({
    onStartShouldSetPanResponder: () => this.context.live,
    onMoveShouldSetPanResponder: () => this.context.live,
    onPanResponderGrant: (event, gesture) => {
      this.context.onManualInput?.();
      const first = event.nativeEvent.touches[0];
      const x = first?.locationX ?? event.nativeEvent.locationX;
      const y = first?.locationY ?? event.nativeEvent.locationY;
      this.gesture = { startX: x, startY: y, lastX: x, lastY: y, moved: 0, twoFinger: gesture.numberActiveTouches >= 2, scrolling: false, leftDown: false };
    },
    onPanResponderMove: (event, gesture) => {
      const touches = event.nativeEvent.touches;
      const state = this.gesture;
      const client = this.context.getClient();
      if (gesture.numberActiveTouches >= 2 && touches.length >= 2) {
        if (state.leftDown) this.release();
        const x = ((touches[0].locationX ?? state.lastX) + (touches[1].locationX ?? state.lastX)) / 2;
        const y = ((touches[0].locationY ?? state.lastY) + (touches[1].locationY ?? state.lastY)) / 2;
        const dy = y - state.lastY;
        state.twoFinger = true;
        state.moved += Math.abs(x - state.lastX) + Math.abs(dy);
        state.lastX = x;
        state.lastY = y;
        if (state.moved >= TAP_THRESHOLD) {
          state.scrolling = true;
          const settings = this.context.getSettings();
          const direction = settings.invertScroll ? 1 : -1;
          client?.sendScroll(0, dy * 3 * settings.scrollSensitivity * direction);
        }
        return;
      }
      const first = touches[0];
      if (!first) return;
      const x = first.locationX ?? state.lastX;
      const y = first.locationY ?? state.lastY;
      state.moved += Math.abs(x - state.lastX) + Math.abs(y - state.lastY);
      state.lastX = x;
      state.lastY = y;
      if (state.moved < TAP_THRESHOLD) return;
      if (!state.leftDown) {
        const start = this.point(state.startX, state.startY);
        client?.sendMousePosition(start.x, start.y, true);
        client?.sendMouseButton(true, NativeMouseButton.LEFT);
        this.dragClient = client;
        state.leftDown = true;
      }
      const point = this.point(x, y);
      client?.sendMousePosition(point.x, point.y);
    },
    onPanResponderRelease: () => {
      const state = this.gesture;
      const client = this.context.getClient();
      const point = this.point(state.lastX, state.lastY);
      if (state.leftDown) {
        client?.sendMousePosition(point.x, point.y, true);
        this.release();
        return;
      }
      if (state.scrolling) return;
      client?.sendMousePosition(point.x, point.y, true);
      const button = state.twoFinger ? NativeMouseButton.RIGHT : NativeMouseButton.LEFT;
      client?.sendMouseButton(true, button);
      client?.sendMouseButton(false, button);
      this.context.onTouchPoint?.({ x: state.lastX, y: state.lastY });
    },
    onPanResponderTerminate: this.release,
    onPanResponderTerminationRequest: () => true,
  }).panHandlers;
}
