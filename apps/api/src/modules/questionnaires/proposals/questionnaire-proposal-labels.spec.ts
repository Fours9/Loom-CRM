import { enrichProposalChange } from './questionnaire-proposal-labels';

describe('enrichProposalChange', () => {
  it('requires labelUa on wire field_update', () => {
    const enriched = enrichProposalChange({
      stored: {
        kind: 'field_update',
        section: 'personal',
        field: 'city',
        answerKey: 'personal.city',
        from: null,
        to: 'Kyiv',
      },
      schemaFieldLabel: 'Місто проживання',
    });
    expect(enriched).toMatchObject({
      kind: 'field_update',
      labelUa: 'Місто проживання',
    });
  });

  it('uses contacts frozen map when schema label missing', () => {
    const enriched = enrichProposalChange({
      stored: {
        kind: 'field_update',
        section: 'contacts',
        field: 'workEmail',
        answerKey: 'contacts.bundle',
        from: null,
        to: 'a@b.c',
      },
      schemaFieldLabel: null,
    });
    expect(enriched).toMatchObject({
      kind: 'field_update',
      labelUa: 'Робочий email',
    });
  });
});
