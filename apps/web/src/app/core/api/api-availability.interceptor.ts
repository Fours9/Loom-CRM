import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap, catchError, throwError } from 'rxjs';
import { ApiAvailabilityStore } from '../api/api-availability.store';

/** status 0 = network / CORS / offline API; never treat 401 as unreachable. */
export const apiAvailabilityInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(ApiAvailabilityStore);

  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        api.markOk();
      }
    }),
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 0) {
        api.markUnreachable();
      }
      return throwError(() => err);
    }),
  );
};
