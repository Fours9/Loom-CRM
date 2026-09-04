import { Routes } from '@angular/router';
import { Surface } from '../../core/access/can-access-surface';
import { surfaceGuard } from '../../core/access/surface.guard';
import { SettingsShellComponent } from './settings-shell.component';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    component: SettingsShellComponent,
    children: [
      { path: 'positions', redirectTo: '/positions', pathMatch: 'full' },
      {
        path: 'access-roles',
        canActivate: [surfaceGuard(Surface.SettingsAccessRoles)],
        loadComponent: () =>
          import('./access-roles/access-roles-page.component').then(
            (m) => m.AccessRolesPageComponent,
          ),
      },
    ],
  },
];
