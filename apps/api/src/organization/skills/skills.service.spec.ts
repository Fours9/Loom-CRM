import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Skill } from './skill.entity';
import { SkillGroup } from './skill-group.entity';
import { SkillsService } from './skills.service';
import { PositionSkillRequirement } from '../position-requirements/position-skill-requirement.entity';

function skillRow(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'skill-1',
    groupId: 'group-1',
    code: 'sewing',
    name: 'Пошиття',
    description: null,
    scaleKind: 'range',
    scaleMin: 0,
    scaleMax: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Skill;
}

function makeService(opts: {
  skill?: Skill;
  requirements?: Array<Pick<PositionSkillRequirement, 'id' | 'skillId' | 'targetLevel'>>;
  group?: SkillGroup;
}) {
  const skill = opts.skill ?? skillRow();
  const reqs = opts.requirements ?? [];
  const group =
    opts.group ??
    ({
      id: 'group-1',
      code: 'TECH',
      name: 'Технічні',
      sortOrder: 0,
      isActive: true,
    } as SkillGroup);

  const manager = {
    getRepository: (entity: unknown) => {
      if (entity === Skill) {
        return {
          findOne: async () => skill,
          findOneByOrFail: async () => skill,
          save: async (row: Skill) => Object.assign(skill, row),
        };
      }
      if (entity === PositionSkillRequirement) {
        return {
          find: async () => reqs,
          count: async () => reqs.length,
        };
      }
      if (entity === SkillGroup) {
        return {
          findOne: async () => group,
        };
      }
      return {};
    },
  } as unknown as EntityManager;

  const dataSource = {
    transaction: async (work: (m: EntityManager) => Promise<unknown>) =>
      work(manager),
  } as unknown as DataSource;

  const groupsRepo = {
    findOne: async ({ where }: { where: { id?: string; code?: string } }) => {
      if (where.id && where.id !== group.id) return null;
      if (where.code && where.code !== group.code) return null;
      return group;
    },
  };
  const skillsRepo = {
    findOne: async ({ where }: { where: { code?: string } }) => {
      if (where.code && where.code === skill.code) return skill;
      return null;
    },
    save: async (row: Skill) => row,
    create: (row: Partial<Skill>) => row,
  };
  const requirementsRepo = {
    count: async () => reqs.length,
  };

  return new SkillsService(
    groupsRepo as never,
    skillsRepo as never,
    requirementsRepo as never,
    dataSource,
  );
}

describe('SkillsService scale and deactivate', () => {
  it('rejects unknown registry code on explicit create', async () => {
    const service = makeService({});
    await expect(
      service.createSkill({
        groupId: 'group-1',
        code: 'sewwing',
        name: 'Typo',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generates custom identity when code is omitted', async () => {
    const service = makeService({
      skill: skillRow({ code: 'other' }),
    });
    const created = await service.createSkill({
      groupId: 'group-1',
      name: 'Кастомна',
    });
    expect(created.code).toMatch(/^skill_[a-f0-9]{12}$/);
  });

  it('returns 409 when changing scale kind with existing requirements', async () => {
    const service = makeService({
      requirements: [{ id: 'r1', skillId: 'skill-1', targetLevel: 3 }],
    });
    await expect(
      service.updateSkill('skill-1', { scaleKind: 'percent', scaleMin: 0, scaleMax: 100 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns 409 when PATCH isActive:false with a requirement', async () => {
    const service = makeService({
      requirements: [{ id: 'r1', skillId: 'skill-1', targetLevel: 3 }],
    });
    await expect(
      service.updateSkill('skill-1', { isActive: false }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns 409 when shrinking bounds past existing targetLevel', async () => {
    const service = makeService({
      requirements: [{ id: 'r1', skillId: 'skill-1', targetLevel: 4 }],
    });
    await expect(
      service.updateSkill('skill-1', { scaleMin: 0, scaleMax: 3 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
