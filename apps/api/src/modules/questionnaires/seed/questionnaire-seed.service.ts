import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  schemasStructurallyEqual,
  validateQuestionnaireSchema,
} from '@loom/questionnaire-schema';
import { QuestionnaireTemplate } from '../questionnaire-template.entity';
import { QuestionnaireTemplateVersion } from '../questionnaire-template-version.entity';
import { QuestionnaireAssignment } from '../questionnaire-assignment.entity';
import {
  EMPLOYEE_360_TEMPLATE_CODE,
  EMPLOYEE_360_TEMPLATE_TITLE,
  EMPLOYEE_360_V1_SCHEMA,
} from './employee-360-v1.schema';

@Injectable()
export class QuestionnaireSeedService {
  private readonly logger = new Logger(QuestionnaireSeedService.name);

  constructor(
    @InjectRepository(QuestionnaireTemplate)
    private readonly templates: Repository<QuestionnaireTemplate>,
    @InjectRepository(QuestionnaireTemplateVersion)
    private readonly versions: Repository<QuestionnaireTemplateVersion>,
    @InjectRepository(QuestionnaireAssignment)
    private readonly assignments: Repository<QuestionnaireAssignment>,
  ) {}

  /**
   * Called from ApplicationStartupService (single OnModuleInit).
   * Production: fail-closed if published v1 differs from seed.
   * Non-production: overwrite schema only when assignment count is 0.
   */
  async ensureEmployee360V1(): Promise<void> {
    const validation = validateQuestionnaireSchema(EMPLOYEE_360_V1_SCHEMA);
    if (!validation.ok) {
      throw new Error(
        `Invalid employee-360 seed schema: ${validation.errors.join('; ')}`,
      );
    }

    const isProd = process.env.NODE_ENV === 'production';
    const seedSchema = EMPLOYEE_360_V1_SCHEMA as unknown as Record<
      string,
      unknown
    >;

    let template = await this.templates.findOne({
      where: { code: EMPLOYEE_360_TEMPLATE_CODE },
    });

    if (!template) {
      template = await this.templates.save(
        this.templates.create({
          code: EMPLOYEE_360_TEMPLATE_CODE,
          title: EMPLOYEE_360_TEMPLATE_TITLE,
          type: 'general',
          status: 'published',
        }),
      );
      this.logger.log(`Created questionnaire template ${EMPLOYEE_360_TEMPLATE_CODE}`);
    }

    const existing = await this.versions.findOne({
      where: { templateId: template.id, version: 1 },
    });

    if (!existing) {
      await this.versions.save(
        this.versions.create({
          templateId: template.id,
          version: 1,
          schemaJson: seedSchema,
          publishedAt: new Date(),
        }),
      );
      if (
        template.status !== 'published' ||
        template.title !== EMPLOYEE_360_TEMPLATE_TITLE ||
        template.type !== 'general'
      ) {
        template.status = 'published';
        template.title = EMPLOYEE_360_TEMPLATE_TITLE;
        template.type = 'general';
        await this.templates.save(template);
      }
      this.logger.log('Published employee-360 template version 1');
      return;
    }

    const schemaEqual = schemasStructurallyEqual(
      existing.schemaJson,
      seedSchema,
    );
    const titleOk = template.title === EMPLOYEE_360_TEMPLATE_TITLE;
    const statusOk = template.status === 'published';
    const publishedAtOk = !!existing.publishedAt;
    const typeOk = template.type === 'general';

    if (schemaEqual && titleOk && statusOk && publishedAtOk && typeOk) {
      return;
    }

    // Type is metadata-only (not part of the immutable published schema):
    // safe to normalize in every environment, including production, without
    // tripping the fail-closed check below.
    if (!typeOk) {
      template.type = 'general';
      await this.templates.save(template);
      this.logger.log('Normalized employee-360 template type to general');
    }

    if (schemaEqual && titleOk && statusOk && publishedAtOk) {
      return;
    }

    const assignmentCount = await this.assignments.count({
      where: { templateVersionId: existing.id },
    });

    if (isProd) {
      throw new Error(
        'Published questionnaire employee-360 v1 differs from checked-in seed. ' +
          'Published versions are immutable in production. Create version 2.',
      );
    }

    if (!schemaEqual && assignmentCount > 0) {
      throw new Error(
        `employee-360 v1 schema differs from seed but ${assignmentCount} assignment(s) exist. ` +
          'Run `pnpm questionnaires:reset -- --execute` (non-prod) or publish version 2.',
      );
    }

    if (!schemaEqual && assignmentCount === 0) {
      existing.schemaJson = seedSchema;
      if (!existing.publishedAt) existing.publishedAt = new Date();
      await this.versions.save(existing);
      this.logger.log('Refreshed employee-360 v1 schema_json from seed (0 assignments)');
    }

    if (!titleOk || !statusOk) {
      template.title = EMPLOYEE_360_TEMPLATE_TITLE;
      template.status = 'published';
      await this.templates.save(template);
      this.logger.log('Normalized employee-360 template title/status');
    }

    if (!publishedAtOk) {
      existing.publishedAt = new Date();
      await this.versions.save(existing);
    }
  }
}
