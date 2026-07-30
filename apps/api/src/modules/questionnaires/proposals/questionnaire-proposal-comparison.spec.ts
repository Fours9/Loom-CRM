import {
  proposalMatchesCurrentValue,
  valuesEqual,
} from './questionnaire-proposal-comparison';

describe('questionnaire-proposal-comparison', () => {
  it('valuesEqual trims strings', () => {
    expect(valuesEqual(' a ', 'a')).toBe(true);
    expect(valuesEqual('a', 'b')).toBe(false);
  });

  it('matches when profile already has proposed to', () => {
    expect(
      proposalMatchesCurrentValue({
        proposal: {
          proposedChanges: {
            section: 'personal',
            field: 'city',
            answerKey: 'personal.city',
            to: 'Київ',
          },
        },
        currentProfileValue: 'Київ',
      }),
    ).toBe(true);
  });

  it('does not match when values differ', () => {
    expect(
      proposalMatchesCurrentValue({
        proposal: {
          proposedChanges: {
            section: 'personal',
            field: 'city',
            answerKey: 'personal.city',
            to: 'Львів',
          },
        },
        currentProfileValue: 'Київ',
      }),
    ).toBe(false);
  });
});
