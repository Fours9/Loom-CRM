import type { Permission } from '@loom/contracts-auth';
import { Permission as P } from '@loom/contracts-auth';
import type { EmployeeProfileCapabilities } from '@loom/contracts-employees';
import {
  Surface,
  canAccessSurface,
  type SurfaceId,
} from '../../core/access/can-access-surface';

export type PeopleProfileTabId =
  | 'data'
  | 'absences'
  | 'documents'
  | 'questionnaires'
  | 'about'
  | 'metrics'
  | 'administration';

export type PeopleProfileTab = {
  id: PeopleProfileTabId;
  label: string;
};

const ALL_TABS: readonly PeopleProfileTab[] = [
  { id: 'data', label: 'Дані працівника' },
  { id: 'absences', label: 'Робота' },
  { id: 'documents', label: 'Документи' },
  { id: 'questionnaires', label: 'Анкети' },
  { id: 'about', label: 'Про себе' },
  { id: 'metrics', label: 'Показники' },
  { id: 'administration', label: 'Адміністрування' },
];

/** Shared People tab label SoT for help / other consumers. */
export function peopleProfileTabLabel(id: PeopleProfileTabId): string {
  return ALL_TABS.find((t) => t.id === id)?.label ?? id;
}

const TAB_SURFACE: Readonly<Record<PeopleProfileTabId, SurfaceId>> = {
  data: Surface.PeopleTabData,
  absences: Surface.PeopleTabWork,
  documents: Surface.PeopleTabDocuments,
  questionnaires: Surface.PeopleTabQuestionnaires,
  about: Surface.PeopleTabAbout,
  metrics: Surface.PeopleTabMetrics,
  administration: Surface.PeopleTabAdministration,
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
 * Surfaces win when the session carries a catalog: `metrics`, `administration`,
 * and `about` become surface-only; `documents` / `questionnaires` stay surface AND permission.
 * Without surfaces (pre-rollout) the legacy permission/capability gating applies.
 *
 * Note: `people.tab.later` remains a reserved DB surface; «Згодом» is not a UI tab.
 */
export function visiblePeopleProfileTabs(input: {
  capabilities: EmployeeProfileCapabilities | null | undefined;
  permissions: readonly Permission[];
  surfaces?: readonly string[];
  isAdminEquivalent?: boolean;
}): readonly PeopleProfileTab[] {
  const caps = input.capabilities;
  const perms = input.permissions;
  /** Prefer session-layer `surfaces !== undefined` (empty = zero grants, not pre-rollout). */
  const useSurfaces = input.surfaces !== undefined;
  const session = {
    permissions: perms,
    surfaces: input.surfaces,
    isAdminEquivalent: input.isAdminEquivalent,
  };

  return ALL_TABS.filter((tab) => {
    if (useSurfaces) {
      return canAccessSurface(session, TAB_SURFACE[tab.id]);
    }
    switch (tab.id) {
      case 'data':
      case 'absences':
      case 'metrics':
        return true;
      case 'about':
        // Pre-surface catalog: hide until surfaces ship (fail closed for soft tab).
        return false;
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

/**
 * Never activate a non-visible tab; fallback to data.
 * Unknown / removed ids (e.g. legacy `?tab=later`) resolve to data.
 */
export function resolvePeopleProfileTab(
  requested: string,
  visibleTabs: readonly PeopleProfileTab[],
): PeopleProfileTabId {
  return visibleTabs.some((tab) => tab.id === requested)
    ? (requested as PeopleProfileTabId)
    : 'data';
}

/** Deep-link to a People profile tab via `?tab=` (default / omitted = data). */
export function buildPeopleProfileLink(input: {
  employeeId: string;
  tab?: PeopleProfileTabId;
}): {
  routerLink: string;
  queryParams?: { tab: PeopleProfileTabId };
} {
  const id = input.employeeId.trim();
  const routerLink = `/people/${id}`;
  if (!input.tab || input.tab === 'data') {
    return { routerLink };
  }
  return { routerLink, queryParams: { tab: input.tab } };
}
