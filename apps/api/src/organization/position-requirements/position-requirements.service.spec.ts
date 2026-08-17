import { ConflictException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { MAX_POSITION_SKILLS } from '@loom/position-skill-catalog';
import { PositionRequirementsService } from './position-requirements.service';
import { PositionSkillRequirement } from './position-skill-requirement.entity';
import { Skill } from '../skills/skill.entity';
import { PositionsService } from '../positions/positions.service';
import { SkillsService } from '../skills/skills.service';

describe('PositionRequirementsService attach limit', () => {
  it('rejects the 65th attached skill', async () => {
    const skill = {
      id: 'skill-65',
      code: 'skill_abc123def456',
      name: 'Extra',
      scaleKind: 'range',
      scaleMin: 0,
      scaleMax: 5,
      isActive: true,
    } as Skill;

    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === PositionSkillRequirement) {
          return {
            count: async () => MAX_POSITION_SKILLS,
            findOne: async () => null,
            create: (row: unknown) => row,
            save: async (row: unknown) => row,
          };
        }
        return {};
      },
    } as unknown as EntityManager;

    const service = new PositionRequirementsService(
      { getOrFail: async () => ({ id: 'pos-1' }) } as unknown as PositionsService,
      {
        lockSkill: async () => skill,
      } as unknown as SkillsService,
      {} as never,
      {} as never,
      {} as never,
      {
        transaction: async (work: (m: EntityManager) => Promise<unknown>) =>
          work(manager),
      } as unknown as DataSource,
    );

    await expect(
      service.createSkillRequirement('pos-1', { skillId: skill.id }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
