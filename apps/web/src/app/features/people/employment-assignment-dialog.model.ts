import type { EmploymentAssignmentHistoryItem } from '@loom/contracts-employees';

export type EmploymentAssignmentDialogState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; assignmentId: string };

export const CLOSED_ASSIGNMENT_DIALOG: EmploymentAssignmentDialogState = {
  kind: 'closed',
};

export function openCreateAssignmentDialog(): EmploymentAssignmentDialogState {
  return { kind: 'create' };
}

export function openEditAssignmentDialog(input: {
  assignmentId: string;
}): EmploymentAssignmentDialogState {
  return {
    kind: 'edit',
    assignmentId: input.assignmentId,
  };
}

export function closeAssignmentDialog(): EmploymentAssignmentDialogState {
  return CLOSED_ASSIGNMENT_DIALOG;
}

export function isAssignmentDialogOpen(
  state: EmploymentAssignmentDialogState,
): boolean {
  return state.kind !== 'closed';
}

export function assignmentDialogTitle(
  state: EmploymentAssignmentDialogState,
): string {
  return state.kind === 'edit' ? 'Редагувати призначення' : 'Нове призначення';
}

export function assignmentDialogSubmitLabel(
  state: EmploymentAssignmentDialogState,
): string {
  return state.kind === 'create' ? 'Створити' : 'Зберегти';
}

export type EmploymentAssignmentForm = {
  directionId: string;
  departmentId: string;
  positionId: string;
  workFormat: string;
  workLocation: string;
  employmentType: string;
  startDate: string;
  endDate: string;
  probationStartDate: string;
  probationEndDate: string;
  comment: string;
  isDepartmentManager: boolean;
  managedDepartmentIds: string[];
};

export function emptyEmploymentAssignmentForm(): EmploymentAssignmentForm {
  return {
    directionId: '',
    departmentId: '',
    positionId: '',
    workFormat: '',
    workLocation: '',
    employmentType: '',
    startDate: '',
    endDate: '',
    probationStartDate: '',
    probationEndDate: '',
    comment: '',
    isDepartmentManager: false,
    managedDepartmentIds: [],
  };
}

/** Calendar date in Europe/Kyiv — same zone as API BusinessDateClock. */
export function businessTodayDateOnly(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Fresh create draft: startDate defaults to today (Kyiv). */
export function createEmploymentAssignmentForm(
  now: Date = new Date(),
): EmploymentAssignmentForm {
  return {
    ...emptyEmploymentAssignmentForm(),
    startDate: businessTodayDateOnly(now),
  };
}

export function employmentAssignmentFormFromHistory(
  row: EmploymentAssignmentHistoryItem,
): EmploymentAssignmentForm {
  return {
    directionId: row.directionId || '',
    departmentId: row.departmentId || '',
    positionId: row.positionId || '',
    workFormat: row.workFormat || '',
    workLocation: row.workLocation || '',
    employmentType: row.employmentType || '',
    startDate: row.startDate || '',
    endDate: row.endDate || '',
    probationStartDate: row.probationStartDate || '',
    probationEndDate: row.probationEndDate || '',
    comment: row.comment || '',
    isDepartmentManager: Boolean(row.isDepartmentManager),
    managedDepartmentIds: [...(row.managedDepartmentIds || [])],
  };
}

/** Prefill manager fields from a position template (create flow only). */
export function applyPositionManagerTemplate(
  form: EmploymentAssignmentForm,
  position: {
    isDepartmentManagerTemplate?: boolean;
    managedDepartmentIds?: string[] | null;
    departmentId?: string | null;
  } | null,
): EmploymentAssignmentForm {
  if (!position || !position.isDepartmentManagerTemplate) {
    return {
      ...form,
      isDepartmentManager: false,
      managedDepartmentIds: [],
    };
  }
  const fromTemplate = [...(position.managedDepartmentIds || [])].filter(Boolean);
  const fallbackDept =
    form.departmentId || position.departmentId || '';
  return {
    ...form,
    isDepartmentManager: true,
    managedDepartmentIds:
      fromTemplate.length > 0
        ? fromTemplate
        : fallbackDept
          ? [fallbackDept]
          : [],
  };
}

export function defaultManagedDepartmentsOnEnable(
  managedDepartmentIds: string[],
  departmentId: string,
): string[] {
  if (managedDepartmentIds.length > 0) return [...managedDepartmentIds];
  return departmentId ? [departmentId] : [];
}

export function toEmploymentAssignmentWrite(
  form: EmploymentAssignmentForm,
  mode: 'create' | 'edit',
) {
  const body = {
    directionId: form.directionId || null,
    departmentId: form.departmentId || null,
    positionId: form.positionId || null,
    workFormat: form.workFormat || null,
    workLocation: form.workLocation || null,
    employmentType: form.employmentType || null,
    startDate: form.startDate || null,
    probationStartDate: form.probationStartDate || null,
    probationEndDate: form.probationEndDate || null,
    comment: form.comment || null,
    isDepartmentManager: form.isDepartmentManager,
    managedDepartmentIds: form.isDepartmentManager
      ? [...form.managedDepartmentIds]
      : [],
  };
  if (mode === 'edit') {
    return { ...body, endDate: form.endDate || null };
  }
  return body;
}

export function isArchivalNamedValue(
  value: string,
  catalogNames: readonly string[],
): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !catalogNames.includes(trimmed);
}
