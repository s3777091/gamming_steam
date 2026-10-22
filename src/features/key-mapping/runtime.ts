import { geometryCompatible, pressedControls, stripMappedInputs, validateProfile, type Binding, type Geometry, type MappingProfile, type PadState, type Point, type Step } from './model';

/** Existing Moonlight client implements this interface; no other transport. */
export type MappingSink = {
  sendMousePosition: (x: number, y: number, reliable?: boolean) => void;
  sendMouseButton: (down: boolean, button: number) => void;
};
export function createMappingSink(client: MappingSink & { isPointerInputReady: () => boolean }): MappingSink {
  const ready = () => { if (!client.isPointerInputReady()) throw new Error('Kênh điều khiển đã ngắt. Mapping đã dừng.'); };
  return {
    sendMousePosition(x, y) { ready(); client.sendMousePosition(x, y, true); },
    sendMouseButton(down, button) {
      if (down) ready();
      if (client.isPointerInputReady()) client.sendMouseButton(down, button);
    },
  };
}
type Job = { key: string; binding: Binding; abort: AbortController };
const canceled = () => new Error('mapping-canceled');

export class MappingRuntime {
  private profile: MappingProfile | null = null;
  private sink: MappingSink;
  private paused = false;
  private held = new Map<number, Set<string>>();
  private down = new Map<number, Set<string>>();
  private blocked = new Set<number>();
  private jobs = new Map<string, Job>();
  private queue: Job[] = [];
  private runner: Job | null = null;
  private pointerOwner: Job | null = null;
  private chordTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private onError: (error: Error) => void;
  private random: () => number;

