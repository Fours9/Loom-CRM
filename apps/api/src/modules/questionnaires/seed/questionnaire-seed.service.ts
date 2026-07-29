import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionnaireTemplate } from '../questionnaire-template.entity';
import { QuestionnaireTemplateVersion } from '../questionnaire-template-version.entity';
import {
  EMPLOYEE_360_TEMPLATE_CODE,
  EMPLOYEE_360_TEMPLATE_TITLE,
  EMPLOYEE_360_V1_SCHEMA,
} from './employee-360-v1.schema';

@Injectable()
export class QuestionnaireSeedService implements OnModuleInit {
  private readonly logger = new Logger(QuestionnaireSeedService.name);

  constructor(
    @InjectRepository(QuestionnaireTemplate)
    private readonly templates: Repository<QuestionnaireTemplate>,
    @InjectRepository(QuestionnaireTemplateVersion)
    private readonly versions: Repository<QuestionnaireTemplateVersion>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureEmployee360V1();
  }

  async ensureEmployee360V1(): Promise<void> {
    let template = await this.templates.findOne({
      where: { code: EMPLOYEE_360_TEMPLATE_CODE },
    });

    if (!template) {
      template = await this.templates.save(
        this.templates.create({
          code: EMPLOYEE_360_TEMPLATE_CODE,
          title: EMPLOYEE_360_TEMPLATE_TITLE,
          status: 'published',
        }),
      );
      this.logger.log(`Created questionnaire template ${EMPLOYEE_360_TEMPLATE_CODE}`);
    } else if (template.status !== 'published') {
      template.status = 'published';
      template.title = EMPLOYEE_360_TEMPLATE_TITLE;
      await this.templates.save(template);
    }

    const existing = await this.versions.findOne({
      where: { templateId: template.id, version: 1 },
    });
    if (existing) {
      existing.schemaJson = EMPLOYEE_360_V1_SCHEMA as unknown as Record<
        string,
        unknown
      >;
      await this.versions.save(existing);
      return;
    }

    await this.versions.save(
      this.versions.create({
        templateId: template.id,
        version: 1,
        schemaJson: EMPLOYEE_360_V1_SCHEMA as unknown as Record<string, unknown>,
        publishedAt: new Date(),
      }),
    );
    this.logger.log('Published employee-360 template version 1');
  }
}
