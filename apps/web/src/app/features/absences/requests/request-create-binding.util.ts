/**
 * Shared form binding helpers for assign-then-handler wrappers
 * (loom-pw-select / loom-pw-date-input without CVA).
 */

/** Clear end time when it is no longer strictly after start. */
export function clearInvalidEndTime(startTime: string, endTime: string): string {
  if (endTime && startTime && endTime <= startTime) {
    return '';
  }
  return endTime;
}

/**
 * Demonstrates assign-then-handler: model is updated before side-effect runs.
 * Used by unit tests and as the pattern for page wrappers.
 */
export function assignThenHandle<T>(
  assign: (next: T) => void,
  next: T,
  handle: () => void,
): void {
  assign(next);
  handle();
}
