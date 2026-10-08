import {
  EMPLOYEE_CALENDAR_COLOR_FALLBACK,
  employeeCalendarColorCss,
} from './employee-calendar-color';

describe('employeeCalendarColorCss', () => {
  it('returns trimmed color when set', () => {
    expect(employeeCalendarColorCss('#2A6FDB')).toBe('#2A6FDB');
    expect(employeeCalendarColorCss('  #abc  ')).toBe('#abc');
  });

  it('falls back deterministically for empty/null', () => {
    expect(employeeCalendarColorCss(null)).toBe(EMPLOYEE_CALENDAR_COLOR_FALLBACK);
    expect(employeeCalendarColorCss(undefined)).toBe(
      EMPLOYEE_CALENDAR_COLOR_FALLBACK,
    );
    expect(employeeCalendarColorCss('')).toBe(EMPLOYEE_CALENDAR_COLOR_FALLBACK);
    expect(employeeCalendarColorCss('   ')).toBe(EMPLOYEE_CALENDAR_COLOR_FALLBACK);
  });
});
