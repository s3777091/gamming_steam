/** Keep stale data visible while sharing one refresh across consumers. */
export class RefreshingResource<T> {
  private value: T | null = null;
  private expiresAt = 0;
  private inflight: Promise<T> | null = null;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(ttlMs: number, now: () => number = Date.now) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  peek(): T | null { return this.value; }

  remainingMs(): number { return Math.max(0, this.expiresAt - this.now()); }

  load(loader: () => Promise<T>, force = false): Promise<T> {
    if (this.inflight) return this.inflight;
    if (!force && this.value !== null && this.remainingMs() > 0) return Promise.resolve(this.value);
    this.inflight = Promise.resolve().then(loader).then((value) => {
      this.value = value;
      this.expiresAt = this.now() + this.ttlMs;
      return value;
    }).finally(() => { this.inflight = null; });
    return this.inflight;
  }
}
