import {
  proposalChangeSummary,
  proposalChangeTitle,
} from './questionnaire-proposal-labels';
import type { QuestionnaireProfileProposalItem } from '@loom/contracts-questionnaires';

function item(
  change: QuestionnaireProfileProposalItem['proposedChanges'],
): QuestionnaireProfileProposalItem {
  return {
    id: '1',
    submissionId: '2',
    assignmentId: '3',
    employeeId: '4',
    targetSection: 'personal',
    proposedChanges: change,
    status: 'pending',
    reviewedByUserId: null,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
    capabilities: { canAccept: true, canReject: true },
  };
}

describe('questionnaire-proposal-labels', () => {
  it('uses labelUa for field_update title', () => {
    expect(
      proposalChangeTitle(
        item({
          kind: 'field_update',
          section: 'personal',
          field: 'birthDate',
          answerKey: 'personal.birth_date',
          from: null,
          to: '1990-01-15',
          labelUa: 'Дата народження',
        }),
      ),
    ).toBe('Дата народження');
  });

  it('humanizes null and dates', () => {
    expect(
      proposalChangeSummary(
        item({
          kind: 'field_update',
          section: 'personal',
          field: 'birthDate',
          answerKey: 'personal.birth_date',
          from: null,
          to: '1990-01-15',
          labelUa: 'Дата народження',
        }),
      ),
    ).toMatch(/не вказано → /);
  });

  it('summarizes contact arrays without JSON', () => {
    const summary = proposalChangeSummary(
      item({
        kind: 'field_update',
        section: 'contacts',
        field: 'personal_replace',
        answerKey: 'contacts.bundle',
        from: [],
        to: [{ type: 'personal_email', value: 'a@b.c', isPrimary: true }],
        labelUa: 'Особисті контакти',
      }),
    );
    expect(summary).toBe('не вказано → 1 контакт');
    expect(summary).not.toContain('{');
    expect(summary).not.toContain('[object Object]');
  });
});
