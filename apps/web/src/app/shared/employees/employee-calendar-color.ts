/**
 * Single entry for employee calendar color → CSS background value.
 * List / detail / request VMs must not invent their own null fallbacks.
 */
export const EMPLOYEE_CALENDAR_COLOR_FALLBACK = 'var(--pw-border)';

export function employeeCalendarColorCss(
  color: string | null | undefined,
): string {
  const trimmed = (color ?? '').trim();
  return trimmed.length > 0 ? trimmed : EMPLOYEE_CALENDAR_COLOR_FALLBACK;
}
