import { Company } from '../companies/company.entity';
import { Direction } from '../companies/direction.entity';
import { Department } from '../departments/department.entity';
import { Position } from '../positions/position.entity';

type SelectabilityBlockedReason =
  | 'employee_inactive'
  | 'company_inactive'
  | 'direction_inactive'
  | 'department_inactive'
  | 'position_inactive'
  | 'hierarchy_changed'
  | 'activation_date_conflict'
  | 'work_format_inactive'
  | 'employment_type_inactive';

export function isCompanySelectable(company: Company | null | undefined): boolean {
  return Boolean(company?.isActive);
}

export function isDirectionSelectable(input: {
  direction: Direction | null | undefined;
  company: Company | null | undefined;
}): boolean {
  const { direction, company } = input;
  if (!direction?.isActive) {
    return false;
  }
  // No company parent is valid; only an explicit inactive company blocks.
  if (direction.companyId == null) {
    return true;
  }
  return isCompanySelectable(company);
}

export function isDepartmentSelectable(input: {
  department: Department | null | undefined;
  direction: Direction | null | undefined;
  company: Company | null | undefined;
}): boolean {
  const { department, direction, company } = input;
  return (
    Boolean(department?.isActive) &&
    !department?.isHidden &&
    (department?.directionId == null ||
      isDirectionSelectable({ direction, company }))
  );
}

export function isPositionSelectable(input: {
  position: Position | null | undefined;
  department: Department | null | undefined;
  direction: Direction | null | undefined;
  company: Company | null | undefined;
}): boolean {
  return getPositionBlockedReason(input) == null;
}

export function getPositionBlockedReason(input: {
  position: Position | null | undefined;
  department: Department | null | undefined;
  direction: Direction | null | undefined;
  company: Company | null | undefined;
}): SelectabilityBlockedReason | null {
  const { position, department, direction, company } = input;
  if (!position?.isActive) {
    return 'position_inactive';
  }
  if (position.departmentId != null) {
    if (!department) {
      return 'hierarchy_changed';
    }
    if (!isDepartmentSelectable({ department, direction, company })) {
      if (!department.isActive || department.isHidden) {
        return 'department_inactive';
      }
      if (department.directionId != null && !direction?.isActive) {
        return 'direction_inactive';
      }
      if (
        department.directionId != null &&
        direction?.companyId != null &&
        !company?.isActive
      ) {
        return 'company_inactive';
      }
      return 'hierarchy_changed';
    }
    if (position.directionId !== department.directionId) {
      return 'hierarchy_changed';
    }
  }
  if (position.directionId != null) {
    if (!direction) {
      return 'hierarchy_changed';
    }
    if (!direction.isActive) {
      return 'direction_inactive';
    }
    if (direction.companyId != null && !company?.isActive) {
      return 'company_inactive';
    }
  }
  return null;
}
