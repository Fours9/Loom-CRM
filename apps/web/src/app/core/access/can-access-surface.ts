import { Permission } from '@loom/contracts-auth';

/**
 * UI surface catalog (docs/product/access-surfaces.md).
 * Surface = «чи показувати цю частину UI», never an authority to mutate.
 */
export const Surface = {
  NavHome: 'nav.home',
  NavPeople: 'nav.people',
  NavPositions: 'nav.positions',
  NavQuestionnaires: 'nav.questionnaires',
  NavAbsences: 'nav.absences',
  NavStatistics: 'nav.statistics',
  NavSettings: 'nav.settings',
  RoutePositions: 'route.positions',
  PeopleTabData: 'people.tab.data',
  PeopleTabWork: 'people.tab.work',
  PeopleTabDocuments: 'people.tab.documents',
  PeopleTabQuestionnaires: 'people.tab.questionnaires',
  PeopleTabMetrics: 'people.tab.metrics',
  PeopleTabAdministration: 'people.tab.administration',
  PeopleTabLater: 'people.tab.later',
  SettingsAccessRoles: 'settings.access_roles',
} as const;

export type SurfaceId = (typeof Surface)[keyof typeof Surface] | string;

/** Permission-backed surfaces: `visible = hasSurface AND hasPermission`. */
const SURFACE_PERMISSION: Readonly<Record<string, Permission>> = {
  [Surface.NavQuestionnaires]: Permission.QuestionnairesView,
  [Surface.PeopleTabDocuments]: Permission.DocumentsView,
  [Surface.PeopleTabQuestionnaires]: Permission.QuestionnairesView,
};

export type SurfaceSession = {
  permissions: readonly string[];
  surfaces: readonly string[];
  /** System `admin` or a custom role with is_admin_equivalent — bypasses both layers. */
  isAdminEquivalent?: boolean;
};

export function surfacePermission(surfaceId: SurfaceId): Permission | null {
  return SURFACE_PERMISSION[surfaceId] ?? null;
}

/**
 * Surface exposure for the current session.
 * adminEquivalent bypasses surface + permission; otherwise both must hold.
 */
export function canAccessSurface(
  session: SurfaceSession,
  surfaceId: SurfaceId,
): boolean {
  if (session.isAdminEquivalent) return true;
  if (!session.surfaces.includes(surfaceId)) return false;
  const permission = surfacePermission(surfaceId);
  return !permission || session.permissions.includes(permission);
}

/**
 * Surfaces are authoritative only once the API ships them.
 * Empty list = pre-rollout session; callers fall back to permission-only gating.
 */
export function hasSurfaceCatalog(session: SurfaceSession): boolean {
  return session.surfaces.length > 0;
}
