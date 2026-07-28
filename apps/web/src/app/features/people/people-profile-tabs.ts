import type { Permission } from '@loom/contracts-auth';
import { Permission as P } from '@loom/contracts-auth';
import type { EmployeeProfileCapabilities } from '@loom/contracts-employees';

export type PeopleProfileTabId =
  | 'data'
  | 'absences'
  | 'documents'
  | 'metrics'
  | 'history'
  | 'later';

export type PeopleProfileTab = {
  id: PeopleProfileTabId;
  label: string;
};

const ALL_TABS: readonly PeopleProfileTab[] = [
  { id: 'data', label: 'Дані працівника' },
  { id: 'absences', label: 'Робочий графік' },
  { id: 'documents', label: 'Документи' },
  { id: 'metrics', label: 'Показники' },
  { id: 'history', label: 'Історія' },
  { id: 'later', label: 'Згодом' },
];

function hasPermission(
  permissions: readonly Permission[],
  permission: Permission,
): boolean {
  return permissions.includes(permission);
}

/**
 * Visible People profile tabs from capabilities + session permissions.
 * Hide unavailable tabs (do not render disabled).
 */
export function visiblePeopleProfileTabs(input: {
  capabilities: EmployeeProfileCapabilities | null | undefined;
  permissions: readonly Permission[];
}): readonly PeopleProfileTab[] {
  const caps = input.capabilities;
  const perms = input.permissions;

  return ALL_TABS.filter((tab) => {
    switch (tab.id) {
      case 'data':
      case 'metrics':
      case 'later':
        return true;
      case 'absences':
        return hasPermission(perms, P.AbsencesCalendarView);
      case 'documents':
        return hasPermission(perms, P.DocumentsView);
      case 'history':
        return Boolean(caps?.canViewHistory);
      default:
        return false;
    }
  });
}

/** Never activate a non-visible tab; fallback to data. */
export function resolvePeopleProfileTab(
  requested: PeopleProfileTabId,
  visibleTabs: readonly PeopleProfileTab[],
): PeopleProfileTabId {
  return visibleTabs.some((tab) => tab.id === requested) ? requested : 'data';
}