  constructor(sink: MappingSink, onError: (error: Error) => void = () => {}, random = Math.random) {
    this.sink = sink; this.onError = onError; this.random = random;
  }
  get activeProfile() { return this.profile; }
  setErrorHandler(handler: (error: Error) => void) { this.onError = handler; }
  activate(profile: MappingProfile, gameId: string | null, geometry: Geometry) {
    validateProfile(profile);
    if (!gameId || profile.game_id !== gameId) throw new Error('Profile không thuộc game đang chơi.');
    if (!geometryCompatible(profile.screenshot, geometry)) throw new Error('Tỉ lệ ảnh khác stream. Hãy dùng ảnh toàn màn hình cùng tỉ lệ.');
    this.disable();
    this.profile = JSON.parse(JSON.stringify(profile)) as MappingProfile;
  }
  checkGeometry(geometry: Geometry) {
    if (this.profile && !geometryCompatible(this.profile.screenshot, geometry)) {
      this.disable(); this.onError(new Error('Mapping đã tắt vì tỉ lệ stream thay đổi.'));
    }
  }
  setPaused(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    this.cancel();
    for (const id of this.held.keys()) this.blocked.add(id);
    this.held.clear();
  }
  filter(state: PadState): PadState { return this.profile ? stripMappedInputs(state, this.profile.bindings) : state; }
  process(deviceId: number, state: PadState) {
    const profile = this.profile;
    if (!profile) return;
    const down = pressedControls(state);
    const previousDown = this.down.get(deviceId) ?? new Set<string>();
    this.down.set(deviceId, down);
    const previous = this.held.get(deviceId) ?? new Set<string>();
    const matches = profile.bindings.filter(b => b.controls.every(c => down.has(c)))
      .sort((a, b) => b.controls.length - a.controls.length || a.id.localeCompare(b.id));
    const used = new Set<string>(); const selected = new Set<string>();
    for (const b of matches) {
      if (b.controls.some(c => used.has(c))) continue;
      selected.add(b.id); b.controls.forEach(c => used.add(c));
    }
    this.held.set(deviceId, selected);
    for (const id of previous) if (!selected.has(id)) {
      const key = `${deviceId}:${id}`;
      const old = profile.bindings.find(b => b.id === id)!;
      const superseded = matches.some(b => selected.has(b.id) && b.controls.length > old.controls.length && old.controls.every(c => b.controls.includes(c)));
      if (superseded || old.physicalHold) this.clearChord(key);
      if (old.physicalHold) { const job = this.jobs.get(key); job?.abort.abort(); if (job) this.release(job); }
    }
    if (this.paused) { this.blocked.add(deviceId); return; }
    if (this.blocked.has(deviceId)) {
      if (!profile.bindings.some(b => b.controls.some(c => down.has(c)))) this.blocked.delete(deviceId);
      return;
    }
    for (const b of matches) {
      if (!selected.has(b.id) || previous.has(b.id) || !b.controls.some(c => !previousDown.has(c))) continue;
      const key = `${deviceId}:${b.id}`;
      const isSubset = profile.bindings.some(other => other.controls.length > b.controls.length && b.controls.every(c => other.controls.includes(c)));
      if (isSubset) {
        // A 60 ms chord window suppresses a single when the larger combo wins.
        if (this.chordTimers.has(key)) continue;
        this.chordTimers.set(key, setTimeout(() => {
          this.chordTimers.delete(key);
          if (!this.paused && this.profile === profile && (!b.physicalHold || this.held.get(deviceId)?.has(b.id))) this.enqueue(key, b);
        }, 60));
      } else this.enqueue(key, b);
    }
  }
  disconnect(deviceId: number) {
    this.held.delete(deviceId); this.down.delete(deviceId); this.blocked.delete(deviceId);
    for (const [key, job] of this.jobs) if (key.startsWith(`${deviceId}:`)) job.abort.abort();
    for (const key of this.chordTimers.keys()) if (key.startsWith(`${deviceId}:`)) this.clearChord(key);
    if (this.pointerOwner?.key.startsWith(`${deviceId}:`)) this.release(this.pointerOwner);
  }
  cancel() {
    for (const key of this.chordTimers.keys()) this.clearChord(key);
    for (const job of this.jobs.values()) job.abort.abort();
    this.queue = []; this.jobs.clear();
    if (this.pointerOwner) this.release(this.pointerOwner);
  }
  disable() { this.profile = null; this.cancel(); this.held.clear(); this.down.clear(); this.blocked.clear(); }
  private clearChord(key: string) { clearTimeout(this.chordTimers.get(key)); this.chordTimers.delete(key); }
  private enqueue(key: string, binding: Binding) {
    if (!this.profile || this.paused) return;
    if (this.jobs.has(key)) return;
    if (this.jobs.size >= 32) { this.disable(); this.onError(new Error('Mapping đã tắt vì có quá nhiều thao tác chờ. Hãy rút ngắn macro.')); return; }
    const job = { key, binding, abort: new AbortController() };
    this.jobs.set(key, job); this.queue.push(job); this.drain();
  }
  private drain() {
    if (this.runner) return;
    const job = this.queue.shift();
    if (!job) return;
    this.runner = job;
    void this.execute(job).catch(error => {
      if (!job.abort.signal.aborted) { this.disable(); this.onError(error instanceof Error ? error : new Error(String(error))); }
    }).finally(() => {
      this.release(job);
      if (this.jobs.get(job.key) === job) this.jobs.delete(job.key);
      this.runner = null; this.drain();
    });
  }
  private wait(ms: number, job: Job) {
    return new Promise<void>((resolve, reject) => {
      if (job.abort.signal.aborted) { reject(canceled()); return; }
      const stop = () => { clearTimeout(timer); reject(canceled()); };
      const timer = setTimeout(() => { job.abort.signal.removeEventListener('abort', stop); resolve(); }, ms);
      job.abort.signal.addEventListener('abort', stop, { once: true });
    });
  }
  private move(point: Point, job: Job) {
    if (job.abort.signal.aborted) throw canceled();
    this.sink.sendMousePosition(point.x, point.y, true);
  }
  private release(job: Job) {
    if (this.pointerOwner !== job) return;
    this.pointerOwner = null;
    try { this.sink.sendMouseButton(false, 1); }
    catch (error) {
      if (this.profile) { this.disable(); this.onError(error instanceof Error ? error : new Error(String(error))); }
    }
  }
  private async press(point: Point, ms: number, job: Job) {
    this.move(point, job); this.pointerOwner = job;
    this.sink.sendMouseButton(true, 1);
    try { await this.wait(ms, job); } finally { this.release(job); }
  }
  private async step(step: Step, job: Job) {
    if (job.abort.signal.aborted) throw canceled();
    if (step.type === 'wait') return this.wait(step.durationMs, job);
    if (step.type === 'random') return this.wait(step.minMs + this.random() * (step.maxMs - step.minMs), job);
    if (step.type === 'drag') {
      this.move(step.point, job); this.pointerOwner = job; this.sink.sendMouseButton(true, 1);
      try {
        await this.wait(step.initialHoldMs, job);
        const start = performance.now();
        while (performance.now() - start < step.durationMs) {
          await this.wait(Math.min(16, step.durationMs - (performance.now() - start)), job);
          const t = Math.min(1, (performance.now() - start) / step.durationMs);
          this.move({ x: step.point.x + (step.end.x - step.point.x) * t, y: step.point.y + (step.end.y - step.point.y) * t }, job);
        }
        this.move(step.end, job);
      } finally { this.release(job); }
      return;
    }
    await this.press(step.point, job.binding.physicalHold ? 60_000 : step.durationMs, job);
    if (step.type === 'double') {
      await this.wait(step.intervalMs, job); await this.press(step.point, step.durationMs, job);
    }
  }
  private async execute(job: Job) {
    for (let i = 0; i < job.binding.repeat; i++) for (const step of job.binding.steps) await this.step(step, job);
  }
}
