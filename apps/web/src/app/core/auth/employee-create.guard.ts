import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from './session.store';
import { whenSessionReady } from './auth.guards';
import { canOpenEmployeeCreate } from '../../shared/employees/can-open-employee-create';

/** Route guard: EmployeesCreate ∧ EmployeesView (Model A). */
export const employeeCreateGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);

  return whenSessionReady(session, () => {
    if (session.status() !== 'authenticated') {
      return router.createUrlTree(['/login']);
    }
    if (!canOpenEmployeeCreate(session)) {
      return router.createUrlTree(['/people']);
    }
    return true;
  });
};
