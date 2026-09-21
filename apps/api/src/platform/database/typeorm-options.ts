import { DataSourceOptions } from 'typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { getApplicationConfig } from '../config/application-config';
import { ApplicationSetting } from '../settings/application-setting.entity';
import { BootstrapState } from '../bootstrap/bootstrap-state.entity';
import { User } from '../identity/user.entity';
import { AuditLog } from '../audit/audit-log.entity';
import { Notification } from '../notifications/notification.entity';
import { Department } from '../../organization/departments/department.entity';
import { Position } from '../../organization/positions/position.entity';
import { Employee } from '../../organization/employees/employee.entity';
import { WorkScheduleDay } from '../../organization/employees/work-schedule-day.entity';
import { EmployeeManagedDepartment } from '../../organization/employees/employee-managed-department.entity';
import { EmployeeContact } from '../../organization/employees/employee-contact.entity';
import { EmployeeEmergencyContact } from '../../organization/employees/employee-emergency-contact.entity';
import { EmployeeImportantDate } from '../../organization/employees/employee-important-date.entity';
import { EmploymentAssignment } from '../../organization/employees/employment-assignment.entity';
import { Company } from '../../organization/companies/company.entity';
import { Direction } from '../../organization/companies/direction.entity';
import { WorkFormat } from '../../organization/employment-catalog/work-format.entity';
import { EmploymentType } from '../../organization/employment-catalog/employment-type.entity';
import { SkillGroup } from '../../organization/skills/skill-group.entity';
import { Skill } from '../../organization/skills/skill.entity';
import { EmployeeSkillAssessment } from '../../organization/skills/employee-skill-assessment.entity';
import { PositionSkillRequirement } from '../../organization/position-requirements/position-skill-requirement.entity';
import { PositionDuty } from '../../organization/position-requirements/position-duty.entity';
import { PositionGoalTemplate } from '../../organization/position-requirements/position-goal-template.entity';
import { InitialPlatformBaseline1730000000000 } from './migrations/1730000000000-InitialPlatformBaseline';
import { IdentityAndPlatform1730000001000 } from './migrations/1730000001000-IdentityAndPlatform';
import { OrganizationCore1730000002000 } from './migrations/1730000002000-OrganizationCore';
import { AbsencesModule1730000003000 } from './migrations/1730000003000-AbsencesModule';
import { AbsencesPwParity1730000004000 } from './migrations/1730000004000-AbsencesPwParity';
import { EmployeeProfilePwParity1730000005000 } from './migrations/1730000005000-EmployeeProfilePwParity';
import { WorkSchedulePwParity1730000006000 } from './migrations/1730000006000-WorkSchedulePwParity';
import { EmployeeProfileCore1730000007000 } from './migrations/1730000007000-EmployeeProfileCore';
import { EmployeeImportantDates1730000008000 } from './migrations/1730000008000-EmployeeImportantDates';
import { EmployeeDocuments1730000009000 } from './migrations/1730000009000-EmployeeDocuments';
import { RepairPersonalContactsBackfill1730000010000 } from './migrations/1730000010000-RepairPersonalContactsBackfill';
import { QuestionnairesModule1730000011000 } from './migrations/1730000011000-QuestionnairesModule';
import { QuestionnaireProposalSuperseded1730000012000 } from './migrations/1730000012000-QuestionnaireProposalSuperseded';
import { QuestionnaireClosedAndUpdatedAt1730000013000 } from './migrations/1730000013000-QuestionnaireClosedAndUpdatedAt';
import { QuestionnaireUnattachedAndTypes1730000014000 } from './migrations/1730000014000-QuestionnaireUnattachedAndTypes';
import { QuestionnaireChangeRequestResolution1730000015000 } from './migrations/1730000015000-QuestionnaireChangeRequestResolution';
import { QuestionnaireAssignmentCodeAndComment1730000016000 } from './migrations/1730000016000-QuestionnaireAssignmentCodeAndComment';
import { QuestionnaireTypeTaxonomy1730000017000 } from './migrations/1730000017000-QuestionnaireTypeTaxonomy';
import { QuestionnaireTypeFullCollapse1730000018000 } from './migrations/1730000018000-QuestionnaireTypeFullCollapse';
import { PositionsDirectionId1730000019000 } from './migrations/1730000019000-PositionsDirectionId';
import { PositionSkillCatalog1730000020000 } from './migrations/1730000020000-PositionSkillCatalog';
import { QuestionnaireContextJson1730000021000 } from './migrations/1730000021000-QuestionnaireContextJson';
import { DepartmentBelongsToDirection1730000022000 } from './migrations/1730000022000-DepartmentBelongsToDirection';
import { RestorePositionDirectionId1730000023000 } from './migrations/1730000023000-RestorePositionDirectionId';
import { QuestionnaireAssignmentTitle1730000024000 } from './migrations/1730000024000-QuestionnaireAssignmentTitle';
import { SkillNativeScale1730000025000 } from './migrations/1730000025000-SkillNativeScale';
import { SkillGroupOptional1730000026000 } from './migrations/1730000026000-SkillGroupOptional';
import { EmploymentCatalogsAndAssignmentFields1730000027000 } from './migrations/1730000027000-EmploymentCatalogsAndAssignmentFields';
import { PositionsDepartmentFkAndOrphanCleanup1730000028000 } from './migrations/1730000028000-PositionsDepartmentFkAndOrphanCleanup';
import { NotificationsDismissedAt1730000029000 } from './migrations/1730000029000-NotificationsDismissedAt';
import { EmployeeDocumentFiles1730000030000 } from './migrations/1730000030000-EmployeeDocumentFiles';
import { EmploymentCatalogDescription1730000031000 } from './migrations/1730000031000-EmploymentCatalogDescription';
import { EmploymentAssignmentComment1730000032000 } from './migrations/1730000032000-EmploymentAssignmentComment';
import { EmployeeSkillAssessments1730000033000 } from './migrations/1730000033000-EmployeeSkillAssessments';
import { EmployeeDeletionFkRestrict1730000034000 } from './migrations/1730000034000-EmployeeDeletionFkRestrict';
import { PositionEaManagedDepartments1730000035000 } from './migrations/1730000035000-PositionEaManagedDepartments';
import { EmploymentManagementKind1730000036000 } from './migrations/1730000036000-EmploymentManagementKind';
import { AccountRolesAndSurfaces1730000037000 } from './migrations/1730000037000-AccountRolesAndSurfaces';
import { EmployeeDocumentConfidential1730000038000 } from './migrations/1730000038000-EmployeeDocumentConfidential';
import { QuestionnaireSubmitEqualsClosed1730000039000 } from './migrations/1730000039000-QuestionnaireSubmitEqualsClosed';
import { EmployeeProfileRoleGates1730000040000 } from './migrations/1730000040000-EmployeeProfileRoleGates';
import { PositionManagedDepartment } from '../../organization/positions/position-managed-department.entity';
import { EmploymentAssignmentManagedDepartment } from '../../organization/employees/employment-assignment-managed-department.entity';
import { AppSurface } from '../access-control/app-surface.entity';
import { AccountRole } from '../access-control/account-role.entity';
import { AccountRoleSurface } from '../access-control/account-role-surface.entity';
import { AccountRolePermission } from '../access-control/account-role-permission.entity';
import { AccountRoleQuestionnaireTemplate } from '../access-control/account-role-questionnaire-template.entity';
import { AccountRoleQuestionnaireTemplates1730000041000 } from './migrations/1730000041000-AccountRoleQuestionnaireTemplates';
import { QuestionnaireManageBundleApply1730000042000 } from './migrations/1730000042000-QuestionnaireManageBundleApply';
import { PeopleTabAboutSurface1730000043000 } from './migrations/1730000043000-PeopleTabAboutSurface';
import { EmployeeAbout1730000044000 } from './migrations/1730000044000-EmployeeAbout';
import { EmployeeAbout } from '../../organization/employees/employee-about.entity';

