import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ApplicationBootstrapService } from '../platform/bootstrap/application-bootstrap.service';
import { QuestionnaireSeedService } from '../modules/questionnaires/seed/questionnaire-seed.service';

/**
 * Single Nest OnModuleInit composition root.
 * Platform must not import Questionnaires; Questionnaires seed must not self-init.
 */
@Injectable()
export class ApplicationStartupService implements OnModuleInit {
  private readonly logger = new Logger(ApplicationStartupService.name);

  constructor(
    private readonly platformBootstrap: ApplicationBootstrapService,
    private readonly questionnaireSeed: QuestionnaireSeedService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.platformBootstrap.ensureReady();
    await this.questionnaireSeed.ensureEmployee360V1();
    this.logger.log('Application startup completed');
  }
}
