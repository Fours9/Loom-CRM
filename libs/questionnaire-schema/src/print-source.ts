import type { QuestionnaireAssignmentStatus } from '@loom/contracts-questionnaires';

export type QuestionnairePrintSourceKind = 'draft' | 'submission';

export type QuestionnairePrintSubmissionSlice = {
  snapshotJson: Record<string, unknown>;
  contextJson: Record<string, unknown> | null;
  id?: string;
  submissionNumber?: number;
};

export type QuestionnairePrintDraftSlice = {
  answersJson: Record<string, unknown>;
  revision?: number;
};

export type QuestionnairePrintSource = {
  sourceKind: QuestionnairePrintSourceKind;
  answers: Record<string, unknown>;
  context: Record<string, unknown> | null;
  draftRevision?: number;
  submissionId?: string;
  submissionNumber?: number;
};

/**
 * State-aware answers+context pair for PDF export.
 * cancelled always uses draft (matches Fill read-only screen after cancel).
 */
export function resolveQuestionnairePrintSource(input: {
  assignmentStatus: QuestionnaireAssignmentStatus | string;
  draft: QuestionnairePrintDraftSlice | null | undefined;
  latestSubmission: QuestionnairePrintSubmissionSlice | null | undefined;
  assignmentContextJson: Record<string, unknown> | null | undefined;
}): QuestionnairePrintSource {
  const draftAnswers = input.draft?.answersJson ?? {};
  const draftSource = (): QuestionnairePrintSource => ({
    sourceKind: 'draft',
    answers: draftAnswers,
    context: input.assignmentContextJson ?? null,
    draftRevision: input.draft?.revision,
  });

  const submissionSource = (
    sub: QuestionnairePrintSubmissionSlice,
  ): QuestionnairePrintSource => ({
    sourceKind: 'submission',
    answers: sub.snapshotJson ?? {},
    context: sub.contextJson ?? null,
    submissionId: sub.id,
    submissionNumber: sub.submissionNumber,
  });

  switch (input.assignmentStatus) {
    case 'closed':
      return input.latestSubmission
        ? submissionSource(input.latestSubmission)
        : draftSource();
    case 'assigned':
    case 'in_progress':
    case 'changes_requested':
    case 'cancelled':
    case 'new':
      return draftSource();
    default:
      // Legacy submitted/reviewed → treat like closed official.
      if (
        input.assignmentStatus === 'submitted' ||
        input.assignmentStatus === 'reviewed'
      ) {
        return input.latestSubmission
          ? submissionSource(input.latestSubmission)
          : draftSource();
      }
      return draftSource();
  }
}
