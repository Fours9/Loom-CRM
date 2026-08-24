import type { Permission } from '@loom/contracts-auth';
import { Permission as P } from '@loom/contracts-auth';
import type { EmployeeProfileCapabilities } from '@loom/contracts-employees';

export type PeopleProfileTabId =
  | 'data'
  | 'absences'
  | 'documents'
  | 'questionnaires'
  | 'metrics'
  | 'administration'
  | 'later';

export type PeopleProfileTab = {
  id: PeopleProfileTabId;
  label: string;
};

const ALL_TABS: readonly PeopleProfileTab[] = [
  { id: 'data', label: 'Дані працівника' },
  { id: 'absences', label: 'Робота' },
  { id: 'documents', label: 'Документи' },
  { id: 'questionnaires', label: 'Анкети' },
  { id: 'metrics', label: 'Показники' },
  { id: 'administration', label: 'Адміністрування' },
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
      case 'absences':
      case 'metrics':
      case 'later':
        // «Робота» (absences) always hosts «Посада»; schedule subtabs gated in the page.
        return true;
      case 'documents':
        return hasPermission(perms, P.DocumentsView);
      case 'questionnaires':
        return hasPermission(perms, P.QuestionnairesView);
      case 'administration':
        // Currently only hosts the audit timeline; gate with canViewHistory.
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
