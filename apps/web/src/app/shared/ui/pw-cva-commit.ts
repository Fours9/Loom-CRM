/**
 * Single commit path for additive CVA on loom-pw-* controls.
 * Updates internal SoT, then notifies both valueChange and Forms CVA.
 */
export function commitPwControlValue(
  next: string,
  sinks: {
    setValue: (value: string) => void;
    emitValueChange: (value: string) => void;
    cvaOnChange: (value: string) => void;
    cvaOnTouched: () => void;
  },
): void {
  sinks.setValue(next);
  sinks.emitValueChange(next);
  sinks.cvaOnChange(next);
  sinks.cvaOnTouched();
}
