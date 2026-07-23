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
