import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ACCESS_TOKEN_KEY, SessionStore } from './session.store';
import { kickSessionOnUnauthorized } from './auth-session.policy';

export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  const token =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(ACCESS_TOKEN_KEY)
      : null;
  const outgoing = token
    ? req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      })
    : req;

  return next(outgoing).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        kickSessionOnUnauthorized(req.url, session, router);
      }
      return throwError(() => err);
    }),
  );
};
