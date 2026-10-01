import type { EntityId } from '@loom/contracts-common';

/** Bump when employee profile PDF layout changes. */
export const PROFILE_PDF_TEMPLATE_VERSION = '1.2';

export type EmployeeProfilePrintScheduleDay = {
  weekday: number;
  weekdayLabel: string;
  isWorkingDay: boolean;
  workTime: string | null;
  breakTime: string | null;
};

/** Neutral print DTO for Platform PdfRenderer (no Nest/TypeORM). */
export type EmployeeProfilePrintModel = {
  employeeNumber: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  fullName: string;
  departmentName: string | null;
  positionName: string | null;
  phoneNumber: string | null;
  telegram: string | null;
  email: string | null;
  schedule: EmployeeProfilePrintScheduleDay[] | null;
  comment: string | null;
  generatedAtLabel: string;
  generatedByLabel: string;
  templateVersion: string;
};

export type DepartmentReference = {
  id: EntityId;
  name: string;
};

export type PositionReference = {
  id: EntityId;
  name: string;
};

export type EmployeeSummary = {
  id: EntityId;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  department: DepartmentReference | null;
  position: PositionReference | null;
};

/**
 * Full flat HTTP list/detail base for GET /employees.
 * Matches Organization serializer projection (+ completenessPercent on list).
 */
export type EmployeeListItem = {
  id: EntityId;
  userId: EntityId | null;
  hasAccount: boolean;

  employeeNumber: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  fullName: string;
  photoUrl: string | null;

  phoneNumber: string | null;
  telegram: string | null;
  workEmail: string | null;

  departmentId: EntityId | null;
  departmentName: string | null;
  positionId: EntityId | null;
  positionName: string | null;
  /** Derived display: current EA → position.direction → department.direction. */
  directionId: EntityId | null;
  directionName: string | null;

  calendarColor: string | null;
  /** Legacy compatibility mirror (Employee.role). Prefer accountRole for display. */
  role: 'employee' | 'department_manager' | 'admin';
  isDepartmentManager: boolean;
  /** AccountRole projection when hasAccount; null when no login. */
  accountRole: {
    id: EntityId;
    code: string | null;
    name: string;
    isAdminEquivalent: boolean;
  } | null;

  accountStatus?: 'active' | 'deactivated';
  accountEmail?: string;
  mustChangePassword: boolean | null;

  /** Core profile completeness percent (list enrichment). */
  completenessPercent: number;

  createdAt: string;
  updatedAt: string;
};

/** One weekday row for create / replace schedule (HTTP wire). */
export type EmployeeCreateScheduleDay = {
  weekday: number;
  isWorkingDay?: boolean;
  isDayOff?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  breakStart?: string | null;
  breakEnd?: string | null;
  note?: string | null;
};

/**
 * Full HTTP body for POST /employees.
 * Optional `employeeNumber` is adminEquivalent-only on the API;
 * People UI never sends it. Visibility overrides are not create fields.
 */
export type CreateEmployeeRequest = {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  directionId?: EntityId | null;
  departmentId?: EntityId | null;
  positionId?: EntityId | null;
  employeeNumber?: string;
  calendarColor?: string | null;
  phoneNumber?: string | null;
  telegram?: string | null;
  workEmail?: string | null;
  personalPhoneNumber?: string | null;
  personalTelegram?: string | null;
  personalEmail?: string | null;
  createAccount?: boolean;
  email?: string;
  temporaryPassword?: string;
  /**
   * adminEquivalent; numbering intent even without createAccount.
   * Assigned to User only when createAccount.
   */
  accountRoleId?: EntityId;
  schedule?: EmployeeCreateScheduleDay[];
};

export type CreateEmployeeResponse = {
  id: EntityId;
  openDetail: boolean;
};

