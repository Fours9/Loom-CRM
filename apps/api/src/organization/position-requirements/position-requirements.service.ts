import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PositionsService } from '../positions/positions.service';
import { SkillsService } from '../skills/skills.service';
import { PositionSkillRequirement } from './position-skill-requirement.entity';
import { PositionDuty } from './position-duty.entity';
import { PositionGoalTemplate } from './position-goal-template.entity';

export type PositionSkillRequirementItem = PositionSkillRequirement & {
  skillCode: string | null;
  skillName: string | null;
  skillScaleMax: number | null;
};

@Injectable()
export class PositionRequirementsService {
  constructor(
    private readonly positions: PositionsService,
    private readonly skillsCatalog: SkillsService,
    @InjectRepository(PositionSkillRequirement)
    private readonly requirements: Repository<PositionSkillRequirement>,
    @InjectRepository(PositionDuty)
    private readonly duties: Repository<PositionDuty>,
    @InjectRepository(PositionGoalTemplate)
    private readonly goalTemplates: Repository<PositionGoalTemplate>,
  ) {}

  async listSkillRequirements(
    positionId: string,
  ): Promise<PositionSkillRequirementItem[]> {
    await this.positions.getOrFail(positionId);
    const rows = await this.requirements.find({
      where: { positionId },
      relations: { skill: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => ({
      ...row,
      skillCode: row.skill?.code ?? null,
      skillName: row.skill?.name ?? null,
      skillScaleMax: row.skill?.scaleMax ?? null,
    }));
  }

  async createSkillRequirement(
    positionId: string,
    input: {
      skillId: string;
      targetLevel?: number;
      required?: boolean;
      weight?: number | null;
    },
  ): Promise<PositionSkillRequirementItem> {
    await this.positions.getOrFail(positionId);
    await this.skillsCatalog.getSkillOrFail(input.skillId);
    const existing = await this.requirements.findOne({
      where: { positionId, skillId: input.skillId },
    });
    if (existing) {
      throw new ConflictException('Skill already required for this position');
    }
    const saved = await this.requirements.save(
      this.requirements.create({
        positionId,
        skillId: input.skillId,
        targetLevel: input.targetLevel ?? 0,
        required: input.required ?? true,
        weight: input.weight ?? null,
      }),
    );
    const found = (await this.listSkillRequirements(positionId)).find(
      (r) => r.id === saved.id,
    );
    return (
      found ?? {
        ...saved,
        skillCode: null,
        skillName: null,
        skillScaleMax: null,
      }
    );
  }

  async updateSkillRequirement(
    positionId: string,
    id: string,
    input: Partial<
      Pick<PositionSkillRequirement, 'skillId' | 'targetLevel' | 'required' | 'weight'>
    >,
  ): Promise<PositionSkillRequirementItem> {
    const row = await this.getRequirementOrFail(positionId, id);
    if (input.skillId !== undefined && input.skillId !== row.skillId) {
      await this.skillsCatalog.getSkillOrFail(input.skillId);
      const clash = await this.requirements.findOne({
        where: { positionId, skillId: input.skillId },
      });
      if (clash && clash.id !== id) {
        throw new ConflictException('Skill already required for this position');
      }
      row.skillId = input.skillId;
    }
    if (input.targetLevel !== undefined) row.targetLevel = input.targetLevel;
    if (input.required !== undefined) row.required = input.required;
    if (input.weight !== undefined) row.weight = input.weight;
    await this.requirements.save(row);
    const found = (await this.listSkillRequirements(positionId)).find(
      (r) => r.id === id,
    );
    if (!found) throw new NotFoundException('Skill requirement not found');
    return found;
  }

  async deleteSkillRequirement(positionId: string, id: string): Promise<void> {
    const row = await this.getRequirementOrFail(positionId, id);
    await this.requirements.remove(row);
  }

  private async getRequirementOrFail(
    positionId: string,
    id: string,
  ): Promise<PositionSkillRequirement> {
    await this.positions.getOrFail(positionId);
    const row = await this.requirements.findOne({ where: { id, positionId } });
    if (!row) throw new NotFoundException('Skill requirement not found');
    return row;
  }

  async listDuties(positionId: string, all = false): Promise<PositionDuty[]> {
    await this.positions.getOrFail(positionId);
    const where: { positionId: string; isActive?: boolean } = { positionId };
    if (!all) where.isActive = true;
    return this.duties.find({
      where,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async createDuty(
    positionId: string,
    input: {
      title: string;
      description?: string | null;
      sortOrder?: number;
    },
  ): Promise<PositionDuty> {
    await this.positions.getOrFail(positionId);
    return this.duties.save(
      this.duties.create({
        positionId,
        title: input.title.trim(),
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
        isActive: true,
      }),
    );
  }

  async updateDuty(
    positionId: string,
    id: string,
    input: Partial<
      Pick<PositionDuty, 'title' | 'description' | 'sortOrder' | 'isActive'>
    >,
  ): Promise<PositionDuty> {
    const row = await this.getDutyOrFail(positionId, id);
    Object.assign(row, input);
    return this.duties.save(row);
  }

  async deleteDuty(positionId: string, id: string): Promise<void> {
    const row = await this.getDutyOrFail(positionId, id);
    row.isActive = false;
    await this.duties.save(row);
  }

  private async getDutyOrFail(
    positionId: string,
    id: string,
  ): Promise<PositionDuty> {
    await this.positions.getOrFail(positionId);
    const row = await this.duties.findOne({ where: { id, positionId } });
    if (!row) throw new NotFoundException('Position duty not found');
    return row;
  }

  async listGoalTemplates(
    positionId: string,
    all = false,
  ): Promise<PositionGoalTemplate[]> {
    await this.positions.getOrFail(positionId);
    const where: { positionId: string; isActive?: boolean } = { positionId };
    if (!all) where.isActive = true;
    return this.goalTemplates.find({
      where,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async createGoalTemplate(
    positionId: string,
    input: {
      goalKind: string;
      title: string;
      description?: string | null;
      sortOrder?: number;
    },
  ): Promise<PositionGoalTemplate> {
    await this.positions.getOrFail(positionId);
    return this.goalTemplates.save(
      this.goalTemplates.create({
        positionId,
        goalKind: input.goalKind,
        title: input.title.trim(),
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
        isActive: true,
      }),
    );
  }

  async updateGoalTemplate(
    positionId: string,
    id: string,
    input: Partial<
      Pick<
        PositionGoalTemplate,
        'goalKind' | 'title' | 'description' | 'sortOrder' | 'isActive'
      >
    >,
  ): Promise<PositionGoalTemplate> {
    const row = await this.getGoalTemplateOrFail(positionId, id);
    Object.assign(row, input);
    return this.goalTemplates.save(row);
  }

  async deleteGoalTemplate(positionId: string, id: string): Promise<void> {
    const row = await this.getGoalTemplateOrFail(positionId, id);
    row.isActive = false;
    await this.goalTemplates.save(row);
  }

  private async getGoalTemplateOrFail(
    positionId: string,
    id: string,
  ): Promise<PositionGoalTemplate> {
    await this.positions.getOrFail(positionId);
    const row = await this.goalTemplates.findOne({
      where: { id, positionId },
    });
    if (!row) throw new NotFoundException('Goal template not found');
    return row;
  }
}
