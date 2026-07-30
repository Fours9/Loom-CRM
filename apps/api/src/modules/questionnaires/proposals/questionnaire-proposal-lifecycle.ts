import { EntityManager } from 'typeorm';
import { QuestionnaireProfileProposal } from '../questionnaire-profile-proposal.entity';

/** Mark pending proposals for a submission as superseded (system resolution). */
export async function supersedePendingForSubmission(
  manager: EntityManager,
  submissionId: string,
  now: Date = new Date(),
): Promise<number> {
  const repo = manager.getRepository(QuestionnaireProfileProposal);
  const pending = await repo.find({
    where: { submissionId, status: 'pending' },
  });
  if (!pending.length) return 0;
  for (const p of pending) {
    p.status = 'superseded';
    p.reviewedByUserId = null;
    p.reviewedAt = now;
  }
  await repo.save(pending);
  return pending.length;
}

/** Supersede other pending rows for the same employee + section.field. */
export async function supersedePendingForSameField(
  manager: EntityManager,
  input: {
    employeeId: string;
    section: string;
    field: string;
    answerKey?: string | null;
    exceptProposalId?: string | null;
    now?: Date;
  },
): Promise<number> {
  const now = input.now ?? new Date();
  const repo = manager.getRepository(QuestionnaireProfileProposal);
  const pending = await repo.find({
    where: { employeeId: input.employeeId, status: 'pending' },
  });
  const obsolete = pending.filter((p) => {
    if (input.exceptProposalId && p.id === input.exceptProposalId) return false;
    const c = p.proposedChanges as {
      section?: string;
      field?: string;
      answerKey?: string;
    };
    if (input.answerKey && c.answerKey === input.answerKey) return true;
    return c.section === input.section && c.field === input.field;
  });
  if (!obsolete.length) return 0;
  for (const p of obsolete) {
    p.status = 'superseded';
    p.reviewedByUserId = null;
    p.reviewedAt = now;
  }
  await repo.save(obsolete);
  return obsolete.length;
}
