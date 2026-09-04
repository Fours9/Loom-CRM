import type { Permission } from '@loom/contracts-auth';
import { Permission as P } from '@loom/contracts-auth';
import type { EmployeeProfileCapabilities } from '@loom/contracts-employees';
import {
  Surface,
  canAccessSurface,
  hasSurfaceCatalog,
  type SurfaceId,
} from '../../core/access/can-access-surface';

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

const TAB_SURFACE: Readonly<Record<PeopleProfileTabId, SurfaceId>> = {
  data: Surface.PeopleTabData,
  absences: Surface.PeopleTabWork,
  documents: Surface.PeopleTabDocuments,
  questionnaires: Surface.PeopleTabQuestionnaires,
  metrics: Surface.PeopleTabMetrics,
  administration: Surface.PeopleTabAdministration,
  later: Surface.PeopleTabLater,
};

function hasPermission(
  permissions: readonly Permission[],
  permission: Permission,
): boolean {
  return permissions.includes(permission);
}

function hasAnyAdministrationCapability(
  caps: EmployeeProfileCapabilities | null | undefined,
): boolean {
  return Boolean(
    caps?.canViewHistory ||
      caps?.canCreateAccount ||
      caps?.canResetPassword ||
      caps?.canManageAccount ||
      caps?.canDeleteEmployee ||
      caps?.canViewAccountDetails ||
      caps?.canEditAccountEmail ||
      caps?.canEditAdminAccess ||
      caps?.canEditVisibilityOverrides,
  );
}

/**
 * Visible People profile tabs from capabilities + session permissions + surfaces.
 * Hide unavailable tabs (do not render disabled).
 *
 * Surfaces win when the session carries a catalog: `metrics` and `administration`
 * become surface-only, `documents` / `questionnaires` stay surface AND permission.
 * Without surfaces (pre-rollout) the legacy permission/capability gating applies.
 */
export function visiblePeopleProfileTabs(input: {
  capabilities: EmployeeProfileCapabilities | null | undefined;
  permissions: readonly Permission[];
  surfaces?: readonly string[];
  isAdminEquivalent?: boolean;
}): readonly PeopleProfileTab[] {
  const caps = input.capabilities;
  const perms = input.permissions;
  const session = {
    permissions: perms,
    surfaces: input.surfaces ?? [],
    isAdminEquivalent: input.isAdminEquivalent,
  };
  const useSurfaces = hasSurfaceCatalog(session);

  return ALL_TABS.filter((tab) => {
    if (useSurfaces) {
      return canAccessSurface(session, TAB_SURFACE[tab.id]);
    }
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
        return hasAnyAdministrationCapability(caps);
      default:
        return false;
    }
  });
}

/** Admin «Акаунт» when any account / hard-delete capability is present. */
export function canShowAccountAdminTab(
  caps: EmployeeProfileCapabilities | null | undefined,
): boolean {
  return Boolean(
    caps?.canCreateAccount ||
      caps?.canResetPassword ||
      caps?.canManageAccount ||
      caps?.canDeleteEmployee ||
      caps?.canViewAccountDetails ||
      caps?.canEditAccountEmail,
  );
}

/** Admin «Роль та допуски» when the account role or visibility overrides are editable. */
export function canShowRoleAccessAdminTab(
  caps: EmployeeProfileCapabilities | null | undefined,
): boolean {
  return Boolean(
    caps?.canEditAdminAccess || caps?.canEditVisibilityOverrides,
  );
}

/** Never activate a non-visible tab; fallback to data. */
export function resolvePeopleProfileTab(
  requested: PeopleProfileTabId,
  visibleTabs: readonly PeopleProfileTab[],
): PeopleProfileTabId {
  return visibleTabs.some((tab) => tab.id === requested) ? requested : 'data';
}
