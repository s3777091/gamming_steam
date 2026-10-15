import { getDisplayInfo } from 'jetsona-input';

import { preferredRefreshHz } from './stream-display-policy';

export { autoFrameRate, snapRefreshHz, type AutoFrameRate } from './stream-display-policy';

/** The panel can idle at 60 Hz while supporting 120 Hz during play. */
export async function displayRefreshHz(): Promise<number | null> {
  const display = getDisplayInfo();
  return preferredRefreshHz(display?.refreshRate ?? null, display?.supportedRefreshRates);
}
