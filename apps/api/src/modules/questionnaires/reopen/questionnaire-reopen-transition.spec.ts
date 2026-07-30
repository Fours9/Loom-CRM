import {
  applyReopenTransition,
  type QuestionnaireReopenCause,
} from './questionnaire-reopen-transition';

describe('QuestionnaireReopenCause', () => {
  it('discriminates owner vs reviewer causes', () => {
    const owner: QuestionnaireReopenCause = {
      kind: 'owner_reopen',
      actorUserId: 'u1',
    };
    const reviewer: QuestionnaireReopenCause = {
      kind: 'reviewer_request_changes',
      actorUserId: 'u2',
      reviewComment: 'fix field',
    };
    expect(owner.kind).toBe('owner_reopen');
    expect(reviewer.kind).toBe('reviewer_request_changes');
    expect(typeof applyReopenTransition).toBe('function');
  });
});
