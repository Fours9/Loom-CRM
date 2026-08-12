import type { EntityId } from '@loom/contracts-common';

/** Stable permission names — part of the API contract. */
export const Permission = {
  EmployeesView: 'employees.view',
  EmployeesCreate: 'employees.create',
  EmployeesEdit: 'employees.edit',
  EmployeesReadPersonal: 'employees.read.personal',
  EmployeesWritePersonal: 'employees.write.personal',
  EmployeesReadEmergency: 'employees.read.emergency_contact',
  EmployeesWriteEmergency: 'employees.write.emergency_contact',
  EmployeesChangeAssignment: 'employees.change_assignment',
  EmployeesChangeStatus: 'employees.change_status',
  EmployeesViewHistory: 'employees.view_history',
  DepartmentsManage: 'departments.manage',
  PositionsManage: 'positions.manage',
  AbsencesCreate: 'absences.create',
  AbsencesApprove: 'absences.approve',
  AbsencesCancel: 'absences.cancel',
  AbsencesCalendarView: 'absences.calendar.view',
  DocumentsView: 'documents.view',
  DocumentsManage: 'documents.manage',
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

export type CurrentUserResponse = {
  id: EntityId;
  email: string;
  role: UserRole;
  permissions: Permission[];
  employeeId: EntityId | null;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  user: CurrentUserResponse;
};
