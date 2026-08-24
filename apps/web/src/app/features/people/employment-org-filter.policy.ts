import type {
  OrganizationCatalogDepartment,
  OrganizationCatalogDirection,
  OrganizationCatalogPosition,
} from '../../core/api/organization-catalog-api.service';

export type EmploymentOrgFilterState = {
  directionId: string | null;
  departmentId: string | null;
  positionId: string | null;
};

export type EmploymentOrgCatalogs = {
  directions: OrganizationCatalogDirection[];
  departments: OrganizationCatalogDepartment[];
  positions: OrganizationCatalogPosition[];
};

export type EmploymentOrgAction =
  | { type: 'selectDirection'; directionId: string | null }
  | { type: 'selectDepartment'; departmentId: string | null }
  | { type: 'selectPosition'; positionId: string | null };

export function reduceEmploymentOrgFilter(
  state: EmploymentOrgFilterState,
  action: EmploymentOrgAction,
  catalogs: EmploymentOrgCatalogs,
): EmploymentOrgFilterState {
  switch (action.type) {
    case 'selectDirection': {
      if (!action.directionId) {
        return { directionId: null, departmentId: null, positionId: null };
      }
      const departmentCompatible =
        state.departmentId != null &&
        catalogs.departments.some(
          (department) =>
            department.id === state.departmentId &&
            department.directionId === action.directionId,
        );
      const positionCompatible =
        state.positionId != null &&
        catalogs.positions.some(
          (position) =>
            position.id === state.positionId &&
            position.directionId === action.directionId,
        );
      return {
        directionId: action.directionId,
        departmentId: departmentCompatible ? state.departmentId : null,
        positionId: positionCompatible ? state.positionId : null,
      };
    }
    case 'selectDepartment': {
      if (!action.departmentId) {
        const currentPosition = state.positionId
          ? catalogs.positions.find((position) => position.id === state.positionId)
          : null;
        return {
          directionId: state.directionId,
          departmentId: null,
          positionId:
            currentPosition?.departmentId === state.departmentId
              ? null
              : state.positionId,
        };
      }
      const department = catalogs.departments.find(
        (item) => item.id === action.departmentId,
      );
      if (!department) {
        return state;
      }
      const positionCompatible =
        state.positionId != null &&
        catalogs.positions.some(
          (position) =>
            position.id === state.positionId &&
            position.departmentId === action.departmentId,
        );
      return {
        directionId: department.directionId,
        departmentId: action.departmentId,
        positionId: positionCompatible ? state.positionId : null,
      };
    }
    case 'selectPosition': {
      if (!action.positionId) {
        return { ...state, positionId: null };
      }
      const position = catalogs.positions.find(
        (item) => item.id === action.positionId,
      );
      if (!position) {
        return state;
      }
      return {
        directionId: position.directionId,
        departmentId: position.departmentId,
        positionId: action.positionId,
      };
    }
  }
}

export function filterDepartmentsForSelection(
  state: EmploymentOrgFilterState,
  departments: OrganizationCatalogDepartment[],
): OrganizationCatalogDepartment[] {
  if (!state.directionId) {
    return departments;
  }
  return departments.filter(
    (department) => department.directionId === state.directionId,
  );
}

export function filterPositionsForSelection(
  state: EmploymentOrgFilterState,
  positions: OrganizationCatalogPosition[],
): OrganizationCatalogPosition[] {
  return positions.filter((position) => {
    if (state.departmentId && position.departmentId !== state.departmentId) {
      return false;
    }
    if (state.directionId && position.directionId !== state.directionId) {
      return false;
    }
    return true;
  });
}
