import type { EntityId } from '@loom/contracts-common';

/** Stable permission names — part of the API contract. */
export const Permission = {
  EmployeesView: 'employees.view',
  EmployeesCreate: 'employees.create',
  /** @deprecated Prefer employees.manage_profiles; rejected as new AccountRole extra. */
  EmployeesEdit: 'employees.edit',
  EmployeesManageProfiles: 'employees.manage_profiles',
  EmployeesAssignAccountRole: 'employees.assign_account_role',
  /** Workflow-gate: createAccount=true on POST /employees only — ≠ attach. */
  EmployeesCreateAccountAtCreate: 'employees.create_account_at_create',
  EmployeesReadPersonal: 'employees.read.personal',
  EmployeesWritePersonal: 'employees.write.personal',
  EmployeesReadEmergency: 'employees.read.emergency_contact',
  EmployeesWriteEmergency: 'employees.write.emergency_contact',
  EmployeesChangeAssignment: 'employees.change_assignment',
  EmployeesChangeStatus: 'employees.change_status',
  EmployeesViewHistory: 'employees.view_history',
  DepartmentsManage: 'departments.manage',
  PositionsManage: 'positions.manage',
  DirectionsManage: 'directions.manage',
  AbsencesCreate: 'absences.create',
  AbsencesApprove: 'absences.approve',
  AbsencesCancel: 'absences.cancel',
  AbsencesCalendarView: 'absences.calendar.view',
  DocumentsView: 'documents.view',
  DocumentsManage: 'documents.manage',
  /** Cross-domain classification; ≠ documents.view / documents.manage (ADR 0012). */
  ConfidentialView: 'confidential.view',
  QuestionnairesView: 'questionnaires.view',
  QuestionnairesAssign: 'questionnaires.assign',
  QuestionnairesManageLifecycle: 'questionnaires.manage_lifecycle',
  QuestionnairesDelete: 'questionnaires.delete',
  QuestionnairesCompleteSelf: 'questionnaires.complete.self',
  QuestionnairesCompleteAny: 'questionnaires.complete.any',
  QuestionnairesReview: 'questionnaires.review',
  QuestionnairesApplyProfileChanges: 'questionnaires.apply_profile_changes',
  QuestionnairesReadAssignmentComment:
    'questionnaires.read_assignment_comment',
  SettingsManage: 'settings.manage',
  AuditView: 'audit.view',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export type UserRole = 'employee' | 'department_manager' | 'admin';

/** System account-role codes (ADR 0011). Custom roles use their own code. */
export type AccountRoleCode =
  | 'employee'
  | 'department_manager'
  | 'director'
  | 'admin';

export type CurrentUserAccountRole = {
  id: EntityId;
  code: AccountRoleCode | string;
  name: string;
  isAdminEquivalent: boolean;
};

export type CurrentUserResponse = {
  id: EntityId;
  email: string;
  /** Compatibility mirror of the account role; authZ SoT is permissions + surfaces. */
  role: UserRole;
  permissions: Permission[];
  /** UI surface ids granted by the account role. Absent until the rollout lands. */
  surfaces?: string[];
  /**
   * Opaque questionnaire template codes granted to the account role.
   * Absent / empty = none unless accountRole.isAdminEquivalent.
   */
  questionnaireTemplateCodes?: string[];
  accountRole?: CurrentUserAccountRole;
  employeeId: EntityId | null;
  mustChangePassword: boolean;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  user: CurrentUserResponse;
};
