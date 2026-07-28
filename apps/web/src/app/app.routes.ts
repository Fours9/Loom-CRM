import { Routes } from '@angular/router';
import { ShellComponent } from './layouts/shell.component';
import { LoginPageComponent } from './features/auth/login-page.component';
import { DashboardPageComponent } from './features/dashboard/dashboard-page.component';
import { authGuard, guestGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    component: LoginPageComponent,
  },
  {
    path: '',
    canActivate: [authGuard],
    component: ShellComponent,
    children: [
      { path: '', component: DashboardPageComponent },
      {
        path: 'people',
        loadChildren: () =>
          import('./features/people/people.routes').then((m) => m.PEOPLE_ROUTES),
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
    ],
  },
  { path: '**', redirectTo: '' },
];
