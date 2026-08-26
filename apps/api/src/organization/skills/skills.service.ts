import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';
import {
  isSkillCode,
  isSkillScaleKind,
  validateSkillScaleBounds,
  type SkillScaleKind,
} from '@loom/position-skill-catalog';
import { SkillGroup } from './skill-group.entity';
import { Skill } from './skill.entity';
import { EmployeeSkillAssessmentsFacade } from './employee-skill-assessments.facade';
import { PositionSkillRequirement } from '../position-requirements/position-skill-requirement.entity';

const GENERATE_CODE_ATTEMPTS = 8;

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err as QueryFailedError & { driverError?: { code?: string } }).driverError
      ?.code === '23505'
  );
}

@Injectable()
export class SkillsService {
  constructor(
    @InjectRepository(SkillGroup)
    private readonly groups: Repository<SkillGroup>,
    @InjectRepository(Skill)
    private readonly skills: Repository<Skill>,
    @InjectRepository(PositionSkillRequirement)
    private readonly requirements: Repository<PositionSkillRequirement>,
    private readonly assessments: EmployeeSkillAssessmentsFacade,
    private readonly dataSource: DataSource,
  ) {}

  findGroups(all = false): Promise<SkillGroup[]> {
    const where = all ? {} : { isActive: true };
    return this.groups.find({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async getGroupOrFail(id: string): Promise<SkillGroup> {
    const row = await this.groups.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Skill group not found');
    return row;
  }

  async lockGroup(manager: EntityManager, id: string): Promise<SkillGroup> {
    const row = await manager.getRepository(SkillGroup).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!row) throw new NotFoundException('Skill group not found');
    return row;
  }

  async assertCanDeactivateGroup(
    groupId: string,
    manager: EntityManager,
  ): Promise<void> {
    const count = await manager.getRepository(Skill).count({
      where: { groupId, isActive: true },
    });
    if (count > 0) {
      throw new ConflictException(
        'Deactivate all skills in this group before deactivating the group',
      );
    }
  }

  assertGroupActive(group: SkillGroup): void {
    if (!group.isActive) {
      throw new BadRequestException('Skill group is inactive');
    }
  }

  /**
   * Persistence/attach invariant: the skill itself must be active.
   * Group `isActive` is Position Catalog UI availability only — ungrouped
   * and inactive-group skills remain attachable.
   */
  assertSkillAttachable(skill: Skill): void {
    if (!skill.isActive) {
      throw new BadRequestException('Skill is inactive');
    }
  }

  /**
   * Position Catalog Organization UI create: generated immutable `group_<12hex>`.
   * Seeded codes (TECH/BEAUTY/OFFICE) stay migration-only.
   */
  async createCustomGroup(input: {
    name: string;
    sortOrder?: number;
  }): Promise<SkillGroup> {
    const name = input.name.trim();
    const sortOrder = input.sortOrder ?? 0;
    for (let attempt = 0; attempt < GENERATE_CODE_ATTEMPTS; attempt += 1) {
      const code = `group_${randomBytes(6).toString('hex')}`;
      try {
        return await this.groups.save(
          this.groups.create({
            code,
            name,
            sortOrder,
            isActive: true,
          }),
        );
      } catch (err) {
        if (isUniqueViolation(err) && attempt < GENERATE_CODE_ATTEMPTS - 1) {
          continue;
        }
        throw err;
      }
    }
    throw new ConflictException('Could not allocate a unique skill group code');
  }

  async updateGroup(
    id: string,
    input: Partial<Pick<SkillGroup, 'name' | 'sortOrder' | 'isActive'>>,
  ): Promise<SkillGroup> {
    return this.dataSource.transaction(async (manager) => {
      const groupRepo = manager.getRepository(SkillGroup);
      const row = await this.lockGroup(manager, id);
      if (input.name !== undefined) row.name = input.name;
      if (input.sortOrder !== undefined) row.sortOrder = input.sortOrder;
      if (input.isActive === false && row.isActive) {
        await this.assertCanDeactivateGroup(id, manager);
        row.isActive = false;
      } else if (input.isActive === true) {
        row.isActive = true;
      }
      return groupRepo.save(row);
    });
  }

  async softDeleteGroup(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const row = await this.lockGroup(manager, id);
      if (row.isActive) {
        await this.assertCanDeactivateGroup(id, manager);
        row.isActive = false;
        await manager.getRepository(SkillGroup).save(row);
      }
    });
  }

  async ungroupSkills(manager: EntityManager, groupId: string): Promise<void> {
    await manager.getRepository(Skill).update({ groupId }, { groupId: null });
  }

