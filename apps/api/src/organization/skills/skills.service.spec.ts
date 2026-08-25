import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, EntityManager, getMetadataArgsStorage } from 'typeorm';
import { Skill } from './skill.entity';
import { SkillGroup } from './skill-group.entity';
import { SkillsService } from './skills.service';
import { PositionSkillRequirement } from '../position-requirements/position-skill-requirement.entity';
import { SkillGroupOptional1730000026000 } from '../../platform/database/migrations/1730000026000-SkillGroupOptional';

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

type Harness = {
  service: SkillsService;
  lockOrder: string[];
  reqDelete: jest.Mock;
  skillRemove: jest.Mock;
  groupRemove: jest.Mock;
};

function makeHarness(
  opts: {
    skill?: Skill;
    skills?: Skill[];
    skillPreview?: Skill;
    skillLocked?: Skill;
    requirements?: Array<Pick<PositionSkillRequirement, 'id' | 'skillId' | 'targetLevel'>>;
    group?: SkillGroup;
    groups?: SkillGroup[];
  } = {},
): Harness {
  const skill = opts.skill ?? skillRow();
  const reqs = opts.requirements ?? [];
  const group = opts.group ?? groupRow();
  const groups = opts.groups ?? [group];
  const catalogSkills = opts.skills ?? [skill];
  const lockOrder: string[] = [];
  const reqDelete = jest.fn();
  const skillRemove = jest.fn();
  const groupRemove = jest.fn();

  const manager = {
    getRepository: (entity: unknown) => {
      if (entity === Skill) {
        return {
          findOne: async (args?: {
            where?: { id?: string; code?: string };
            lock?: { mode?: string };
          }) => {
            if (args?.where?.code) {
              return catalogSkills.find((s) => s.code === args.where?.code) ?? null;
            }
            const id = args?.where?.id;
            if (args?.lock?.mode === 'pessimistic_write') {
              lockOrder.push(`skill:${id ?? skill.id}`);
              if (opts.skillLocked) return opts.skillLocked;
            } else if (opts.skillPreview && (!id || id === opts.skillPreview.id)) {
              return opts.skillPreview;
            }
            if (id) return catalogSkills.find((s) => s.id === id) ?? skill;
            return skill;
          },
          findOneByOrFail: async () => skill,
          save: async (row: Skill) => {
            // TypeORM JoinColumn: a loaded relation wins over a bare FK on save.
            if (row.group) {
              row.groupId = row.group.id;
            }
            return Object.assign(skill, row);
          },
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
          update: async (
            where: { groupId?: string },
            patch: { groupId: string | null },
          ) => {
            for (const row of catalogSkills) {
              if (where.groupId !== undefined && row.groupId === where.groupId) {
                row.groupId = patch.groupId;
              }
            }
          },
          remove: async (row: Skill) => {
            skillRemove(row);
            const idx = catalogSkills.findIndex((s) => s.id === row.id);
            if (idx >= 0) catalogSkills.splice(idx, 1);
          },
        };
      }
      if (entity === PositionSkillRequirement) {
        return {
          find: async () => reqs,
          count: async () => reqs.length,
          delete: reqDelete,
        };
      }
      if (entity === SkillGroup) {
        return {
          findOne: async (args?: {
            where?: { id?: string; code?: string };
            lock?: { mode?: string };
          }) => {
            const id = args?.where?.id;
            const code = args?.where?.code;
            if (args?.lock?.mode === 'pessimistic_write' && id) {
              lockOrder.push(`group:${id}`);
            }
            if (id) return groups.find((g) => g.id === id) ?? null;
            if (code) return groups.find((g) => g.code === code) ?? null;
            return group;
          },
          save: async (row: SkillGroup) => Object.assign(group, row),
          create: (row: Partial<SkillGroup>) => row,
          remove: groupRemove,
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

  const service = new SkillsService(
    groupsRepo as never,
    skillsRepo as never,
    requirementsRepo as never,
    dataSource,
  );

  return { service, lockOrder, reqDelete, skillRemove, groupRemove };
}

function makeService(
  opts: Parameters<typeof makeHarness>[0] = {},
): SkillsService {
  return makeHarness(opts).service;
}

describe('Skill group optional schema', () => {
  it('marks Skill.groupId nullable in TypeORM metadata', () => {
    const col = getMetadataArgsStorage().columns.find(
      (c) => c.target === Skill && c.propertyName === 'groupId',
    );
    expect(col?.options.nullable).toBe(true);
    const rel = getMetadataArgsStorage().relations.find(
      (r) => r.target === Skill && r.propertyName === 'group',
    );
    expect(rel?.options?.nullable).toBe(true);
  });

  it('down() fails clearly when ungrouped skills exist', async () => {
    const migration = new SkillGroupOptional1730000026000();
    const queryRunner = {
      query: jest.fn().mockResolvedValue([{ count: 2 }]),
    };
    await expect(migration.down(queryRunner as never)).rejects.toThrow(
      /intentionally blocked/,
    );
    expect(queryRunner.query).toHaveBeenCalledTimes(1);
  });

  it('registers SkillGroupOptional1730000026000 in typeorm-options migrations[]', () => {
    const src = readFileSync(
      join(__dirname, '../../platform/database/typeorm-options.ts'),
      'utf8',
    );
    expect(src).toContain("from './migrations/1730000026000-SkillGroupOptional'");
    expect(src).toContain('SkillGroupOptional1730000026000');
    expect(new SkillGroupOptional1730000026000().name).toBe(
      'SkillGroupOptional1730000026000',
    );
  });
});

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

  it('creates an ungrouped skill when groupId is null', async () => {
    const { service, lockOrder } = makeHarness({});
    const created = await service.createSkill({
      groupId: null,
      name: 'Без групи',
    });
    expect(created.groupId).toBeNull();
    expect(lockOrder.some((entry) => entry.startsWith('group:'))).toBe(false);
  });

  it('creates a registry-coded skill in a live group that is not the seed group', async () => {
    const office = groupRow({ id: 'group-office', code: 'OFFICE', name: 'Офіс' });
    const created = await makeService({
      skill: skillRow({ code: 'other' }),
      groups: [office],
      group: office,
    }).createSkill({
      groupId: 'group-office',
      code: 'sewing',
      name: 'Пошиття',
    });
    expect(created.code).toBe('sewing');
    expect(created.groupId).toBe('group-office');
  });

  it('creates an ungrouped skill when groupId is omitted', async () => {
    const created = await makeService({}).createSkill({ name: 'Без групи' });
    expect(created.groupId).toBeNull();
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

describe('SkillsService group membership', () => {
  it('ungroups on PATCH groupId null without locking a group', async () => {
    const skill = skillRow({ groupId: 'group-1' });
    const { service, lockOrder } = makeHarness({ skill });
    const updated = await service.updateSkill('skill-1', { groupId: null });
    expect(updated.groupId).toBeNull();
    expect(updated.group).toBeNull();
    expect(lockOrder).toEqual(['skill:skill-1']);
  });

  it('leaves membership unchanged when groupId is omitted', async () => {
    const skill = skillRow({ groupId: 'group-1', name: 'Пошиття' });
    const updated = await makeService({ skill }).updateSkill('skill-1', {
      name: 'Пошиття 2',
    });
    expect(updated.groupId).toBe('group-1');
    expect(updated.name).toBe('Пошиття 2');
  });

  it('moves a registry-coded skill onto an active custom group after ungroup', async () => {
    const custom = groupRow({
      id: 'group-custom',
      code: 'group_abc123def456',
      name: 'Виробництво',
    });
    const skill = skillRow({ code: 'sewing', groupId: null });
    const { service, lockOrder } = makeHarness({
      skill,
      groups: [groupRow(), custom],
    });
    const updated = await service.updateSkill('skill-1', {
      groupId: 'group-custom',
    });
    expect(updated.groupId).toBe('group-custom');
    expect(lockOrder).toEqual(['group:group-custom', 'skill:skill-1']);
    expect(lockOrder).not.toContain('group:group-1');
  });

  it('locks only the target group on move', async () => {
    const target = groupRow({ id: 'group-2', code: 'OFFICE', name: 'Офіс' });
    const { service, lockOrder } = makeHarness({
      groups: [groupRow(), target],
    });
    await service.updateSkill('skill-1', { groupId: 'group-2' });
    expect(lockOrder).toEqual(['group:group-2', 'skill:skill-1']);
    expect(lockOrder).not.toContain('group:group-1');
  });

  it('re-enables a grouped skill without groupId by locking Group then Skill', async () => {
    const skill = skillRow({ isActive: false, groupId: 'group-1' });
    const { service, lockOrder } = makeHarness({ skill });
    const updated = await service.updateSkill('skill-1', { isActive: true });
    expect(updated.isActive).toBe(true);
    expect(lockOrder).toEqual(['group:group-1', 'skill:skill-1']);
  });

  it('rejects re-enable when membership changed between pre-read and Skill lock', async () => {
    const preview = skillRow({ isActive: false, groupId: 'group-1' });
    const locked = skillRow({ isActive: false, groupId: 'group-2' });
    const { service, lockOrder } = makeHarness({
      skill: preview,
      skillPreview: preview,
      skillLocked: locked,
      groups: [groupRow(), groupRow({ id: 'group-2', code: 'OFFICE' })],
    });
    await expect(
      service.updateSkill('skill-1', { isActive: true }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(lockOrder[0]).toBe('group:group-1');
    expect(lockOrder).toContain('skill:skill-1');
  });

  it('re-enables an ungrouped skill without locking a group', async () => {
    const skill = skillRow({ isActive: false, groupId: null });
    const { service, lockOrder } = makeHarness({ skill });
    const updated = await service.updateSkill('skill-1', { isActive: true });
    expect(updated.isActive).toBe(true);
    expect(lockOrder).toEqual(['skill:skill-1']);
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

  it('rejects soft-delete group while it has active skills', async () => {
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

  it('rejects soft-delete skill while a requirement exists', async () => {
    const service = makeService({
      requirements: [{ id: 'r1', skillId: 'skill-1', targetLevel: 3 }],
    });
    await expect(service.softDeleteSkill('skill-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
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

describe('SkillsService hard delete', () => {
  it('hard-deletes a skill with no requirements', async () => {
    const skill = skillRow();
    const { service, skillRemove, reqDelete } = makeHarness({
      skill,
      requirements: [],
    });
    await service.hardDeleteSkill('skill-1');
    expect(reqDelete).toHaveBeenCalledWith({ skillId: 'skill-1' });
    expect(skillRemove).toHaveBeenCalled();
  });

  it('bulk-deletes only the target skill requirements', async () => {
    const { service, reqDelete } = makeHarness({
      skill: skillRow({ id: 'skill-1' }),
      skills: [skillRow({ id: 'skill-1' }), skillRow({ id: 'skill-2' })],
      requirements: [
        { id: 'A', skillId: 'skill-1', targetLevel: 1 },
        { id: 'B', skillId: 'skill-1', targetLevel: 2 },
        { id: 'C', skillId: 'skill-2', targetLevel: 3 },
      ],
    });
    await service.hardDeleteSkill('skill-1');
    expect(reqDelete).toHaveBeenCalledWith({ skillId: 'skill-1' });
    expect(reqDelete).not.toHaveBeenCalledWith({ skillId: 'skill-2' });
  });

  it('hard-deletes a group by ungrouping skills then removing the group', async () => {
    const active = skillRow({ id: 's-active', isActive: true, groupId: 'group-1' });
    const inactive = skillRow({
      id: 's-inactive',
      isActive: false,
      groupId: 'group-1',
    });
    const { service, groupRemove, lockOrder } = makeHarness({
      skills: [active, inactive],
      group: groupRow(),
    });
    const spy = jest.spyOn(service, 'assertCanDeactivateGroup');
    await service.hardDeleteGroup('group-1');
    expect(active.groupId).toBeNull();
    expect(inactive.groupId).toBeNull();
    expect(groupRemove).toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    expect(lockOrder[0]).toBe('group:group-1');
  });

  it('hard-deletes an empty group', async () => {
    const { service, groupRemove } = makeHarness({ skills: [] });
    await service.hardDeleteGroup('group-1');
    expect(groupRemove).toHaveBeenCalled();
  });

  it('lockSkill does not 404 when groupId is null', async () => {
    const skill = skillRow({ groupId: null });
    const { service } = makeHarness({ skill });
    const dataSource = (service as unknown as { dataSource: DataSource }).dataSource;
    const row = await dataSource.transaction((manager) =>
      service.lockSkill(manager, 'skill-1'),
    );
    expect(row.groupId).toBeNull();
    expect(row.group).toBeNull();
  });
});

describe('SkillsService attach guards', () => {
  it('allows attach when the skill is ungrouped', () => {
    const service = makeService({});
    expect(() =>
      service.assertSkillAttachable(
        skillRow({ groupId: null, group: null, isActive: true }),
      ),
    ).not.toThrow();
  });

  it('allows attach when the skill group is inactive', () => {
    const service = makeService({});
    expect(() =>
      service.assertSkillAttachable(
        skillRow({
          isActive: true,
          group: groupRow({ isActive: false }),
        }),
      ),
    ).not.toThrow();
  });

  it('rejects attach when the skill is inactive', () => {
    const service = makeService({});
    expect(() =>
      service.assertSkillAttachable(skillRow({ isActive: false })),
    ).toThrow(BadRequestException);
  });
});
