import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import {
  backfillV2ContextSkillIds,
  listV2SkillCodesMissingSkillId,
} from '@loom/contracts-questionnaires';
import { Skill } from '../../../organization/skills/skill.entity';

const logger = new Logger('QuestionnaireContextSkillIdBackfill');

/**
 * Completes pre-skillId V2 freezes by writing `skills.id` from catalog code.
 * Safe to call on every load; no-op when skillIds already present.
 */
@Injectable()
export class QuestionnaireContextSkillIdBackfillService {
  constructor(
    @InjectRepository(Skill)
    private readonly skills: Repository<Skill>,
  ) {}

  async repairContextJson(
    raw: Record<string, unknown> | null | undefined,
    manager?: EntityManager,
  ): Promise<{
    contextJson: Record<string, unknown> | null;
    changed: boolean;
  }> {
    if (raw == null) {
      return { contextJson: null, changed: false };
    }
    const missing = listV2SkillCodesMissingSkillId(raw);
    if (missing.length === 0) {
      return { contextJson: raw, changed: false };
    }

    const skillRepo = manager ? manager.getRepository(Skill) : this.skills;
    const uniqueCodes = [...new Set(missing)];
    const rows = await skillRepo.find({
      where: { code: In(uniqueCodes) },
      select: ['id', 'code'],
    });
    const skillIdByCode = new Map(rows.map((r) => [r.code, r.id]));
    const filled = backfillV2ContextSkillIds(raw, skillIdByCode);
    if (!filled.ok) {
      logger.error(`V2 skillId backfill failed: ${filled.error}`);
      throw new InternalServerErrorException(
        'Questionnaire context is corrupted',
      );
    }
    return { contextJson: filled.value, changed: filled.changed };
  }
}