  async hardDeleteGroup(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const row = await this.lockGroup(manager, id);
      await this.ungroupSkills(manager, id);
      await manager.getRepository(SkillGroup).remove(row);
    });
  }

  findSkills(
    query: {
      all?: boolean;
      groupId?: string;
    } = {},
  ): Promise<Skill[]> {
    const qb = this.skills
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.group', 'group')
      .orderBy('group.sort_order', 'ASC')
      .addOrderBy('s.name', 'ASC')
      .addOrderBy('s.id', 'ASC');

    if (!query.all) {
      qb.andWhere('s.is_active = true');
    }
    if (query.groupId) {
      qb.andWhere('s.group_id = :groupId', { groupId: query.groupId });
    }

    return qb.getMany();
  }

  async getSkillOrFail(id: string): Promise<Skill> {
    const row = await this.skills.findOne({
      where: { id },
      relations: { group: true },
    });
    if (!row) throw new NotFoundException('Skill not found');
    return row;
  }

  async getActiveSkillOrFail(id: string): Promise<Skill> {
    const row = await this.getSkillOrFail(id);
    if (!row.isActive) {
      throw new BadRequestException('Skill is inactive');
    }
    return row;
  }

  async lockSkill(manager: EntityManager, id: string): Promise<Skill> {
    // Lock the skill row only. `relations: { group: true }` + pessimistic_write
    // becomes LEFT JOIN … FOR UPDATE, which Postgres rejects (nullable outer join).
    const row = await manager.getRepository(Skill).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!row) throw new NotFoundException('Skill not found');
    if (!row.groupId) {
      row.group = null;
      return row;
    }
    const group = await manager.getRepository(SkillGroup).findOne({
      where: { id: row.groupId },
    });
    if (!group) throw new NotFoundException('Skill group not found');
    row.group = group;
    return row;
  }

  async assertCanDeactivateSkill(
    skillId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(PositionSkillRequirement)
      : this.requirements;
    const count = await repo.count({ where: { skillId } });
    if (count > 0) {
      throw new ConflictException(
        'Detach this skill from all positions before deactivating it',
      );
    }
  }

  /** Hard-delete / scale mutation blocked while any assessments reference the skill. */
  async assertNoAssessmentsBlockingSkillMutation(
    skillId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const count = await this.assessments.countForSkill(skillId, manager);
    if (count > 0) {
      throw new ConflictException(
        'Skill has employee assessments; hard-delete and scale changes are blocked',
      );
    }
  }

  assertScalePair(kind: SkillScaleKind, scaleMin: number, scaleMax: number): void {
    const check = validateSkillScaleBounds(kind, scaleMin, scaleMax);
    if (!check.ok) throw new BadRequestException(check.error);
  }

  async createSkill(input: {
    groupId?: string | null;
    code?: string;
    name: string;
    description?: string | null;
    scaleKind?: SkillScaleKind;
    scaleMin?: number;
    scaleMax?: number;
  }): Promise<Skill> {
    const scaleKind: SkillScaleKind = input.scaleKind ?? 'range';
    if (!isSkillScaleKind(scaleKind)) {
      throw new BadRequestException('scaleKind must be range or percent');
    }
    const scaleMin = input.scaleMin ?? 0;
    const scaleMax = input.scaleMax ?? 5;
    this.assertScalePair(scaleKind, scaleMin, scaleMax);

    return this.dataSource.transaction(async (manager) => {
      const groupId = input.groupId ?? null;
      if (groupId) {
        const group = await this.lockGroup(manager, groupId);
        this.assertGroupActive(group);
      }
      return this.insertSkill(manager, {
        groupId,
        code: input.code,
        name: input.name,
        description: input.description,
        scaleKind,
        scaleMin,
        scaleMax,
      });
    });
  }

  async updateSkill(
    id: string,
    input: Partial<{
      groupId: string | null;
      name: string;
      description: string | null;
      scaleKind: SkillScaleKind;
      scaleMin: number;
      scaleMax: number;
      isActive: boolean;
    }>,
  ): Promise<Skill> {
    return this.dataSource.transaction(async (manager) => {
      const skillRepo = manager.getRepository(Skill);
      const reqRepo = manager.getRepository(PositionSkillRequirement);
      const { row, nextGroup } = await this.lockSkillForUpdate(manager, id, input);

      const nextKind = (input.scaleKind ?? row.scaleKind) as SkillScaleKind;
      const nextMin = input.scaleMin ?? row.scaleMin;
      const nextMax = input.scaleMax ?? row.scaleMax;
      const scaleTouched =
        input.scaleKind !== undefined ||
        input.scaleMin !== undefined ||
        input.scaleMax !== undefined;

      if (scaleTouched) {
        if (!isSkillScaleKind(nextKind)) {
          throw new BadRequestException('scaleKind must be range or percent');
        }
        this.assertScalePair(nextKind, nextMin, nextMax);
        const scaleChanged =
          nextKind !== row.scaleKind ||
          nextMin !== row.scaleMin ||
          nextMax !== row.scaleMax;
        if (scaleChanged) {
          await this.assertNoAssessmentsBlockingSkillMutation(id, manager);
        }
        const reqs = await reqRepo.find({ where: { skillId: id } });
        if (nextKind !== row.scaleKind && reqs.length > 0) {
          throw new ConflictException(
            'Detach this skill from all positions before changing scale kind',
          );
        }
        if (nextKind === row.scaleKind && reqs.length > 0) {
          const outOfRange = reqs.filter(
            (r) => r.targetLevel < nextMin || r.targetLevel > nextMax,
          );
          if (outOfRange.length > 0) {
            throw new ConflictException(
              'Existing position requirements fall outside the new scale bounds',
            );
          }
        }
        row.scaleKind = nextKind;
        row.scaleMin = nextMin;
        row.scaleMax = nextMax;
      }

      if (input.isActive === false && row.isActive) {
        await this.assertCanDeactivateSkill(id, manager);
        row.isActive = false;
      } else if (input.isActive === true && !row.isActive) {
        row.isActive = true;
      }

      if (nextGroup !== undefined) {
        this.applyLiveGroup(row, nextGroup);
      }
      if (input.name !== undefined) row.name = input.name;
      if (input.description !== undefined) row.description = input.description;
      return skillRepo.save(row);
    });
  }

  async softDeleteSkill(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.lockSkill(manager, id);
      await this.assertCanDeactivateSkill(id, manager);
      const row = await manager.getRepository(Skill).findOneByOrFail({ id });
      row.isActive = false;
      await manager.getRepository(Skill).save(row);
    });
  }

  async hardDeleteSkill(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const row = await this.lockSkill(manager, id);
      await this.assertNoAssessmentsBlockingSkillMutation(id, manager);
      await manager.getRepository(PositionSkillRequirement).delete({ skillId: id });
      await manager.getRepository(Skill).remove(row);
    });
  }

  /**
   * Known target group → lock Group then Skill.
   * Re-enable with omitted groupId → pre-read membership, then Group→Skill and revalidate.
   * Ungrouped / ungroup / no group target → lockSkill only.
   *
   * `nextGroup`: `undefined` = leave membership; `null` = ungroup; entity = assign.
   */
  private async lockSkillForUpdate(
    manager: EntityManager,
    id: string,
    input: Partial<{ groupId: string | null; isActive: boolean }>,
  ): Promise<{ row: Skill; nextGroup: SkillGroup | null | undefined }> {
    if (input.groupId === null) {
      return { row: await this.lockSkill(manager, id), nextGroup: null };
    }

    if (typeof input.groupId === 'string') {
      const group = await this.lockGroup(manager, input.groupId);
      this.assertGroupActive(group);
      return { row: await this.lockSkill(manager, id), nextGroup: group };
    }

    const enabling = input.isActive === true;
    if (!enabling) {
      return { row: await this.lockSkill(manager, id), nextGroup: undefined };
    }

    const preview = await manager.getRepository(Skill).findOne({ where: { id } });
    if (!preview) throw new NotFoundException('Skill not found');

    if (preview.groupId) {
      const group = await this.lockGroup(manager, preview.groupId);
      this.assertGroupActive(group);
      const row = await this.lockSkill(manager, id);
      if (row.groupId !== preview.groupId) {
        throw new ConflictException('Skill group changed; retry the update');
      }
      return { row, nextGroup: undefined };
    }

    const row = await this.lockSkill(manager, id);
    if (row.groupId !== null) {
      throw new ConflictException('Skill group changed; retry the update');
    }
    return { row, nextGroup: undefined };
  }

  /** Single write of live classification. TypeORM save() follows `group`, not `groupId` alone. */
  private applyLiveGroup(row: Skill, group: SkillGroup | null): void {
    row.group = group;
    row.groupId = group?.id ?? null;
  }

  private async insertSkill(
    manager: EntityManager,
    input: {
      groupId: string | null;
      code?: string;
      name: string;
      description?: string | null;
      scaleKind: SkillScaleKind;
      scaleMin: number;
      scaleMax: number;
    },
  ): Promise<Skill> {
    const skillRepo = manager.getRepository(Skill);
    const payload = {
      groupId: input.groupId,
      name: input.name.trim(),
      description: input.description ?? null,
      scaleKind: input.scaleKind,
      scaleMin: input.scaleMin,
      scaleMax: input.scaleMax,
      isActive: true,
    };

    if (input.code != null && input.code.trim() !== '') {
      const code = input.code.trim();
      if (!isSkillCode(code)) {
        throw new BadRequestException(
          `Skill code must exist in @loom/position-skill-catalog (got "${code}")`,
        );
      }
      const existing = await skillRepo.findOne({ where: { code } });
      if (existing) throw new ConflictException('Skill code already exists');
      return skillRepo.save(skillRepo.create({ ...payload, code }));
    }

    for (let attempt = 0; attempt < GENERATE_CODE_ATTEMPTS; attempt += 1) {
      const code = `skill_${randomBytes(6).toString('hex')}`;
      try {
        return await skillRepo.save(skillRepo.create({ ...payload, code }));
      } catch (err) {
        if (isUniqueViolation(err) && attempt < GENERATE_CODE_ATTEMPTS - 1) {
          continue;
        }
        throw err;
      }
    }
    throw new ConflictException('Could not allocate a unique skill code');
  }
}
