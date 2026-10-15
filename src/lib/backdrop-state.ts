export type BackdropState = {
  requested: string | null;
  fallback: string | null;
  current: string | null;
  pending: string | null;
  fallbackFailed: boolean;
};

export function requestBackdrop(
  previous: BackdropState | null,
  requested: string | null,
  fallback: string | null,
): BackdropState {
  if (previous?.requested === requested && previous.fallback === fallback) return previous;
  const current = previous?.current ?? null;
  return { requested, fallback, current, pending: requested !== current ? requested : null, fallbackFailed: false };
}

export function failBackdrop(state: BackdropState, url: string): BackdropState {
  if (url === state.fallback && url !== state.requested) {
    return {
      ...state,
      fallbackFailed: true,
      pending: state.pending === url ? null : state.pending,
      current: state.current === url ? null : state.current,
    };
  }
  // Ignore late errors from an image belonging to an earlier selection.
  if (state.pending !== url) return state;
  const current = state.current === state.fallback ? state.current : null;
  const pending = url === state.requested && !state.fallbackFailed && state.fallback !== url && state.fallback !== current
    ? state.fallback : null;
  // Once the new image fails, the previous game's artwork is no longer valid.
  return { ...state, current, pending };
}

export function finishBackdrop(state: BackdropState, url: string): BackdropState {
  if (state.pending === url) return { ...state, current: url, pending: null };
  // A cached cover can replace the old game while its full hero keeps loading.
  if (state.pending === state.requested && state.pending !== null && state.fallback === url && !state.fallbackFailed) {
    return { ...state, current: url };
  }
  return state;
}
