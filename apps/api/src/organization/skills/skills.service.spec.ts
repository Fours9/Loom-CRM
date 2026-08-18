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

function groupRow(overrides: Partial<SkillGroup> = {}): SkillGroup {
  return {
    id: 'group-1',
    code: 'TECH',
    name: 'Технічні',
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as SkillGroup;
}

function makeService(opts: {
  skill?: Skill;
  skills?: Skill[];
  requirements?: Array<Pick<PositionSkillRequirement, 'id' | 'skillId' | 'targetLevel'>>;
  group?: SkillGroup;
  groups?: SkillGroup[];
}) {
  const skill = opts.skill ?? skillRow();
  const reqs = opts.requirements ?? [];
  const group = opts.group ?? groupRow();
  const groups = opts.groups ?? [group];
  const catalogSkills = opts.skills ?? [skill];

  const manager = {
    getRepository: (entity: unknown) => {
      if (entity === Skill) {
        return {
          findOne: async (args?: { where?: { id?: string; code?: string } }) => {
            if (args?.where?.code) {
              return catalogSkills.find((s) => s.code === args.where?.code) ?? null;
            }
            if (args?.where?.id) {
              return catalogSkills.find((s) => s.id === args.where?.id) ?? skill;
            }
            return skill;
          },
          findOneByOrFail: async () => skill,
          save: async (row: Skill) => Object.assign(skill, row),
          create: (row: Partial<Skill>) => row,
          count: async (args?: { where?: { groupId?: string; isActive?: boolean } }) => {
            return catalogSkills.filter((s) => {
              if (args?.where?.groupId && s.groupId !== args.where.groupId) return false;
              if (args?.where?.isActive !== undefined && s.isActive !== args.where.isActive) {
                return false;
              }
              return true;
            }).length;
          },
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
          findOne: async (args?: { where?: { id?: string; code?: string } }) => {
            const id = args?.where?.id;
            const code = args?.where?.code;
            if (id) return groups.find((g) => g.id === id) ?? null;
            if (code) return groups.find((g) => g.code === code) ?? null;
            return group;
          },
          save: async (row: SkillGroup) => Object.assign(group, row),
          create: (row: Partial<SkillGroup>) => row,
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
      if (where.id) return groups.find((g) => g.id === where.id) ?? null;
      if (where.code) return groups.find((g) => g.code === where.code) ?? null;
      return group;
    },
    save: async (row: SkillGroup) => row,
    create: (row: Partial<SkillGroup>) => row,
  };
  const skillsRepo = {
    findOne: async ({ where }: { where: { code?: string } }) => {
      if (where.code) return catalogSkills.find((s) => s.code === where.code) ?? null;
      return null;
    },
    save: async (row: Skill) => row,
    create: (row: Partial<Skill>) => row,
    count: async () => catalogSkills.length,
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

  it('rejects create skill into an inactive group', async () => {
    const service = makeService({
      group: groupRow({ isActive: false }),
    });
    await expect(
      service.createSkill({ groupId: 'group-1', name: 'X' }),
    ).rejects.toBeInstanceOf(BadRequestException);
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

describe('SkillsService group lifecycle', () => {
  it('generates group_<hex> for Position Catalog custom groups', async () => {
    const service = makeService({});
    const created = await service.createCustomGroup({ name: 'Нова група' });
    expect(created.code).toMatch(/^group_[a-f0-9]{12}$/);
    expect(created.name).toBe('Нова група');
  });

  it('rejects deactivate group while it has active skills', async () => {
    const service = makeService({
      skills: [skillRow({ isActive: true, groupId: 'group-1' })],
    });
    await expect(
      service.updateGroup('group-1', { isActive: false }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects DELETE group while it has active skills', async () => {
    const service = makeService({
      skills: [skillRow({ isActive: true, groupId: 'group-1' })],
    });
    await expect(service.softDeleteGroup('group-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('allows deactivate group when all skills are inactive', async () => {
    const group = groupRow({ isActive: true });
    const service = makeService({
      group,
      skills: [skillRow({ isActive: false, groupId: 'group-1' })],
    });
    const updated = await service.updateGroup('group-1', { isActive: false });
    expect(updated.isActive).toBe(false);
  });

  it('rejects re-enable skill when group is inactive', async () => {
    const service = makeService({
      skill: skillRow({ isActive: false }),
      group: groupRow({ isActive: false }),
    });
    await expect(
      service.updateSkill('skill-1', { isActive: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('soft-deletes a skill with no requirements after locking without a group join', async () => {
    const skill = skillRow({ isActive: true });
    const service = makeService({ skill, requirements: [] });
    await service.softDeleteSkill('skill-1');
    expect(skill.isActive).toBe(false);
  });

  it('rejects move skill into an inactive group', async () => {
    const inactive = groupRow({ id: 'group-2', code: 'OFFICE', isActive: false });
    const service = makeService({
      groups: [groupRow(), inactive],
    });
    await expect(
      service.updateSkill('skill-1', { groupId: 'group-2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