export type EmployeeProfileCapabilities = {
  canEditBasic: boolean;
  canEditEmployment: boolean;
  canViewPersonal: boolean;
  canEditPersonal: boolean;
  canViewEmergencyContact: boolean;
  canEditEmergencyContact: boolean;
  canChangeStatus: boolean;
  canExport: boolean;
  canViewHistory: boolean;
  canStartOnboarding: boolean;
  canAssignQuestionnaire: boolean;
  /** Create login when employee has no userId (admin). */
  canCreateAccount: boolean;
  /** Reset password including self when target has account (admin). */
  canResetPassword: boolean;
  /** Activate / deactivate / delete login — not self (admin). */
  canManageAccount: boolean;
  /** Hard-delete Employee operational aggregate — not self (admin). */
  canDeleteEmployee: boolean;
  /** Toggle admin access + view computed non-admin role (admin). */
  canEditAdminAccess: boolean;
  /** Edit visibility overrides (admin). */
  canEditVisibilityOverrides: boolean;
  /** View login email on account panel (admin or owner). */
  canViewAccountDetails: boolean;
  /** Change login email — admin, not self (admin). */
  canEditAccountEmail: boolean;
};

export type ProfileCompletenessSection = {
  weight: number;
  complete: boolean;
};

export type ProfileCompletenessLevel = {
  percent: number;
  incompleteSections: string[];
  sections: Record<string, ProfileCompletenessSection>;
};

export type ProfileCompleteness = {
  core: ProfileCompletenessLevel;
  /** Owner + Admin only; null for managers viewing others (privacy). */
  extended: ProfileCompletenessLevel | null;
};

export type EmployeeProfileHeader = {
  id: EntityId;
  employeeNumber: string;
  displayName: string;
  preferredName: string | null;
  photoUrl: string | null;
  employmentStatus: string;
  department: DepartmentReference | null;
  position: PositionReference | null;
  company: { id: EntityId; name: string } | null;
  direction: { id: EntityId; name: string } | null;
  manager: { id: EntityId; displayName: string } | null;
  hiredAt: string | null;
  userId: EntityId | null;
  hasAccount: boolean;
  accountStatus: 'active' | 'deactivated' | null;
  accountCreatedAt: string | null;
  /** Login email when canViewAccountDetails; otherwise omitted/null. */
  accountEmail?: string | null;
  workEmail: string | null;
  workPhone: string | null;
  workTelegram: string | null;
  completenessPercent: number;
};

export type EmploymentActivationBlockedReason =
  | 'employee_inactive'
  | 'company_inactive'
  | 'direction_inactive'
  | 'department_inactive'
  | 'position_inactive'
  | 'hierarchy_changed'
  | 'activation_date_conflict'
  | 'work_format_inactive'
  | 'employment_type_inactive';

export type ImportantDateItem = {
  id: EntityId;
  title: string;
  startDate: string;
  endDate: string | null;
  priority: number;
};

export type NamedReference = {
  id: EntityId;
  name: string;
};

export type EmployeeOverviewSection = {
  firstName: string;
  lastName: string;
  middleName: string | null;
  preferredName: string | null;
  employmentStatus: string;
  workFormat: string | null;
  probationEndsAt: string | null;
};

export type EmployeeEmploymentSection = {
  id: EntityId;
  companyId: string | null;
  directionId: string | null;
  departmentId: string | null;
  positionId: string | null;
  functionalRole: string | null;
  managerEmployeeId: string | null;
  mentorEmployeeId: string | null;
  hrResponsibleEmployeeId: string | null;
  workLocation: string | null;
  workFormat: string | null;
  employmentType: string | null;
  contractType: string | null;
  startDate: string | null;
  endDate: string | null;
  probationStartDate: string | null;
  probationEndDate: string | null;
  status: string;
  activationBlockedReason: EmploymentActivationBlockedReason | null;
  activationCheckedAt: string | null;
  isDepartmentManager: boolean;
  managedDepartmentIds: EntityId[];
  company: NamedReference | null;
  direction: NamedReference | null;
  department: NamedReference | null;
  position: NamedReference | null;
};

export type EmployeeContactItem = {
  id: EntityId;
  type: string;
  value: string;
  isPrimary: boolean;
  visibility: string;
};

export type EmployeePersonalContactType =
  | 'personal_phone'
  | 'personal_email'
  | 'personal_telegram';

export type PersonalContactWriteItem = {
  type: EmployeePersonalContactType;
  value: string;
  isPrimary?: boolean;
};

export type ReplacePersonalContactsRequest = {
  contacts: PersonalContactWriteItem[];
};

export type EmployeePersonalSection = {
  birthDate: string | null;
  city: string | null;
  preferredLanguage: string | null;
  preferredName: string | null;
  personalPhone: string | null;
  personalEmail: string | null;
  personalTelegram: string | null;
};

