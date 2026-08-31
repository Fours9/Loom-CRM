import { Module } from '@nestjs/common';
import { AbsencesModule } from '../../modules/absences/absences.module';
import { DocumentsModule } from '../../modules/documents/documents.module';
import { QuestionnairesModule } from '../../modules/questionnaires/questionnaires.module';
import { OrganizationModule } from '../../organization/organization.module';
import { AuditModule } from '../../platform/audit/audit.module';
import { IdentityModule } from '../../platform/identity/identity.module';
import { EmployeeDeletionCoordinator } from './employee-deletion.coordinator';
import { EmployeeDeletionController } from './employee-deletion.controller';

/**
 * Application composition for Employee operational hard-delete.
 * Imports feature modules; Organization must not import Absences/Docs/Q.
 */
@Module({
  imports: [
    OrganizationModule,
    AbsencesModule,
    DocumentsModule,
    QuestionnairesModule,
    IdentityModule,
    AuditModule,
  ],
  providers: [EmployeeDeletionCoordinator],
  controllers: [EmployeeDeletionController],
})
export class EmployeeDeletionModule {}
