import {
  classifyPositionCreateError,
  closePolicyFor,
  isSaveLocked,
  mergeRequirementRows,
} from './position-dialog.models';
import type { PendingSkillRequirement } from './position-dialog.models';

describe('position dialog models', () => {
  it('treats 400/409 as known rejection and everything else as unknown', () => {
    expect(classifyPositionCreateError({ status: 400 })).toBe('known-rejection');
    expect(classifyPositionCreateError({ status: 409 })).toBe('known-rejection');
    expect(classifyPositionCreateError({ status: 500 })).toBe('unknown');
    expect(classifyPositionCreateError({ status: 0 })).toBe('unknown');
    expect(classifyPositionCreateError({})).toBe('unknown');
  });

  it('locks save during creating-position, applying-drafts and unresolved-create', () => {
    expect(isSaveLocked('creating-position')).toBe(true);
    expect(isSaveLocked('applying-drafts')).toBe(true);
    expect(isSaveLocked('unresolved-create')).toBe(true);
    expect(isSaveLocked('create')).toBe(false);
    expect(isSaveLocked('edit')).toBe(false);
  });

  it('requires acknowledgement to close unresolved-create', () => {
    expect(closePolicyFor('unresolved-create', 2, 0)).toEqual({
      action: 'acknowledge-unresolved',
    });
  });

  it('disables close while creating or applying', () => {
    expect(closePolicyFor('creating-position', 1, 0).action).toBe('disabled');
    expect(closePolicyFor('applying-drafts', 1, 0).action).toBe('disabled');
  });

  it('confirms discard for create drafts and warns for failed drafts', () => {
    expect(closePolicyFor('create', 2, 0).action).toBe('confirm-discard-drafts');
    expect(closePolicyFor('edit-with-failed-drafts', 1, 1)).toEqual({
      action: 'warn-failed-drafts',
      failedCount: 1,
    });
    expect(closePolicyFor('edit', 0, 0).action).toBe('allow');
  });

  it('merges persisted rows with leftover failed drafts by skill', () => {
    const persisted = [
      {
        id: 'ra',
        skillId: 'a',
        targetLevel: 1,
        required: true,
        skillName: 'A',
      },
      {
        id: 'rc',
        skillId: 'c',
        targetLevel: 1,
        required: true,
        skillName: 'C',
      },
    ];
    const drafts: PendingSkillRequirement[] = [
      {
        clientId: 'd-b',
        sequence: 2,
        skillId: 'b',
        targetLevel: 1,
        required: true,
        state: 'failed',
        skillName: 'B',
      },
    ];
    const rows = mergeRequirementRows(persisted, drafts);
    expect(rows.map((row) => row.skillId)).toEqual(['a', 'c', 'b']);
    expect(rows[0].kind).toBe('persisted');
    expect(rows[2].kind).toBe('draft');
  });
});
