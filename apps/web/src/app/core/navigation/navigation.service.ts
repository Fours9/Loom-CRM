import { Injectable, computed, inject } from '@angular/core';
import { Permission } from '@loom/contracts-auth';
import { Surface, canAccessSurface, type SurfaceId } from '../access/can-access-surface';
import { SessionStore } from '../auth/session.store';

export type NavNode = {
  path: string;
  label: string;
  permission?: Permission;
  surface?: SurfaceId;
  hidden?: boolean;
};

const NAV_TREE: NavNode[] = [
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
  { path: '/statistics', label: 'Статистика', surface: Surface.NavStatistics },
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

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly session = inject(SessionStore);

  readonly visibleTree = computed(() => {
    const status = this.session.status();
    const user = this.session.user();
    const surfaceSession = this.session.surfaceSession();
    // Surfaces are authoritative once the API ships them; before that, permissions only.
    const useSurfaces = this.session.surfacesReady();

    return NAV_TREE.filter((item) => {
      if (item.hidden) return false;
      if (status !== 'authenticated' || !user) {
        if (!item.permission) return true;
        return (
          item.path === '/people' ||
          item.path === '/absences' ||
          item.path === '/settings'
        );
      }
      if (useSurfaces && item.surface) {
        return canAccessSurface(surfaceSession, item.surface);
      }
      if (!item.permission) return true;
      return user.permissions.includes(item.permission);
    });
  });

  readonly visibleItems = computed(() =>
    this.visibleTree().map((n) => ({ path: n.path, label: n.label })),
  );
}
