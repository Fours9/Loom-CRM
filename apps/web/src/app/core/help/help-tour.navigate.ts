import type { HelpStep } from './help-tour.models';

/** Pure next-index scan used by HelpTourService (deterministic skip of missing anchors). */
export function findUsableStepIndex(
  steps: readonly HelpStep[],
  fromIndex: number,
  direction: 1 | -1,
  isAnchorPresent: (anchorId: string) => boolean,
): number | null {
  let index = fromIndex;
  while (index >= 0 && index < steps.length) {
    const step = steps[index]!;
    if (!step.anchorId || isAnchorPresent(step.anchorId)) {
      return index;
    }
    index += direction;
  }
  return null;
}
