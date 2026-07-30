import { Module } from '@nestjs/common';
import { ApplicationBootstrapModule } from '../platform/bootstrap/application-bootstrap.module';
import { QuestionnairesModule } from '../modules/questionnaires/questionnaires.module';
import { ApplicationStartupService } from './application-startup.service';

@Module({
  imports: [ApplicationBootstrapModule, QuestionnairesModule],
  providers: [ApplicationStartupService],
})
export class ApplicationStartupModule {}
