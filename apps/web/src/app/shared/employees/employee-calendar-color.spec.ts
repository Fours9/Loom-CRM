import {
  EMPLOYEE_CALENDAR_COLOR_FALLBACK,
  EMPLOYEE_CALENDAR_COLOR_PALETTE,
  EMPLOYEE_CALENDAR_COLOR_PLACEHOLDER,
  employeeCalendarColorAt,
  employeeCalendarColorCss,
  nextRandomEmployeeCalendarColor,
  resolveEmployeeCalendarColorForCreate,
} from './employee-calendar-color';

describe('employee calendar color SoT', () => {
  it('employeeCalendarColorCss falls back deterministically', () => {
    expect(employeeCalendarColorCss('#2A6FDB')).toBe('#2A6FDB');
    expect(employeeCalendarColorCss('  #abc  ')).toBe('#abc');
    expect(employeeCalendarColorCss(null)).toBe(EMPLOYEE_CALENDAR_COLOR_FALLBACK);
    expect(employeeCalendarColorCss(undefined)).toBe(
      EMPLOYEE_CALENDAR_COLOR_FALLBACK,
    );
    expect(employeeCalendarColorCss('')).toBe(EMPLOYEE_CALENDAR_COLOR_FALLBACK);
    expect(employeeCalendarColorCss('   ')).toBe(EMPLOYEE_CALENDAR_COLOR_FALLBACK);
  });

  it('employeeCalendarColorAt is stable for any integer', () => {
    expect(employeeCalendarColorAt(0)).toBe(EMPLOYEE_CALENDAR_COLOR_PLACEHOLDER);
    expect(employeeCalendarColorAt(EMPLOYEE_CALENDAR_COLOR_PALETTE.length)).toBe(
      EMPLOYEE_CALENDAR_COLOR_PLACEHOLDER,
    );
    expect(employeeCalendarColorAt(-1)).toBe(
      EMPLOYEE_CALENDAR_COLOR_PALETTE[
        EMPLOYEE_CALENDAR_COLOR_PALETTE.length - 1
      ],
    );
  });

  it('resolveEmployeeCalendarColorForCreate keeps explicit color', () => {
    expect(resolveEmployeeCalendarColorForCreate('#FF0000', 3)).toBe('#FF0000');
    expect(resolveEmployeeCalendarColorForCreate('  #abc  ', 0)).toBe('#abc');
  });

  it('resolveEmployeeCalendarColorForCreate picks from palette when empty', () => {
    expect(resolveEmployeeCalendarColorForCreate(null, 2)).toBe(
      EMPLOYEE_CALENDAR_COLOR_PALETTE[2],
    );
    expect(resolveEmployeeCalendarColorForCreate('', 5)).toBe(
      EMPLOYEE_CALENDAR_COLOR_PALETTE[5],
    );
  });

  it('nextRandomEmployeeCalendarColor uses injected entropy', () => {
    expect(nextRandomEmployeeCalendarColor(() => 0)).toBe(
      EMPLOYEE_CALENDAR_COLOR_PLACEHOLDER,
    );
    expect(nextRandomEmployeeCalendarColor(() => 3)).toBe(
      EMPLOYEE_CALENDAR_COLOR_PALETTE[3],
    );
  });
});
