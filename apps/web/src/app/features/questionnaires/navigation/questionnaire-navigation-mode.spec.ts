import {
  resolveQuestionnaireNavigationMode,
  isQuestionnaireStepBrowsable,
} from './questionnaire-navigation-mode';

describe('questionnaire navigation mode', () => {
  it('uses linear_edit when editable', () => {
    expect(resolveQuestionnaireNavigationMode({ editable: true })).toBe(
      'linear_edit',
    );
  });

  it('uses free_read_only when not editable', () => {
    expect(resolveQuestionnaireNavigationMode({ editable: false })).toBe(
      'free_read_only',
    );
  });

  it('allows any step in free_read_only even if not linearly reachable', () => {
    expect(
      isQuestionnaireStepBrowsable({
        mode: 'free_read_only',
        linearReachable: false,
      }),
    ).toBe(true);
  });

  it('requires linearReachable in linear_edit', () => {
    expect(
      isQuestionnaireStepBrowsable({
        mode: 'linear_edit',
        linearReachable: false,
      }),
    ).toBe(false);
    expect(
      isQuestionnaireStepBrowsable({
        mode: 'linear_edit',
        linearReachable: true,
      }),
    ).toBe(true);
  });
});
