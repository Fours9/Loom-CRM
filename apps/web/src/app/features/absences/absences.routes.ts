import { Routes } from '@angular/router';

/**
 * Full ProjectWeekend UI under /absences — chrome comes from CRM Shell
 * (PW topbar + flyout). `requests/new` and `employees/new` before `:id`.
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
    loadComponent: () =>
      import('./employees/employee-create-page.component').then(
        (m) => m.EmployeeCreatePageComponent,
      ),
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
    loadComponent: () =>
      import('./admin/admin-page.component').then((m) => m.AdminPageComponent),
  },
];
