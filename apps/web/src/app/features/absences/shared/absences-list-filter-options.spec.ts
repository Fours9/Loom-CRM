import {
  ALL_FILTER_VALUE,
  assignThenHandle,
  positionSelectOptions,
  requestStatusSelectOptions,
  requestTypeSelectOptions,
  withAllOption,
} from './absences-list-filter-options';

describe('absences-list-filter-options', () => {
  it('prefixes empty «all» option for singular filters', () => {
    const opts = withAllOption([{ value: 'a', label: 'A' }], 'Усі');
    expect(opts[0]).toEqual({ value: ALL_FILTER_VALUE, label: 'Усі' });
    expect(opts[1].value).toBe('a');
  });

  it('builds status and type catalogs with leading all', () => {
    expect(requestStatusSelectOptions()[0].value).toBe(ALL_FILTER_VALUE);
    expect(requestTypeSelectOptions()[0].value).toBe(ALL_FILTER_VALUE);
    expect(requestTypeSelectOptions().length).toBeGreaterThan(1);
  });

  it('builds position options with all + stable ids', () => {
    expect(
      positionSelectOptions([
        { id: 'p2', name: 'B' },
        { id: 'p1', name: 'A' },
      ]),
    ).toEqual([
      { value: '', label: 'Усі посади' },
      { value: 'p2', label: 'B' },
      { value: 'p1', label: 'A' },
    ]);
  });

  it('assignThenHandle updates model before handler runs', () => {
    let value = 'old';
    let seen = '';
    assignThenHandle(
      (next) => {
        value = next;
      },
      'new',
      () => {
        seen = value;
      },
    );
    expect(value).toBe('new');
    expect(seen).toBe('new');
  });
});