export type EmployeeEmergencyContactItem = {
  id: EntityId;
  fullName: string;
  relationship: string | null;
  primaryPhone: string;
  secondaryPhone: string | null;
  priority: number;
  notes: string | null;
};

/** Account role ref (access SoT). requested/effective are equal after ADR 0011 — no leadership rewrite. */
export type EmployeeAccountRoleRef = {
  id: EntityId;
  code: string;
  name: string;
  isAdminEquivalent: boolean;
};

export type EmployeeAccessSection = {
  /** @deprecated derived from an admin-equivalent account role. */
  adminAccess: boolean;
  /** Derived non-admin role from active EA (read-only in UI). */
  computedRole: 'employee' | 'department_manager';
  accountRoleId?: EntityId | null;
  requestedAccountRole?: EmployeeAccountRoleRef | null;
  effectiveAccountRole?: EmployeeAccountRoleRef | null;
  profileVisibilityOverride: string | null;
  absenceVisibilityOverride: string | null;
  showAbsenceTypeToPeersOverride: boolean | null;
};

export type EmployeeProfileSections = {
  overview: EmployeeOverviewSection;
  employment: EmployeeEmploymentSection | null;
  contacts: EmployeeContactItem[];
  personal: EmployeePersonalSection | null;
  emergencyContact: EmployeeEmergencyContactItem[] | null;
  importantDates: ImportantDateItem[] | null;
  /** Present when canEditAdminAccess or canEditVisibilityOverrides. */
  access?: EmployeeAccessSection | null;
};

export type EmployeeProfileResponse = {
  header: EmployeeProfileHeader;
  sections: EmployeeProfileSections;
  capabilities: EmployeeProfileCapabilities;
  completeness: ProfileCompleteness;
};

/** Org leadership carried by a Position template / active EA (ADR 0011). */
export type EmploymentManagementKind = 'none' | 'departments' | 'direction';

export type EmploymentAssignmentHistoryItem = {
  id: EntityId;
  status: string;
  companyId: string | null;
  directionId: string | null;
  departmentId: string | null;
  positionId: string | null;
  functionalRole: string | null;
  managerEmployeeId: string | null;
  mentorEmployeeId: string | null;
  hrResponsibleEmployeeId: string | null;
  workLocation: string | null;
  workFormat: string | null;
  employmentType: string | null;
  contractType: string | null;
  startDate: string | null;
  endDate: string | null;
  probationStartDate: string | null;
  probationEndDate: string | null;
  comment: string | null;
  activationBlockedReason: EmploymentActivationBlockedReason | null;
  activationCheckedAt: string | null;
  /** @deprecated use managementKind. */
  isDepartmentManager: boolean;
  managementKind?: EmploymentManagementKind;
  managedDepartmentIds: EntityId[];
  updatedAt: string;
  department: NamedReference | null;
  position: NamedReference | null;
  company: NamedReference | null;
  direction: NamedReference | null;
};

export type CreateEmploymentAssignmentRequest = {
  directionId?: EntityId | null;
  departmentId?: EntityId | null;
  positionId?: EntityId | null;
  functionalRole?: string | null;
  managerEmployeeId?: EntityId | null;
  mentorEmployeeId?: EntityId | null;
  hrResponsibleEmployeeId?: EntityId | null;
  workLocation?: string | null;
  workFormat?: string | null;
  employmentType?: string | null;
  contractType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  probationStartDate?: string | null;
  probationEndDate?: string | null;
  comment?: string | null;
  /** @deprecated use managementKind. */
  isDepartmentManager?: boolean;
  managementKind?: EmploymentManagementKind;
  managedDepartmentIds?: EntityId[];
};

export type UpdateEmploymentAssignmentRequest =
  CreateEmploymentAssignmentRequest;

export type UpdateEmployeeAccessSettingsRequest = {
  /** @deprecated no standalone admin toggle — assign an admin-equivalent account role. */
  adminAccess?: boolean;
  accountRoleId?: EntityId;
  profileVisibilityOverride?: string | null;
  absenceVisibilityOverride?: string | null;
  showAbsenceTypeToPeersOverride?: boolean | null;
};

export type UpdateEmployeeAccountEmailRequest = {
  email: string;
};

