/** A bounded LRU cache; expired entries never escape to the UI. */
export class TimedCache<K, V> {
  private readonly entries = new Map<K, { value: V; expires: number }>();
  private readonly capacity: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(
    capacity: number,
    ttlMs: number,
    now: () => number = Date.now,
  ) {
    if (capacity < 1 || !Number.isInteger(capacity) || ttlMs <= 0) throw new Error('Invalid cache limits');
    this.capacity = capacity;
    this.ttlMs = ttlMs;
    this.now = now;
  }

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    if (entry.expires <= this.now()) return undefined;
    this.entries.set(key, entry);
    return entry.value;
  }

  remainingMs(key: K): number {
    const entry = this.entries.get(key);
    if (!entry) return 0;
    const remaining = entry.expires - this.now();
    if (remaining <= 0) this.entries.delete(key);
    return Math.max(0, remaining);
  }

  set(key: K, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: this.now() + this.ttlMs });
    if (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }
  }
}
