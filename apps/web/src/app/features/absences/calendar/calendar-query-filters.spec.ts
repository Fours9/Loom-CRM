import { buildCalendarQueryFilters } from './calendar-query-filters';

describe('buildCalendarQueryFilters', () => {
  const base = {
    departmentIds: [] as string[],
    types: [] as never[],
    statusGroups: [] as never[],
    employeeId: '',
    presetEmployeeId: null as string | null,
    isEmployeeOnly: false,
  };

  it('treats empty arrays as no constraint (omit keys)', () => {
    expect(buildCalendarQueryFilters(base)).toEqual({});
  });

  it('maps nonempty arrays to sorted plural keys (inclusive OR)', () => {
    expect(
      buildCalendarQueryFilters({
        ...base,
        departmentIds: ['dep-b', 'dep-a', 'dep-a'],
        types: ['vacation', 'day_off'],
        statusGroups: ['pending', 'approved'],
      }),
    ).toEqual({
      departmentIds: ['dep-a', 'dep-b'],
      types: ['day_off', 'vacation'],
      statusGroups: ['approved', 'pending'],
    });
  });

  it('prefers presetEmployeeId over UI employeeId', () => {
    expect(
      buildCalendarQueryFilters({
        ...base,
        employeeId: 'ui-emp',
        presetEmployeeId: 'preset-emp',
      }),
    ).toEqual({ employeeIds: ['preset-emp'] });
  });

  it('uses UI employeeId when no preset', () => {
    expect(
      buildCalendarQueryFilters({
        ...base,
        employeeId: 'ui-emp',
      }),
    ).toEqual({ employeeIds: ['ui-emp'] });
  });

  it('omits departmentIds when employee-only even if UI has depts', () => {
    expect(
      buildCalendarQueryFilters({
        ...base,
        isEmployeeOnly: true,
        departmentIds: ['dep-a'],
        presetEmployeeId: 'preset-emp',
        employeeId: '',
      }),
    ).toEqual({ employeeIds: ['preset-emp'] });
  });
});
