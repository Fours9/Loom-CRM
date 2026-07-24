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

export type ProfileCompleteness = {
  percent: number;
  missingFields: string[];
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
  workEmail: string | null;
  workPhone: string | null;
  workTelegram: string | null;
  completenessPercent: number;
};

export type EmployeeProfileResponse = {
  header: EmployeeProfileHeader;
  sections: Record<string, unknown>;
  capabilities: EmployeeProfileCapabilities;
  completeness: ProfileCompleteness;
};
