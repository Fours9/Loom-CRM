import { Injectable, computed, inject } from '@angular/core';
import { Permission } from '@loom/contracts-auth';
import { SessionStore } from '../auth/session.store';

export type NavNode = {
  path: string;
  label: string;
  permission?: Permission;
  hidden?: boolean;
};

const NAV_TREE: NavNode[] = [
  { path: '/', label: 'Головна' },
  { path: '/people', label: 'Працівники', permission: Permission.EmployeesView },
  {
    path: '/absences',
    label: 'Робочий календар',
    permission: Permission.AbsencesCalendarView,
  },
  { path: '/statistics', label: 'Статистика' },
  {
    path: '/settings',
    label: 'Налаштування',
    permission: Permission.SettingsManage,
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
    return NAV_TREE.filter((item) => {
      if (item.hidden) return false;
      if (!item.permission) return true;
      if (status !== 'authenticated' || !user) {
        return (
          item.path === '/people' ||
          item.path === '/absences' ||
          item.path === '/settings'
        );
      }
      return user.permissions.includes(item.permission);
    });
  });

  readonly visibleItems = computed(() =>
    this.visibleTree().map((n) => ({ path: n.path, label: n.label })),
  );
}
