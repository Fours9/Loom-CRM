import {
  InvalidProposedChangeError,
  parseQuestionnaireProposedChange,
} from './questionnaire-proposed-change';

describe('parseQuestionnaireProposedChange', () => {
  it('parses field_update with optional labelUa', () => {
    expect(
      parseQuestionnaireProposedChange({
        kind: 'field_update',
        section: 'personal',
        field: 'city',
        answerKey: 'personal.city',
        from: null,
        to: 'Kyiv',
        labelUa: 'Місто проживання',
      }),
    ).toMatchObject({
      kind: 'field_update',
      field: 'city',
      to: 'Kyiv',
      labelUa: 'Місто проживання',
    });
  });

  it('parses field_update without labelUa (legacy)', () => {
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

    it('parses add_skill with sourceAtSubmission', () => {
      expect(
        parseQuestionnaireProposedChange({
          kind: 'add_skill',
          section: 'skills',
          field: 'sewing',
          skillId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
          skillCode: 'sewing',
          labelUa: 'Пошиття',
          proposedLevel: 3,
          sourceScale: { kind: 'range', min: 0, max: 5 },
          sourceAtSubmission: 'position_requirement',
        }),
      ).toMatchObject({
        kind: 'add_skill',
        sourceAtSubmission: 'position_requirement',
      });
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
