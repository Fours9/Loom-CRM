import { EmployeeSkillAssessmentsFacade } from './employee-skill-assessments.facade';
import type { EntityManager } from 'typeorm';

describe('EmployeeSkillAssessmentsFacade.insertConfirmedIfAbsent', () => {
  it('returns created when INSERT returns a row', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 'row-1' }]);
    const manager = { query } as unknown as EntityManager;
    const facade = new EmployeeSkillAssessmentsFacade({} as never);

    await expect(
      facade.insertConfirmedIfAbsent(manager, {
        employeeId: 'e1',
        skillId: 's1',
        level: 80,
        assessedBy: 'u1',
        assessedAt: new Date('2026-01-01T00:00:00.000Z'),
        sourceSubmissionId: 'sub-1',
        sourceAssignmentId: 'asg-1',
      }),
    ).resolves.toBe('created');

    expect(query).toHaveBeenCalled();
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('ON CONFLICT (employee_id, skill_id)');
    expect(sql).toContain("WHERE assessment_type = 'confirmed'");
    expect(sql).toContain('DO NOTHING');
    expect(sql).toContain('RETURNING id');
  });

  it('returns already_exists when INSERT returns no row', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const manager = { query } as unknown as EntityManager;
    const facade = new EmployeeSkillAssessmentsFacade({} as never);

    await expect(
      facade.insertConfirmedIfAbsent(manager, {
        employeeId: 'e1',
        skillId: 's1',
        level: null,
        assessedBy: null,
        assessedAt: new Date(),
      }),
    ).resolves.toBe('already_exists');
  });
});
