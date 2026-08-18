import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { MAX_POSITION_SKILLS } from '@loom/position-skill-catalog';
import { PositionRequirementsService } from './position-requirements.service';
import { PositionSkillRequirement } from './position-skill-requirement.entity';
import { Skill } from '../skills/skill.entity';
import { SkillGroup } from '../skills/skill-group.entity';
import { PositionsService } from '../positions/positions.service';
import { SkillsService } from '../skills/skills.service';

function makeService(opts: {
  skill: Skill;
  count?: number;
  existing?: PositionSkillRequirement | null;
  findResult?: PositionSkillRequirement[];
}) {
  const findCalls: Array<{ order?: unknown }> = [];
  const manager = {
    getRepository: (entity: unknown) => {
      if (entity === PositionSkillRequirement) {
        return {
          count: async () => opts.count ?? 0,
          findOne: async () => opts.existing ?? null,
          create: (row: unknown) => row,
          save: async (row: unknown) => row,
        };
      }
      return {};
    },
  } as unknown as EntityManager;

  const requirementsRepo = {
    find: jest.fn(async (args: { order?: unknown }) => {
      findCalls.push(args);
      return opts.findResult ?? [];
    }),
  };

  const skillsCatalog = {
    lockSkill: async () => opts.skill,
    assertSkillAttachable(skill: Skill) {
      if (!skill.isActive) {
        throw new BadRequestException('Skill is inactive');
      }
      if (!skill.group || !skill.group.isActive) {
        throw new BadRequestException('Skill group is inactive');
      }
    },
  };

  const service = new PositionRequirementsService(
    { getOrFail: async () => ({ id: 'pos-1' }) } as unknown as PositionsService,
    skillsCatalog as unknown as SkillsService,
    requirementsRepo as never,
    {} as never,
    {} as never,
    {
      transaction: async (work: (m: EntityManager) => Promise<unknown>) =>
        work(manager),
    } as unknown as DataSource,
  );

  return { service, findCalls, requirementsRepo };
}

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
      group: { id: 'g1', isActive: true } as SkillGroup,
    } as Skill;

    const { service } = makeService({ skill, count: MAX_POSITION_SKILLS });

    await expect(
      service.createSkillRequirement('pos-1', { skillId: skill.id }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects attach when skill group is inactive', async () => {
    const skill = {
      id: 'skill-1',
      code: 'sewing',
      name: 'Пошиття',
      scaleKind: 'range',
      scaleMin: 0,
      scaleMax: 5,
      isActive: true,
      group: { id: 'g1', isActive: false } as SkillGroup,
    } as Skill;
    const { service } = makeService({ skill, count: 0 });

    await expect(
      service.createSkillRequirement('pos-1', { skillId: skill.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists requirements by createdAt ASC then id ASC', async () => {
    const t = new Date('2026-01-01T00:00:00.000Z');
    const { service, requirementsRepo } = makeService({
      skill: { id: 's1', isActive: true, group: { isActive: true } } as Skill,
      findResult: [
        {
          id: 'b',
          createdAt: t,
          skillId: 's2',
          targetLevel: 1,
          required: true,
        } as PositionSkillRequirement,
        {
          id: 'a',
          createdAt: t,
          skillId: 's1',
          targetLevel: 1,
          required: true,
        } as PositionSkillRequirement,
      ],
    });

    await service.listSkillRequirements('pos-1');
    expect(requirementsRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { createdAt: 'ASC', id: 'ASC' },
      }),
    );
  });
});