export function getDataSourceOptions(): DataSourceOptions {
  const config = getApplicationConfig();
  return {
    type: 'postgres',
    url: config.databaseUrl,
    // Runtime entities load via autoLoadEntities; Absences must not be imported here
    // (Platform cannot depend on Absences). Migrations still register Absences schema.
    entities: [
      ApplicationSetting,
      BootstrapState,
      User,
      AppSurface,
      AccountRole,
      AccountRoleSurface,
      AccountRolePermission,
      AccountRoleQuestionnaireTemplate,
      AuditLog,
      Notification,
      Department,
      Position,
      PositionManagedDepartment,
      Employee,
      WorkScheduleDay,
      EmployeeManagedDepartment,
      EmployeeContact,
      EmployeeEmergencyContact,
      EmployeeImportantDate,
      EmploymentAssignment,
      EmploymentAssignmentManagedDepartment,
      Company,
      Direction,
      WorkFormat,
      EmploymentType,
      SkillGroup,
      Skill,
      EmployeeSkillAssessment,
      PositionSkillRequirement,
      PositionDuty,
      PositionGoalTemplate,
      EmployeeAbout,
    ],
    migrations: [
      InitialPlatformBaseline1730000000000,
      IdentityAndPlatform1730000001000,
      OrganizationCore1730000002000,
      AbsencesModule1730000003000,
      AbsencesPwParity1730000004000,
      EmployeeProfilePwParity1730000005000,
      WorkSchedulePwParity1730000006000,
      EmployeeProfileCore1730000007000,
      EmployeeImportantDates1730000008000,
      EmployeeDocuments1730000009000,
      RepairPersonalContactsBackfill1730000010000,
      QuestionnairesModule1730000011000,
      QuestionnaireProposalSuperseded1730000012000,
      QuestionnaireClosedAndUpdatedAt1730000013000,
      QuestionnaireUnattachedAndTypes1730000014000,
      QuestionnaireChangeRequestResolution1730000015000,
      QuestionnaireAssignmentCodeAndComment1730000016000,
      QuestionnaireTypeTaxonomy1730000017000,
      QuestionnaireTypeFullCollapse1730000018000,
      PositionsDirectionId1730000019000,
      PositionSkillCatalog1730000020000,
      QuestionnaireContextJson1730000021000,
      DepartmentBelongsToDirection1730000022000,
      RestorePositionDirectionId1730000023000,
      QuestionnaireAssignmentTitle1730000024000,
      SkillNativeScale1730000025000,
      SkillGroupOptional1730000026000,
      EmploymentCatalogsAndAssignmentFields1730000027000,
      PositionsDepartmentFkAndOrphanCleanup1730000028000,
      NotificationsDismissedAt1730000029000,
      EmployeeDocumentFiles1730000030000,
      EmploymentCatalogDescription1730000031000,
      EmploymentAssignmentComment1730000032000,
      EmployeeSkillAssessments1730000033000,
      EmployeeDeletionFkRestrict1730000034000,
      PositionEaManagedDepartments1730000035000,
      EmploymentManagementKind1730000036000,
      AccountRolesAndSurfaces1730000037000,
      EmployeeDocumentConfidential1730000038000,
      QuestionnaireSubmitEqualsClosed1730000039000,
      EmployeeProfileRoleGates1730000040000,
      AccountRoleQuestionnaireTemplates1730000041000,
      QuestionnaireManageBundleApply1730000042000,
      PeopleTabAboutSurface1730000043000,
      EmployeeAbout1730000044000,
    ],
    synchronize: false,
    logging: config.nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
  };
}

export function getTypeOrmModuleOptions(): TypeOrmModuleOptions {
  return {
    ...getDataSourceOptions(),
    autoLoadEntities: true,
  };
}
