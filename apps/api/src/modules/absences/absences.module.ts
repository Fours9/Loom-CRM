import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationModule } from '../../organization/organization.module';
import { AuditModule } from '../../platform/audit/audit.module';
import { NotificationsModule } from '../../platform/notifications/notifications.module';
import { ApplicationSettingsModule } from '../../platform/settings/application-settings.module';
import { AbsenceRequest } from './absence-request.entity';
import { AbsenceRequestHistory } from './absence-request-history.entity';
import { AbsenceAttachment } from './absence-attachment.entity';
import { AbsenceRequestsService } from './absence-requests.service';
import { AbsenceCalendarService } from './calendar/absence-calendar.service';
import { AbsencesController } from './absences.controller';
import { AbsencesErasureFacade } from './absences-erasure.facade';
import { PrivacySettingsController } from './privacy/privacy-settings.controller';
import { PrivacySettingsService } from './privacy/privacy-settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AbsenceRequest,
      AbsenceRequestHistory,
      AbsenceAttachment,
    ]),
    OrganizationModule,
    AuditModule,
    NotificationsModule,
    ApplicationSettingsModule,
  ],
  providers: [
    AbsenceRequestsService,
    AbsenceCalendarService,
    AbsencesErasureFacade,
    PrivacySettingsService,
  ],
  controllers: [AbsencesController, PrivacySettingsController],
  exports: [
    AbsenceRequestsService,
    AbsenceCalendarService,
    AbsencesErasureFacade,
    PrivacySettingsService,
  ],
})
export class AbsencesModule {}
