import type { HostDisplay } from './stream-geometry';
import type { StreamTransportConfig } from './stream-transport';

export type StreamTargetId = 'pc' | 'vm';

/**
 * The PC target uses the documented 1920px physical home monitor.
 *
 * The VM gets the same number for a different reason. It has no physical panel,
 * so nothing here may ever be derived from `host.width` — that is how one
 * stream's temporary mode got inherited by the next one. But a CONSTANT floor
 * derives from nothing: `streamHostReadinessIssue` already refuses to start a VM
 * that does not advertise a mode of at least MINIMUM_VM_STREAM_MODE, so 1920 is
 * a capability this VM is known to have.
 *
 * Zero was not neutral. With no floor, a low quality tier or a viewer shape the
 * guest cannot produce lets the selector settle on a small advertised mode
 * (1440x900, 1280x800) and Windows genuinely switches the guest desktop to it —
 * the "giant icons, everything blurry" VM session. Quality tiers still work,
 * through bitrate, exactly as they do for the PC.
 */
export const STREAM_RESOLUTION_FLOOR_WIDTH: Record<StreamTargetId, number> = {
  pc: 1920,
  vm: 1920,
};

export const PHYSICAL_PC_DISPLAY = { width: 1920, height: 1080 } as const;
export const MINIMUM_VM_STREAM_MODE = { width: 1920, height: 1080 } as const;
// Hyper-V also advertises 1600x1200. It is the only sufficiently large 4:3
// mode, so allow it only when it removes letterboxing for a 4:3 viewer. The
// normal hard floor stays 1920 and still prevents low tiers from making the VM
// desktop (and all of its UI) physically small.
export const VM_ASPECT_RESOLUTION_FLOOR_WIDTH = 1600;

/** Native codec negotiation is gated by RTCRtpReceiver capabilities. */
export function applyStreamTargetTransportPolicy(
  transport: StreamTransportConfig,
  _targetId: StreamTargetId,
): StreamTransportConfig {
  return transport;
}

export type StreamHostReadinessIssue =
  | 'display-unavailable'
  | 'resolution-switch-disabled'
  | 'modes-unavailable'
  | 'high-resolution-mode-unavailable'
  | 'capture-target-stale'
  | 'multiple-displays'
  | 'topology-unverified';

/**
 * A VM has no trustworthy physical-display fallback. Starting it without a
 * healthy multi-mode agent response merely moves the old 720p guess into a new
 * URL, so the connection must stop before Moonlight is armed.
 */
export function streamHostReadinessIssue(
  host: HostDisplay | null,
  targetId: StreamTargetId,
): StreamHostReadinessIssue | null {
  if (targetId === 'pc' && !host) return 'display-unavailable';
  if (targetId === 'pc' && host?.displayMode === 'virtual') {
    if (host.captureTargetStale !== false) return 'capture-target-stale';
    if (host.displays !== 1) return 'multiple-displays';
    if (host.watchdogReady !== true
      || (host.displayState !== 'local' && host.displayState !== 'streaming')
      || (host.displayState === 'local' && host.restoreVerified !== true)) return 'topology-unverified';
    if (!host.canSwitchResolution) return 'resolution-switch-disabled';
    if (!host.modes?.some(mode => mode.refreshRates?.length)) return 'modes-unavailable';
    return null;
  }
  if (targetId !== 'vm') return null;
  if (!host) return 'display-unavailable';
  if (host.captureTargetStale) return 'capture-target-stale';
  if (typeof host.displays === 'number' && host.displays !== 1) return 'multiple-displays';
  if (!host.canSwitchResolution) return 'resolution-switch-disabled';
  const distinctModes = new Set(
    (host.modes ?? [])
      .filter((mode) => mode.width >= 640 && mode.height >= 480)
      .map((mode) => `${mode.width}x${mode.height}`),
  );
  if (distinctModes.size < 2) return 'modes-unavailable';
  if (!(host.modes ?? []).some((mode) =>
    mode.width >= MINIMUM_VM_STREAM_MODE.width &&
    mode.height >= MINIMUM_VM_STREAM_MODE.height)) {
    return 'high-resolution-mode-unavailable';
  }
  // These fields were added specifically to prove Sunshine is capturing the
  // only current VM display. Missing metadata is unknown, never equivalent to
  // a verified false/one response from the current agent.
  if (host.captureTargetStale !== false || host.displays !== 1) return 'topology-unverified';
  return null;
}

export function applyStreamHostPolicy(
  host: HostDisplay | null,
  targetId: StreamTargetId,
): HostDisplay | null {
  if (host) {
    return {
      ...host,
      resolutionFloorWidth: host.displayMode === 'virtual' ? 0 : STREAM_RESOLUTION_FLOOR_WIDTH[targetId],
      ...(host.displayMode === 'virtual' ? { aspectResolutionFloorWidth: 0 } : {}),
      ...(targetId === 'vm'
        ? { aspectResolutionFloorWidth: VM_ASPECT_RESOLUTION_FLOOR_WIDTH }
        : {}),
    };
  }
  // Losing the agent must not let a small viewer drag the known physical panel
  // back to 720p. VM has no physical-panel safety requirement and keeps the
  // geometry-only fallback when its guest agent is unavailable.
  return targetId === 'vm'
    ? null
    : {
        ...PHYSICAL_PC_DISPLAY,
        canSwitchResolution: false,
        resolutionFloorWidth: STREAM_RESOLUTION_FLOOR_WIDTH[targetId],
      };
}
