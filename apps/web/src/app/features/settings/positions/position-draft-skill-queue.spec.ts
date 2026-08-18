import { MAX_POSITION_SKILLS } from '@loom/position-skill-catalog';
import { PositionDraftSkillQueue } from './position-draft-skill-queue';

function skill(id: string, scaleMin = 0, scaleMax = 5) {
  return { id, scaleMin, scaleMax, name: id, code: id, scaleKind: 'range' as const };
}

describe('PositionDraftSkillQueue', () => {
  it('assigns native scaleMin and required=true per selected skill', () => {
    const queue = new PositionDraftSkillQueue();
    queue.addSkills([skill('a', 1, 5), skill('b', 0, 100)], 0);
    const rows = queue.snapshot();
    expect(rows).toHaveLength(2);
    expect(rows[0].targetLevel).toBe(1);
    expect(rows[1].targetLevel).toBe(0);
    expect(rows.every((row) => row.required)).toBe(true);
  });

  it('uses a monotonic sequence so remove+add does not reuse numbers', () => {
    const queue = new PositionDraftSkillQueue();
    queue.addSkills([skill('a'), skill('b')], 0);
    const firstB = queue.snapshot().find((row) => row.skillId === 'b')!;
    queue.remove(firstB.clientId);
    queue.addSkills([skill('c')], 0);
    const seqs = queue.snapshot().map((row) => row.sequence);
    expect(seqs).toEqual([1, 3]);
  });

  it('pendingInSequence is stable by sequence', () => {
    const queue = new PositionDraftSkillQueue();
    queue.addSkills([skill('a'), skill('b'), skill('c')], 0);
    expect(queue.pendingInSequence().map((row) => row.skillId)).toEqual(['a', 'b', 'c']);
  });

  it('cannot exceed MAX_POSITION_SKILLS with drafts + persisted', () => {
    const queue = new PositionDraftSkillQueue();
    const skills = Array.from({ length: 3 }, (_, i) => skill(`s${i}`));
    const result = queue.addSkills(skills, MAX_POSITION_SKILLS - 1);
    expect(result.added).toBe(1);
    expect(result.error).toContain(String(MAX_POSITION_SKILLS));
    expect(queue.length).toBe(1);
  });

  it('reconcile drops matching skillId+values even after lost HTTP success', () => {
    const queue = new PositionDraftSkillQueue();
    queue.addSkills([skill('a')], 0);
    const row = queue.snapshot()[0];
    queue.markApplying(row.clientId);
    queue.markFailed(row.clientId, 'timeout');
    queue.reconcile([
      {
        id: 'req-1',
        skillId: 'a',
        targetLevel: 0,
        required: true,
      },
    ]);
    expect(queue.isEmpty()).toBe(true);
  });

  it('reconcile marks conflict when skillId matches but values differ', () => {
    const queue = new PositionDraftSkillQueue();
    queue.addSkills([skill('a')], 0);
    const row = queue.snapshot()[0];
    queue.changeTarget(row.clientId, 4);
    queue.reconcile([
      {
        id: 'req-1',
        skillId: 'a',
        targetLevel: 0,
        required: true,
      },
    ]);
    const leftover = queue.snapshot()[0];
    expect(leftover.state).toBe('conflict');
    expect(leftover.persistedId).toBe('req-1');
  });

  it('reset isolates drafts from a later position', () => {
    const queue = new PositionDraftSkillQueue();
    queue.addSkills([skill('a')], 0);
    queue.markFailed(queue.snapshot()[0].clientId, 'fail');
    queue.reset();
    expect(queue.isEmpty()).toBe(true);
    queue.addSkills([skill('b')], 0);
    expect(queue.snapshot()[0].skillId).toBe('b');
    expect(queue.snapshot()[0].sequence).toBe(1);
  });
});
