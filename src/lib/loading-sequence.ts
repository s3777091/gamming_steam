export const LOADING_READY_HOLD_MS = 2_000;
export const OPENING_DISSOLVE_TIME = 3.35;
export const OPENING_FINISH_TIME = 4.2;
// This watchdog starts only after loading has finished and the opening begins.
export const OPENING_WATCHDOG_MS = 8_000;

export type LoadingSequenceStage = 'loading' | 'settling' | 'opening' | 'revealing' | 'finished';
/**
 * `readyDirect`: nối lại phiên đang chơi (nút Tải lại). Game đã ở sẵn trên màn
 * hình nên bỏ cảnh mở cửa tàu và màn giới thiệu game, tan thẳng vào stream.
 */
export type LoadingSequenceEvent = 'ready' | 'readyDirect' | 'blocked' | 'settled' | 'dissolve' | 'ended';

export function reduceLoadingSequence(
  stage: LoadingSequenceStage,
  event: LoadingSequenceEvent,
): LoadingSequenceStage {
  switch (event) {
    case 'blocked': return 'loading';
    case 'ready': return stage === 'loading' ? 'settling' : stage;
    case 'readyDirect': return stage === 'loading' || stage === 'settling' ? 'finished' : stage;
    case 'settled': return stage === 'settling' ? 'opening' : stage;
    case 'dissolve': return stage === 'opening' ? 'revealing' : stage;
    case 'ended': return stage === 'opening' || stage === 'revealing' ? 'finished' : stage;
  }
}
