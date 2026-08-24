export type WorkLocationHintState = {
  workLocation: string;
  workLocationTouched: boolean;
  departmentLocationHintApplied: boolean;
};

export function applyDepartmentLocationHint(
  state: WorkLocationHintState,
  departmentLocation: string | null | undefined,
): WorkLocationHintState {
  const hint = departmentLocation?.trim() ?? '';
  if (
    !hint ||
    state.workLocationTouched ||
    state.departmentLocationHintApplied ||
    state.workLocation.trim()
  ) {
    return state;
  }
  return {
    workLocation: hint,
    workLocationTouched: false,
    departmentLocationHintApplied: true,
  };
}

export function markWorkLocationTouched(
  state: WorkLocationHintState,
  value: string,
): WorkLocationHintState {
  return {
    ...state,
    workLocation: value,
    workLocationTouched: true,
  };
}
