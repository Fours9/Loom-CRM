import { Routes } from '@angular/router';
import { ShellComponent } from './layouts/shell.component';
import { LoginPageComponent } from './features/auth/login-page.component';
import { ChangePasswordPageComponent } from './features/auth/change-password-page.component';
import { DashboardPageComponent } from './features/dashboard/dashboard-page.component';
import {
  authGuard,
  changePasswordPageGuard,
  guestGuard,
  mustChangePasswordGuard,
} from './core/auth/auth.guards';
import { Surface } from './core/access/can-access-surface';
import { surfaceGuard } from './core/access/surface.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    component: LoginPageComponent,
  },
  {
    path: 'change-password',
    canActivate: [changePasswordPageGuard],
    component: ChangePasswordPageComponent,
  },
  {
    path: '',
    canActivate: [authGuard, mustChangePasswordGuard],
    component: ShellComponent,
    children: [
      { path: '', component: DashboardPageComponent },
      {
        path: 'people',
        loadChildren: () =>
          import('./features/people/people.routes').then((m) => m.PEOPLE_ROUTES),
      },
      {
        path: 'positions',
        canActivate: [surfaceGuard(Surface.RoutePositions)],
        loadChildren: () =>
          import('./features/positions/positions.routes').then(
            (m) => m.POSITIONS_ROUTES,
          ),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('./features/settings/settings.routes').then(
            (m) => m.SETTINGS_ROUTES,
          ),
      },
      {
        path: 'absences',
        loadChildren: () =>
          import('./features/absences/absences.routes').then(
            (m) => m.ABSENCE_ROUTES,
          ),
      },
      {
        path: 'statistics',
        loadChildren: () =>
          import('./features/statistics/statistics.routes').then(
            (m) => m.STATISTICS_ROUTES,
          ),
      },
      {
        path: 'questionnaires',
        loadChildren: () =>
          import('./features/questionnaires/questionnaires.routes').then(
            (m) => m.QUESTIONNAIRE_ROUTES,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
