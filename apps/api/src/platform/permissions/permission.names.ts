/** Stable permission names — keep in sync with @loom/contracts-auth. */
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
  /** Absences admin privacy page + deletion finalize; pairs with surface absences.admin. */
  AbsencesAdmin: 'absences.admin',
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
