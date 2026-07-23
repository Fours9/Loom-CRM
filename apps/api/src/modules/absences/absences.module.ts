import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationModule } from '../../organization/organization.module';
import { AuditModule } from '../../platform/audit/audit.module';
import { NotificationsModule } from '../../platform/notifications/notifications.module';
import { AbsenceRequest } from './absence-request.entity';
import { AbsenceRequestHistory } from './absence-request-history.entity';
import { AbsenceAttachment } from './absence-attachment.entity';
import { AbsenceRequestsService } from './absence-requests.service';
import { AbsenceCalendarService } from './calendar/absence-calendar.service';
import { AbsencesController } from './absences.controller';

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
  ],
  providers: [AbsenceRequestsService, AbsenceCalendarService],
  controllers: [AbsencesController],
  exports: [AbsenceRequestsService, AbsenceCalendarService],
})
export class AbsencesModule {}
