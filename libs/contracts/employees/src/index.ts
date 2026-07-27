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
  probationEndDate: string | null;
  status: string;
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
