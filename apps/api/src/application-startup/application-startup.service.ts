import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ApplicationBootstrapService } from '../platform/bootstrap/application-bootstrap.service';
import { QuestionnaireSeedService } from '../modules/questionnaires/seed/questionnaire-seed.service';
import { PrivacySettingsService } from '../modules/absences/privacy/privacy-settings.service';
import { EmploymentAssignmentLifecycleService } from '../organization/employees/employment-assignment-lifecycle.service';

/**
 * Single Nest OnModuleInit composition root.
 * Platform must not import Questionnaires/Absences; domain seeds must not self-init.
 */
@Injectable()
export class ApplicationStartupService implements OnModuleInit {
  private readonly logger = new Logger(ApplicationStartupService.name);

  constructor(
    private readonly platformBootstrap: ApplicationBootstrapService,
    private readonly questionnaireSeed: QuestionnaireSeedService,
    private readonly privacySettings: PrivacySettingsService,
    private readonly employmentLifecycle: EmploymentAssignmentLifecycleService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.platformBootstrap.ensureReady();
    await this.questionnaireSeed.ensureEmployee360V1();
    await this.privacySettings.ensureDefaults();
    await this.employmentLifecycle.activateDueAssignments();
    this.logger.log('Application startup completed');
  }
}
