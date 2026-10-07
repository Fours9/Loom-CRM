import type { PwSelectOption } from '../../../shared/ui/pw-select.component';
import type { MultiSelectItem } from './multi-select-list.component';
import { ABSENCE_STATUS_LABELS, ABSENCE_TYPE_LABELS } from '../core/api/labels';
import { requestTypeLabel } from '../core/api/request-view.util';

/** Empty value means “all” / omit singular API param. */
export const ALL_FILTER_VALUE = '';

export function withAllOption(
  options: PwSelectOption[],
  allLabel: string,
): PwSelectOption[] {
  return [{ value: ALL_FILTER_VALUE, label: allLabel }, ...options];
}

export function requestStatusSelectOptions(): PwSelectOption[] {
  return withAllOption(
    [
      { value: 'pending', label: 'Подана' },
      { value: 'approved', label: 'Затверджена' },
      { value: 'completed', label: 'Завершена' },
      { value: 'rejected', label: 'Відхилена' },
      { value: 'cancelled', label: 'Скасована' },
      { value: 'deletion_requested', label: 'Запит на видалення' },
    ],
    'Усі',
  );
}

export function requestTypeSelectOptions(): PwSelectOption[] {
  const keys = Object.keys(ABSENCE_TYPE_LABELS);
  return withAllOption(
    keys.map((t) => ({ value: t, label: requestTypeLabel(t) })),
    'Усі типи',
  );
}

/**
 * Requests list status filter as inclusive multi-select items.
 * Full status-group set (unlike the calendar's two: approved/pending).
 * Empty selection = no constraint ("all").
 */
export function requestStatusMultiSelectItems(): MultiSelectItem[] {
  return Object.entries(ABSENCE_STATUS_LABELS).map(([id, label]) => ({ id, label }));
}

/** Requests list type filter as inclusive multi-select items. */
export function requestTypeMultiSelectItems(): MultiSelectItem[] {
  return Object.keys(ABSENCE_TYPE_LABELS).map((id) => ({
    id,
    label: requestTypeLabel(id),
  }));
}

export function positionSelectOptions(
  positions: Array<{ id: string; name: string }>,
  allLabel = 'Усі посади',
): PwSelectOption[] {
  return withAllOption(
    positions.map((p) => ({ value: p.id, label: p.name })),
    allLabel,
  );
}

export function requestSortSelectOptions(): PwSelectOption[] {
  return [
    { value: 'createdAt', label: 'Створено' },
    { value: 'startDate', label: 'Період' },
    { value: 'employeeName', label: 'Працівник' },
    { value: 'departmentName', label: 'Відділ' },
    { value: 'positionName', label: 'Посада' },
    { value: 'type', label: 'Тип' },
    { value: 'status', label: 'Статус' },
  ];
}

export function employeeSortSelectOptions(): PwSelectOption[] {
  return [
    { value: 'fullName', label: 'ПІБ' },
    { value: 'employeeNumber', label: 'Номер' },
    { value: 'department', label: 'Відділ' },
    { value: 'position', label: 'Посада' },
    { value: 'role', label: 'Роль' },
    { value: 'status', label: 'Статус' },
  ];
}

/** Assign-then-handler pattern for unit tests / documentation. */
export function assignThenHandle<T>(
  assign: (next: T) => void,
  next: T,
  handle: () => void,
): void {
  assign(next);
  handle();
}
