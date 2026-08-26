import {
  InvalidProposedChangeError,
  parseQuestionnaireProposedChange,
} from './questionnaire-proposed-change';

describe('parseQuestionnaireProposedChange', () => {
  it('parses field_update', () => {
    expect(
      parseQuestionnaireProposedChange({
        kind: 'field_update',
        section: 'personal',
        field: 'city',
        answerKey: 'personal.city',
        from: null,
        to: 'Kyiv',
      }),
    ).toMatchObject({ kind: 'field_update', field: 'city', to: 'Kyiv' });
  });

  it('parses add_skill', () => {
    expect(
      parseQuestionnaireProposedChange({
        kind: 'add_skill',
        section: 'skills',
        field: 'sewing',
        skillId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        skillCode: 'sewing',
        labelUa: 'Пошиття',
        proposedLevel: null,
        sourceScale: { kind: 'range', min: 0, max: 5 },
      }),
    ).toMatchObject({ kind: 'add_skill', skillCode: 'sewing' });
  });

  it('fails closed without kind', () => {
    expect(() =>
      parseQuestionnaireProposedChange({
        section: 'personal',
        field: 'city',
        answerKey: 'personal.city',
        from: null,
        to: 'Kyiv',
      }),
    ).toThrow(InvalidProposedChangeError);
  });
});
