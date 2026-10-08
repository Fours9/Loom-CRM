import { Permission } from '@loom/contracts-auth';
import { Surface } from '../../../core/access/can-access-surface';
import type { AppSurface, PermissionPreset } from './account-roles-api.service';

export const SURFACE_GROUP_LABELS: Readonly<Record<string, string>> = {
  nav: 'Навігація',
  route: 'Маршрути',
  people: 'Профіль працівника',
  settings: 'Налаштування',
  absences: 'Робочий календар',
};

export const PERMISSION_PRESET_LABELS: Readonly<
  Record<PermissionPreset, string>
> = {
  employee: 'Працівник',
  department_manager: 'Менеджер відділу',
  admin: 'Адміністратор',
};

export const PERMISSION_PRESET_OPTIONS: ReadonlyArray<{
  value: PermissionPreset;
  label: string;
}> = (Object.keys(PERMISSION_PRESET_LABELS) as PermissionPreset[]).map(
  (value) => ({ value, label: PERMISSION_PRESET_LABELS[value] }),
);

/** Seed catalog from docs/product/access-surfaces.md — used until the API ships one. */
export const FALLBACK_SURFACE_CATALOG: readonly AppSurface[] = [
  { id: Surface.NavHome, group: 'nav', label: 'Головна' },
  { id: Surface.NavPeople, group: 'nav', label: 'Працівники' },
  { id: Surface.NavPositions, group: 'nav', label: 'Керування посадами' },
  {
    id: Surface.NavQuestionnaires,
    group: 'nav',
    label: 'Анкети',
    requiredPermission: Permission.QuestionnairesView,
  },
  { id: Surface.NavAbsences, group: 'nav', label: 'Робочий календар' },
  { id: Surface.NavStatistics, group: 'nav', label: 'Статистика' },
  { id: Surface.NavSettings, group: 'nav', label: 'Налаштування' },
  {
    id: Surface.AbsencesAdmin,
    group: 'absences',
    label: 'Відсутності — адміністрування',
    requiredPermission: Permission.AbsencesAdmin,
  },
  { id: Surface.RoutePositions, group: 'route', label: 'Сторінка посад' },
  { id: Surface.PeopleTabData, group: 'people', label: 'Дані працівника' },
  { id: Surface.PeopleTabWork, group: 'people', label: 'Робота' },
  {
    id: Surface.PeopleTabDocuments,
    group: 'people',
    label: 'Документи',
    requiredPermission: Permission.DocumentsView,
  },
  {
    id: Surface.PeopleTabQuestionnaires,
    group: 'people',
    label: 'Анкети',
    requiredPermission: Permission.QuestionnairesView,
  },
  { id: Surface.PeopleTabAbout, group: 'people', label: 'Про себе' },
  { id: Surface.PeopleTabMetrics, group: 'people', label: 'Показники' },
  {
    id: Surface.PeopleTabAdministration,
    group: 'people',
    label: 'Адміністрування',
  },
  { id: Surface.PeopleTabLater, group: 'people', label: 'Згодом (зарезервовано)' },
  { id: Surface.SettingsAccessRoles, group: 'settings', label: 'Доступи' },
];

export type SurfaceGroupVm = {
  group: string;
  label: string;
  surfaces: AppSurface[];
};

export function groupSurfaces(
  surfaces: readonly AppSurface[],
): SurfaceGroupVm[] {
  const byGroup = new Map<string, AppSurface[]>();
  for (const surface of surfaces) {
    const rows = byGroup.get(surface.group) ?? [];
    rows.push(surface);
    byGroup.set(surface.group, rows);
  }
  return [...byGroup.entries()].map(([group, rows]) => ({
    group,
    label: SURFACE_GROUP_LABELS[group] ?? group,
    surfaces: rows,
  }));
}
