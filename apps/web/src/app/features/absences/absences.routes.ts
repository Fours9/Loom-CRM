import { Routes } from '@angular/router';
import { Surface } from '../../core/access/can-access-surface';
import { surfaceGuard } from '../../core/access/surface.guard';

/**
 * Full ProjectWeekend UI under /absences — chrome comes from CRM Shell
 * (PW topbar + flyout). `requests/new` before `:id`.
 * Employee create SoT is `/people/new` (ADR 0013).
 */
export const ABSENCE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'employees',
    loadComponent: () =>
      import('./employees/employees-page.component').then(
        (m) => m.EmployeesPageComponent,
      ),
  },
  {
    path: 'employees/new',
    redirectTo: '/people/new',
    pathMatch: 'full',
  },
  {
    path: 'employees/:id',
    loadComponent: () =>
      import('./employees/employee-detail-page.component').then(
        (m) => m.EmployeeDetailPageComponent,
      ),
  },
  {
    path: 'requests',
    loadComponent: () =>
      import('./requests/requests-page.component').then(
        (m) => m.RequestsPageComponent,
      ),
  },
  {
    path: 'requests/new',
    loadComponent: () =>
      import('./requests/request-create-page.component').then(
        (m) => m.RequestCreatePageComponent,
      ),
  },
  {
    path: 'requests/:id',
    loadComponent: () =>
      import('./requests/request-detail-page.component').then(
        (m) => m.RequestDetailPageComponent,
      ),
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./calendar/calendar-page.component').then(
        (m) => m.CalendarPageComponent,
      ),
  },
  {
    path: 'admin',
    canActivate: [surfaceGuard(Surface.AbsencesAdmin)],
    loadComponent: () =>
      import('./admin/admin-page.component').then((m) => m.AdminPageComponent),
  },
];
