import {
  applyDepartmentLocationHint,
  markWorkLocationTouched,
} from './work-location-hint.policy';

describe('work-location-hint.policy', () => {
  it('applies department location only once on empty untouched create state', () => {
    const next = applyDepartmentLocationHint(
      {
        workLocation: '',
        workLocationTouched: false,
        departmentLocationHintApplied: false,
      },
      'Київ',
    );

    expect(next).toEqual({
      workLocation: 'Київ',
      workLocationTouched: false,
      departmentLocationHintApplied: true,
    });
  });

  it('does not overwrite after manual touch', () => {
    const touched = markWorkLocationTouched(
      {
        workLocation: '',
        workLocationTouched: false,
        departmentLocationHintApplied: true,
      },
      '',
    );

    const next = applyDepartmentLocationHint(touched, 'Львів');
    expect(next.workLocation).toBe('');
    expect(next.workLocationTouched).toBe(true);
  });
});
