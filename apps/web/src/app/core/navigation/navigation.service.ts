import { Injectable, computed, inject } from '@angular/core';
import { SessionStore } from '../auth/session.store';
import { canAccessSurface } from '../access/can-access-surface';
import {
  APP_NAV_TREE,
  navigationDisplayLabel,
  type AppNavNode,
} from './navigation.model';

export type NavNode = AppNavNode & { label: string };

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly session = inject(SessionStore);

  readonly visibleTree = computed(() => {
    const status = this.session.status();
    const user = this.session.user();
    const surfaceSession = this.session.surfaceSession();
    const useSurfaces = this.session.surfacesReady();

    return APP_NAV_TREE.filter((item) => {
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
    }).map(
      (item): NavNode => ({
        ...item,
        label: navigationDisplayLabel(item),
      }),
    );
  });

  readonly visibleItems = computed(() =>
    this.visibleTree().map((n) => ({ path: n.path, label: n.label })),
  );
}
