import {
  applyReopenTransition,
  type QuestionnaireReopenCause,
} from './questionnaire-reopen-transition';
import { applyReviewTransition } from './questionnaire-review-transition';

describe('QuestionnaireReopenCause', () => {
  it('discriminates owner vs admin causes', () => {
    const owner: QuestionnaireReopenCause = {
      kind: 'owner_reopen',
      actorUserId: 'u1',
    };
    const admin: QuestionnaireReopenCause = {
      kind: 'admin_start_revision',
      actorUserId: 'u2',
    };
    expect(owner.kind).toBe('owner_reopen');
    expect(admin.kind).toBe('admin_start_revision');
    expect(typeof applyReopenTransition).toBe('function');
    expect(typeof applyReviewTransition).toBe('function');
  });
});