export type UpdateEmployeeEmploymentMetaRequest = {
  hiredAt?: string | null;
};

/** Author of an audit timeline row (null actor = system event). */
export type EmployeeProfileHistoryActor = {
  userId: EntityId;
  label: string;
};

export type EmployeeProfileHistoryItem = {
  id: EntityId;
  action: string;
  summary: string;
  actor: EmployeeProfileHistoryActor | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

/** Confirmed profile skill assessment (People «Матриця навичок»). */
export type EmployeeSkillAssessmentItem = {
  id: EntityId;
  employeeId: EntityId;
  skillId: EntityId;
  assessmentType: 'confirmed' | 'self' | 'manager';
  level: number | null;
  assessedBy: EntityId | null;
  assessedAt: string;
  skill: {
    id: EntityId;
    code: string;
    name: string;
    scaleKind: 'range' | 'percent';
    scaleMin: number;
    scaleMax: number;
  } | null;
};

/** @deprecated Prefer EmployeeSkillMatrixResponse (profile/extra projection). */
export type EmployeeSkillAssessmentListResponse = {
  items: EmployeeSkillAssessmentItem[];
};

export type EmployeeSkillMatrixSkill = {
  id: EntityId;
  code: string;
  name: string;
  scaleKind: 'range' | 'percent';
  scaleMin: number;
  scaleMax: number;
};

export type EmployeeSkillMatrixAssessment = {
  id: EntityId;
  level: number | null;
  assessedBy: EntityId | null;
  assessedAt: string;
};

export type EmployeeSkillMatrixRequirement = {
  targetLevel: number | null;
  required: boolean;
  weight: number | null;
};

/**
 * Profile row: requirement != null, assessment may be null.
 * Extra row: requirement == null, assessment != null.
 */
export type EmployeeSkillMatrixItem = {
  skill: EmployeeSkillMatrixSkill;
  assessment: EmployeeSkillMatrixAssessment | null;
  requirement: EmployeeSkillMatrixRequirement | null;
};

export type EmployeeSkillMatrixResponse = {
  profileItems: EmployeeSkillMatrixItem[];
  extraItems: EmployeeSkillMatrixItem[];
  capabilities: { canEdit: boolean };
};

export type CreateEmployeeSkillAssessmentRequest = {
  skillId: EntityId;
  level?: number | null;
};

export type UpdateEmployeeSkillAssessmentRequest = {
  level: number | null;
};

/**
 * Set / update confirmed level by skillId.
 * - Existing assessment → update level
 * - No assessment + current position requirement → insert confirmed
 * - No assessment + not a requirement → 409 (create via POST extra first)
 */
export type UpsertEmployeeSkillAssessmentRequest = {
  skillId: EntityId;
  level: number | null;
};

/** People «Про себе» — Organization HTTP contract (Profile Core SoT). */
export type PeopleAboutSubtabId =
  | 'family_home'
  | 'celebrations'
  | 'hobbies'
  | 'strengths'
  | 'work_style'
  | 'life_goals';

export type EmployeeAboutFieldOption = {
  value: string;
  labelUa: string;
};

export type EmployeeAboutChildFieldView = {
  key: string;
  labelUa: string;
  valueType: string;
  options?: readonly EmployeeAboutFieldOption[];
  maxLength?: number;
};

export type EmployeeAboutFieldView = {
  key: string;
  labelUa: string;
  valueType: string;
  raw: unknown;
  displayValue: string | null;
  options?: readonly EmployeeAboutFieldOption[];
  /** Catalog children for repeating_group editors (About SoT). */
  children?: readonly EmployeeAboutChildFieldView[];
  maxItems?: number;
};

export type EmployeeAboutSubtabView = {
  id: PeopleAboutSubtabId;
  labelUa: string;
  fields: EmployeeAboutFieldView[];
};

export type EmployeeAboutResponse = {
  answers: Record<string, unknown>;
  subtabs: EmployeeAboutSubtabView[];
  updatedAt: string | null;
  canEdit: boolean;
};

/**
 * PATCH body for one About subtab.
 * `null` value = clear that key.
 */
export type PatchEmployeeAboutSubtabRequest = {
  subtabId: PeopleAboutSubtabId;
  values: Record<string, unknown>;
};
