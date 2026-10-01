import { Permission } from '@loom/contracts-auth';
import type { SurfaceId } from '../access/can-access-surface';
import { Surface } from '../access/can-access-surface';

export type NavAvailability = 'ready' | 'soon';

/** Shared nav catalog SoT (base labels; UI may append « · незабаром»). */
export type AppNavNode = {
  path: string;
  label: string;
  permission?: Permission;
  surface?: SurfaceId;
  hidden?: boolean;
  availability?: NavAvailability;
};

export const APP_NAV_TREE: readonly AppNavNode[] = [
  { path: '/', label: 'Головна', surface: Surface.NavHome },
  {
    path: '/people',
    label: 'Працівники',
    permission: Permission.EmployeesView,
    surface: Surface.NavPeople,
  },
  {
    path: '/positions',
    label: 'Керування посадами',
    permission: Permission.PositionsManage,
    surface: Surface.NavPositions,
  },
  {
    path: '/questionnaires',
    label: 'Анкети',
    permission: Permission.QuestionnairesView,
    surface: Surface.NavQuestionnaires,
  },
  {
    path: '/absences',
    label: 'Робочий календар',
    permission: Permission.AbsencesCalendarView,
    surface: Surface.NavAbsences,
  },
  {
    path: '/statistics',
    label: 'Статистика',
    availability: 'soon',
    surface: Surface.NavStatistics,
  },
  {
    path: '/settings',
    label: 'Налаштування',
    permission: Permission.SettingsManage,
    surface: Surface.NavSettings,
  },
  { path: '/recruitment', label: 'Рекрутинг', hidden: true },
  { path: '/tasks', label: 'Завдання', hidden: true },
  { path: '/documents', label: 'Документи', hidden: true },
];

/** Base label from catalog (no soon suffix). */
export function navigationLabel(path: string): string {
  const node = APP_NAV_TREE.find((n) => n.path === path);
  return node?.label ?? path;
}

/** Label shown in shell nav (appends soon badge when needed). */
export function navigationDisplayLabel(
  node: Pick<AppNavNode, 'label' | 'availability'>,
): string {
  return node.availability === 'soon' ? `${node.label} · незабаром` : node.label;
}

export function navigationNodeByPath(path: string): AppNavNode | undefined {
  return APP_NAV_TREE.find((n) => n.path === path);
}
