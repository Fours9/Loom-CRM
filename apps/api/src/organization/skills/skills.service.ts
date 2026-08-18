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
  skillDefinitionByCode,
  validateSkillScaleBounds,
  type SkillScaleKind,
} from '@loom/position-skill-catalog';
import { SkillGroup } from './skill-group.entity';
import { Skill } from './skill.entity';
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

  assertSkillAttachable(skill: Skill): void {
    if (!skill.isActive) {
      throw new BadRequestException('Skill is inactive');
    }
    if (!skill.group || !skill.group.isActive) {
      throw new BadRequestException('Skill group is inactive');
    }
  }

  /**
   * Settings HTTP create: generated immutable `group_<12hex>`.
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

  findSkills(query: {
    all?: boolean;
    groupId?: string;
  } = {}): Promise<Skill[]> {
    const qb = this.skills
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.group', 'group')
      .orderBy('group.sort_order', 'ASC')
      .addOrderBy('s.name', 'ASC');

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

  async lockSkill(
    manager: EntityManager,
    id: string,
  ): Promise<Skill> {
    const row = await manager.getRepository(Skill).findOne({
      where: { id },
      relations: { group: true },
      lock: { mode: 'pessimistic_write' },
    });
    if (!row) throw new NotFoundException('Skill not found');
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

  assertScalePair(kind: SkillScaleKind, scaleMin: number, scaleMax: number): void {
    const check = validateSkillScaleBounds(kind, scaleMin, scaleMax);
    if (!check.ok) throw new BadRequestException(check.error);
  }

  async createSkill(input: {
    groupId: string;
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
      const group = await this.lockGroup(manager, input.groupId);
      this.assertGroupActive(group);
      const skillRepo = manager.getRepository(Skill);

      if (input.code != null && input.code.trim() !== '') {
        const code = input.code.trim();
        if (!isSkillCode(code)) {
          throw new BadRequestException(
            `Skill code must exist in @loom/position-skill-catalog (got "${code}")`,
          );
        }
        const def = skillDefinitionByCode(code);
        if (def && group.code !== def.group) {
          throw new BadRequestException(
            `Skill "${code}" belongs to group ${def.group}, not ${group.code}`,
          );
        }
        const existing = await skillRepo.findOne({ where: { code } });
        if (existing) throw new ConflictException('Skill code already exists');
        return skillRepo.save(
          skillRepo.create({
            groupId: input.groupId,
            code,
            name: input.name.trim(),
            description: input.description ?? null,
            scaleKind,
            scaleMin,
            scaleMax,
            isActive: true,
          }),
        );
      }

      for (let attempt = 0; attempt < GENERATE_CODE_ATTEMPTS; attempt += 1) {
        const code = `skill_${randomBytes(6).toString('hex')}`;
        try {
          return await skillRepo.save(
            skillRepo.create({
              groupId: input.groupId,
              code,
              name: input.name.trim(),
              description: input.description ?? null,
              scaleKind,
              scaleMin,
              scaleMax,
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
      throw new ConflictException('Could not allocate a unique skill code');
    });
  }

  async updateSkill(
    id: string,
    input: Partial<
      Pick<
        Skill,
        | 'groupId'
        | 'name'
        | 'description'
        | 'scaleKind'
        | 'scaleMin'
        | 'scaleMax'
        | 'isActive'
      >
    >,
  ): Promise<Skill> {
    return this.dataSource.transaction(async (manager) => {
      const skillRepo = manager.getRepository(Skill);
      const reqRepo = manager.getRepository(PositionSkillRequirement);
      const row = await this.lockSkill(manager, id);

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
        const groupForEnable = await this.lockGroup(
          manager,
          input.groupId ?? row.groupId,
        );
        this.assertGroupActive(groupForEnable);
        row.isActive = true;
      }

      if (input.groupId !== undefined && input.groupId !== row.groupId) {
        const group = await this.lockGroup(manager, input.groupId);
        this.assertGroupActive(group);
        const def = skillDefinitionByCode(row.code);
        if (def && group.code !== def.group) {
          throw new BadRequestException(
            `Skill "${row.code}" belongs to group ${def.group}, not ${group.code}`,
          );
        }
        row.groupId = input.groupId;
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
}
