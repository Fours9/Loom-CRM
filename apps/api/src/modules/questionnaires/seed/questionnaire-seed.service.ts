import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  schemasStructurallyEqual,
  validateQuestionnaireSchema,
} from '@loom/questionnaire-schema';
import type { QuestionnaireSchemaJson } from '@loom/contracts-questionnaires';
import type { QuestionnaireType } from '../questionnaire.enums';
import { QuestionnaireTemplate } from '../questionnaire-template.entity';
import { QuestionnaireTemplateVersion } from '../questionnaire-template-version.entity';
import { QuestionnaireAssignment } from '../questionnaire-assignment.entity';
import {
  EMPLOYEE_360_TEMPLATE_CODE,
  EMPLOYEE_360_TEMPLATE_TITLE,
  EMPLOYEE_360_V1_SCHEMA,
} from './employee-360-v1.schema';
import {
  EMPLOYEE_STARTER_TEMPLATE_CODE,
  EMPLOYEE_STARTER_TEMPLATE_TITLE,
  EMPLOYEE_STARTER_V1_SCHEMA,
} from './employee-starter-v1.schema';
import {
  EMPLOYEE_DOCS_TEMPLATE_CODE,
  EMPLOYEE_DOCS_TEMPLATE_TITLE,
  EMPLOYEE_DOCS_V1_SCHEMA,
  EMPLOYEE_MANAGING_TEMPLATE_CODE,
  EMPLOYEE_MANAGING_TEMPLATE_TITLE,
  EMPLOYEE_MANAGING_V1_SCHEMA,
} from './questionnaire-stub-schemas';

type SeedTemplateSpec = {
  code: string;
  title: string;
  type: QuestionnaireType;
  schema: QuestionnaireSchemaJson;
};

/** Align checked-in seed `version` with the published row being written/compared. */
export function schemaForPublishedVersion(
  seed: Record<string, unknown>,
  version: number,
): Record<string, unknown> {
  return { ...seed, version };
}

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
   */
  async ensureEmployee360V1(): Promise<void> {
    await this.ensurePublishedTemplate({
      code: EMPLOYEE_360_TEMPLATE_CODE,
      title: EMPLOYEE_360_TEMPLATE_TITLE,
      type: 'full',
      schema: EMPLOYEE_360_V1_SCHEMA,
    });
    await this.ensurePublishedTemplate({
      code: EMPLOYEE_STARTER_TEMPLATE_CODE,
      title: EMPLOYEE_STARTER_TEMPLATE_TITLE,
      type: 'full',
      schema: EMPLOYEE_STARTER_V1_SCHEMA,
    });
    await this.ensurePublishedTemplate({
      code: EMPLOYEE_MANAGING_TEMPLATE_CODE,
      title: EMPLOYEE_MANAGING_TEMPLATE_TITLE,
      type: 'managing',
      schema: EMPLOYEE_MANAGING_V1_SCHEMA,
    });
    await this.ensurePublishedTemplate({
      code: EMPLOYEE_DOCS_TEMPLATE_CODE,
      title: EMPLOYEE_DOCS_TEMPLATE_TITLE,
      type: 'docs',
      schema: EMPLOYEE_DOCS_V1_SCHEMA,
    });
  }

  private async ensurePublishedTemplate(spec: SeedTemplateSpec): Promise<void> {
    const validation = validateQuestionnaireSchema(spec.schema);
    if (!validation.ok) {
      throw new Error(
        `Invalid ${spec.code} seed schema: ${validation.errors.join('; ')}`,
      );
    }

    const isProd = process.env.NODE_ENV === 'production';
    const seedSchema = spec.schema as unknown as Record<string, unknown>;

    let template = await this.templates.findOne({
      where: { code: spec.code },
    });

    if (!template) {
      template = await this.templates.save(
        this.templates.create({
          code: spec.code,
          title: spec.title,
          type: spec.type,
          status: 'published',
        }),
      );
      this.logger.log(`Created questionnaire template ${spec.code}`);
    }

    const latest = await this.versions.findOne({
      where: { templateId: template.id },
      order: { version: 'DESC' },
    });

    if (!latest) {
      await this.versions.save(
        this.versions.create({
          templateId: template.id,
          version: 1,
          schemaJson: schemaForPublishedVersion(seedSchema, 1),
          publishedAt: new Date(),
        }),
      );
      if (
        template.status !== 'published' ||
        template.title !== spec.title ||
        template.type !== spec.type
      ) {
        template.status = 'published';
        template.title = spec.title;
        template.type = spec.type;
        await this.templates.save(template);
      }
      this.logger.log(`Published ${spec.code} template version 1`);
      return;
    }

    const expectedForLatest = schemaForPublishedVersion(
      seedSchema,
      latest.version,
    );
    const schemaEqual = schemasStructurallyEqual(
      latest.schemaJson,
      expectedForLatest,
    );
    const titleOk = template.title === spec.title;
    const statusOk = template.status === 'published';
    const publishedAtOk = !!latest.publishedAt;
    const typeOk = template.type === spec.type;

    // Type/title/status are metadata-only (not part of immutable published schema).
    if (!typeOk || !titleOk || !statusOk) {
      template.type = spec.type;
      template.title = spec.title;
      template.status = 'published';
      await this.templates.save(template);
      this.logger.log(
        `Normalized ${spec.code} template metadata (type/title/status)`,
      );
    }

    if (schemaEqual) {
      if (!publishedAtOk) {
        latest.publishedAt = new Date();
        await this.versions.save(latest);
      }
      return;
    }

    if (isProd) {
      throw new Error(
        `Published questionnaire ${spec.code} v${latest.version} differs from checked-in seed. ` +
          'Published versions are immutable in production. Create a new version.',
      );
    }

    const assignmentCount = await this.assignments.count({
      where: { templateVersionId: latest.id },
    });

    if (assignmentCount === 0) {
      latest.schemaJson = schemaForPublishedVersion(
        seedSchema,
        latest.version,
      );
      if (!latest.publishedAt) latest.publishedAt = new Date();
      await this.versions.save(latest);
      this.logger.log(
        `Refreshed ${spec.code} v${latest.version} schema_json from seed (0 assignments)`,
      );
      return;
    }

    const next = latest.version + 1;
    await this.versions.save(
      this.versions.create({
        templateId: template.id,
        version: next,
        schemaJson: schemaForPublishedVersion(seedSchema, next),
        publishedAt: new Date(),
      }),
    );
    this.logger.log(
      `Published ${spec.code} template version ${next} (seed drift; ${assignmentCount} assignment(s) on v${latest.version})`,
    );
  }
}
