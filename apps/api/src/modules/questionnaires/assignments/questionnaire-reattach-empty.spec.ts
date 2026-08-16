import { isEmptyForDifferentEmployeeReattach } from './questionnaire-reattach-empty';

describe('isEmptyForDifferentEmployeeReattach', () => {
  it('is empty when no submissions and no response', () => {
    expect(
      isEmptyForDifferentEmployeeReattach({
        submissions: [],
        response: null,
      }),
    ).toBe(true);
  });

  it('is empty when no submissions and answersJson has no keys', () => {
    expect(
      isEmptyForDifferentEmployeeReattach({
        submissions: [],
        response: { answersJson: {} },
      }),
    ).toBe(true);
  });

  it('is empty when answersJson is null', () => {
    expect(
      isEmptyForDifferentEmployeeReattach({
        submissions: [],
        response: { answersJson: null },
      }),
    ).toBe(true);
  });

  it('is not empty when answersJson has any own key', () => {
    expect(
      isEmptyForDifferentEmployeeReattach({
        submissions: [],
        response: { answersJson: { 'skills.matrix': { ratings: [], custom: [] } } },
      }),
    ).toBe(false);
  });

  it('is not empty when submissions exist even if answers empty', () => {
    expect(
      isEmptyForDifferentEmployeeReattach({
        submissions: [{ id: 's1' }],
        response: { answersJson: {} },
      }),
    ).toBe(false);
  });
});
