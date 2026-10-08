import {
  EMPLOYEE_CALENDAR_COLOR_PALETTE,
  EMPLOYEE_CALENDAR_COLOR_PLACEHOLDER,
  employeeCalendarColorAt,
  resolveEmployeeCalendarColorForCreate,
} from '@loom/contracts-employees';

export {
  EMPLOYEE_CALENDAR_COLOR_PALETTE,
  EMPLOYEE_CALENDAR_COLOR_PLACEHOLDER,
  employeeCalendarColorAt,
  resolveEmployeeCalendarColorForCreate,
};

/**
 * Display SoT: list/detail VMs map stored color → CSS background.
 * Must not invent create defaults (use `nextRandomEmployeeCalendarColor`).
 */
export const EMPLOYEE_CALENDAR_COLOR_FALLBACK = 'var(--pw-border)';

export function employeeCalendarColorCss(
  color: string | null | undefined,
): string {
  const trimmed = (color ?? '').trim();
  return trimmed.length > 0 ? trimmed : EMPLOYEE_CALENDAR_COLOR_FALLBACK;
}

function cryptoRandomByte(): number {
  const bytes = new Uint8Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0]!;
}

/**
 * Create-form default: random palette entry.
 * Inject `randomByte` (0–255) for deterministic tests.
 */
export function nextRandomEmployeeCalendarColor(
  randomByte: () => number = cryptoRandomByte,
): string {
  return employeeCalendarColorAt(randomByte());
}
