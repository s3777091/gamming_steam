/** One request at a time; schedule the next only after the previous settles. */
export function startAsyncPoll(
  poll: (signal: AbortSignal) => Promise<void>,
  delay: () => number,
): () => void {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    try {
      await poll(controller.signal);
    } catch {
      // A failed sample does not stop subsequent polls.
    } finally {
      if (!controller.signal.aborted) timer = setTimeout(() => void tick(), delay());
    }
  };
  void tick();
  return () => {
    controller.abort();
    clearTimeout(timer);
  };
}
