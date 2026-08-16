import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  isSkillCode,
  skillDefinitionByCode,
} from '@loom/position-skill-catalog';
import { SkillGroup } from './skill-group.entity';
import { Skill } from './skill.entity';

@Injectable()
export class SkillsService {
  constructor(
    @InjectRepository(SkillGroup)
    private readonly groups: Repository<SkillGroup>,
    @InjectRepository(Skill)
    private readonly skills: Repository<Skill>,
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

  async createGroup(input: {
    code: string;
    name: string;
    sortOrder?: number;
  }): Promise<SkillGroup> {
    const code = input.code.trim();
    const existing = await this.groups.findOne({ where: { code } });
    if (existing) throw new ConflictException('Skill group code already exists');
    return this.groups.save(
      this.groups.create({
        code,
        name: input.name.trim(),
        sortOrder: input.sortOrder ?? 0,
        isActive: true,
      }),
    );
  }

  async updateGroup(
    id: string,
    input: Partial<Pick<SkillGroup, 'name' | 'sortOrder' | 'isActive'>>,
  ): Promise<SkillGroup> {
    const row = await this.getGroupOrFail(id);
    if (input.name !== undefined) row.name = input.name;
    if (input.sortOrder !== undefined) row.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) row.isActive = input.isActive;
    return this.groups.save(row);
  }

  async softDeleteGroup(id: string): Promise<void> {
    const row = await this.getGroupOrFail(id);
    row.isActive = false;
    await this.groups.save(row);
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

  async createSkill(input: {
    groupId: string;
    code: string;
    name: string;
    description?: string | null;
    scaleMax?: number;
  }): Promise<Skill> {
    const group = await this.getGroupOrFail(input.groupId);
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
    const existing = await this.skills.findOne({ where: { code } });
    if (existing) throw new ConflictException('Skill code already exists');
    return this.skills.save(
      this.skills.create({
        groupId: input.groupId,
        code,
        name: input.name.trim(),
        description: input.description ?? null,
        scaleMax: input.scaleMax ?? 5,
        isActive: true,
      }),
    );
  }

  async updateSkill(
    id: string,
    input: Partial<
      Pick<Skill, 'groupId' | 'name' | 'description' | 'scaleMax' | 'isActive'>
    >,
  ): Promise<Skill> {
    const row = await this.getSkillOrFail(id);
    if (input.groupId !== undefined && input.groupId !== row.groupId) {
      const group = await this.getGroupOrFail(input.groupId);
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
    if (input.scaleMax !== undefined) row.scaleMax = input.scaleMax;
    if (input.isActive !== undefined) row.isActive = input.isActive;
    return this.skills.save(row);
  }

  async softDeleteSkill(id: string): Promise<void> {
    const row = await this.getSkillOrFail(id);
    row.isActive = false;
    await this.skills.save(row);
  }
}
