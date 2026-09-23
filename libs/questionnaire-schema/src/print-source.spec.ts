import { resolveQuestionnairePrintSource } from './print-source';

describe('resolveQuestionnairePrintSource', () => {
  const draft = {
    answersJson: { k: 'B' },
    revision: 3,
  };
  const submission = {
    id: 'sub-1',
    submissionNumber: 1,
    snapshotJson: { k: 'A' },
    contextJson: { frozen: true },
  };
  const assignmentContext = { live: true };

  it.each([
    'new',
    'assigned',
    'in_progress',
    'changes_requested',
    'cancelled',
  ] as const)('%s → draft source', (status) => {
    const src = resolveQuestionnairePrintSource({
      assignmentStatus: status,
      draft,
      latestSubmission: submission,
      assignmentContextJson: assignmentContext,
    });
    expect(src.sourceKind).toBe('draft');
    expect(src.answers).toEqual({ k: 'B' });
    expect(src.context).toEqual(assignmentContext);
    expect(src.draftRevision).toBe(3);
  });

  it('closed + submission → submission source', () => {
    const src = resolveQuestionnairePrintSource({
      assignmentStatus: 'closed',
      draft,
      latestSubmission: submission,
      assignmentContextJson: assignmentContext,
    });
    expect(src.sourceKind).toBe('submission');
    expect(src.answers).toEqual({ k: 'A' });
    expect(src.context).toEqual({ frozen: true });
    expect(src.submissionId).toBe('sub-1');
  });

  it('closed without submission → draft', () => {
    const src = resolveQuestionnairePrintSource({
      assignmentStatus: 'closed',
      draft,
      latestSubmission: null,
      assignmentContextJson: assignmentContext,
    });
    expect(src.sourceKind).toBe('draft');
    expect(src.answers).toEqual({ k: 'B' });
  });

  it('cancelled + snapshot A + draft B → draft B', () => {
    const src = resolveQuestionnairePrintSource({
      assignmentStatus: 'cancelled',
      draft,
      latestSubmission: submission,
      assignmentContextJson: assignmentContext,
    });
    expect(src.sourceKind).toBe('draft');
    expect(src.answers).toEqual({ k: 'B' });
    expect(src.context).toEqual(assignmentContext);
  });
});
