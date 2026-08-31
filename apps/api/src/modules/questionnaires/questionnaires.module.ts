import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesModule } from '../../organization/employees/employees.module';
import { PositionCatalogModule } from '../../organization/position-catalog/position-catalog.module';
import { SkillsModule } from '../../organization/skills/skills.module';
import { AuditModule } from '../../platform/audit/audit.module';
import { IdentityModule } from '../../platform/identity/identity.module';
import { NotificationsModule } from '../../platform/notifications/notifications.module';
import { PermissionsModule } from '../../platform/permissions/permissions.module';
import { User } from '../../platform/identity/user.entity';
import { EmployeeContact } from '../../organization/employees/employee-contact.entity';
import { Skill } from '../../organization/skills/skill.entity';
import { QuestionnaireTemplate } from './questionnaire-template.entity';
import { QuestionnaireTemplateVersion } from './questionnaire-template-version.entity';
import { QuestionnaireAssignment } from './questionnaire-assignment.entity';
import { QuestionnaireAssignmentCodeCounter } from './questionnaire-assignment-code-counter.entity';
import { QuestionnaireResponse } from './questionnaire-response.entity';
import { QuestionnaireSubmission } from './questionnaire-submission.entity';
import { QuestionnaireProfileProposal } from './questionnaire-profile-proposal.entity';
import { QuestionnaireAssignmentService } from './questionnaire-assignment.service';
import { QuestionnaireResponseService } from './questionnaire-response.service';
import { QuestionnaireSubmissionService } from './questionnaire-submission.service';
import { QuestionnaireProposalService } from './questionnaire-proposal.service';
import { QuestionnairePositionContextSyncService } from './questionnaire-position-context-sync.service';
import { QuestionnaireContextSkillIdBackfillService } from './assignments/questionnaire-context-skill-id-backfill.service';
import { QuestionnaireSeedService } from './seed/questionnaire-seed.service';
import { QuestionnairesController } from './questionnaires.controller';
import { QuestionnairesErasureFacade } from './questionnaires-erasure.facade';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QuestionnaireTemplate,
      QuestionnaireTemplateVersion,
      QuestionnaireAssignment,
      QuestionnaireAssignmentCodeCounter,
      QuestionnaireResponse,
      QuestionnaireSubmission,
      QuestionnaireProfileProposal,
      EmployeeContact,
      User,
      Skill,
    ]),
    // Feature modules import concrete capabilities — not OrganizationModule aggregator.
    EmployeesModule,
    PositionCatalogModule,
    SkillsModule,
    IdentityModule,
    PermissionsModule,
    AuditModule,
    NotificationsModule,
  ],
  providers: [
    QuestionnaireAssignmentService,
    QuestionnaireResponseService,
    QuestionnaireSubmissionService,
    QuestionnaireProposalService,
    QuestionnairePositionContextSyncService,
    QuestionnaireContextSkillIdBackfillService,
    QuestionnaireSeedService,
    QuestionnairesErasureFacade,
  ],
  controllers: [QuestionnairesController],
  exports: [
    QuestionnaireAssignmentService,
    QuestionnaireProposalService,
    QuestionnaireSeedService,
    QuestionnairesErasureFacade,
  ],
})
export class QuestionnairesModule {}
