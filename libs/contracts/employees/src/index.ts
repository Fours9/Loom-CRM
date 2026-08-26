import type { EntityId } from '@loom/contracts-common';

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

  calendarColor: string | null;
  role: 'employee' | 'department_manager' | 'admin';
  isDepartmentManager: boolean;

  accountStatus?: 'active' | 'deactivated';
  accountEmail?: string;
  mustChangePassword: boolean | null;

  /** Core profile completeness percent (list enrichment). */
  completenessPercent: number;

  createdAt: string;
  updatedAt: string;
};

export type CreateEmployeeRequest = {
  firstName: string;
  lastName: string;
  departmentId?: EntityId | null;
  positionId?: EntityId | null;
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
  accountCreatedAt: string | null;
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

export type EmployeeProfileSections = {
  overview: EmployeeOverviewSection;
  employment: EmployeeEmploymentSection | null;
  contacts: EmployeeContactItem[];
  personal: EmployeePersonalSection | null;
  emergencyContact: EmployeeEmergencyContactItem[] | null;
  importantDates: ImportantDateItem[] | null;
};

export type EmployeeProfileResponse = {
  header: EmployeeProfileHeader;
  sections: EmployeeProfileSections;
  capabilities: EmployeeProfileCapabilities;
  completeness: ProfileCompleteness;
};

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
};

export type UpdateEmploymentAssignmentRequest =
  CreateEmploymentAssignmentRequest;

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

export type EmployeeSkillAssessmentListResponse = {
  items: EmployeeSkillAssessmentItem[];
};
