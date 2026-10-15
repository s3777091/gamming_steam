/** A small, replaceable queue so fast navigation cannot flood the image CDN. */
export class BackdropPreloader {
  private queue: string[] = [];
  private readonly running = new Set<string>();
  private readonly recent = new Map<string, number>();
  private revision = 0;
  private readonly load: (url: string) => Promise<boolean>;
  private readonly now: () => number;

  constructor(load: (url: string) => Promise<boolean>, now: () => number = Date.now) {
    this.load = load;
    this.now = now;
  }

  schedule(urls: readonly string[]): () => void {
    const revision = ++this.revision;
    this.queue = [...new Set(urls)];
    this.pump();
    return () => { if (this.revision === revision) this.queue = []; };
  }

  private pump(): void {
    while (this.running.size < 2 && this.queue.length) {
      const url = this.queue.shift()!;
      if (this.running.has(url) || (this.recent.get(url) ?? 0) > this.now()) continue;
      this.running.add(url);
      void this.load(url).catch(() => false).then((ready) => {
        this.running.delete(url);
        this.recent.delete(url);
        this.recent.set(url, this.now() + (ready ? 5 * 60_000 : 30_000));
        if (this.recent.size > 48) this.recent.delete(this.recent.keys().next().value!);
        this.pump();
      });
    }
  }
}

/** Closest cards first; never preload an entire library or the active hero twice. */
export function nearbyBackdropUrls(urls: readonly (string | null | undefined)[], selected: number): string[] {
  return [...new Set([1, -1, 2, -2].map((offset) => urls[selected + offset]).filter((url): url is string => Boolean(url)))];
}
