import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
  ActivatedRouteSnapshot,
} from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs/operators';
import { SessionStore } from './session.store';

/** Wait until session left `initializing`, then require authenticated (or allowed guest). */
export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  const guestRequested =
    route.queryParamMap.get('guest') === '1' ||
    route.root.queryParamMap.get('guest') === '1';

  if (session.status() !== 'initializing') {
    return resolveAccess(session, router, guestRequested);
  }

  return toObservable(session.status).pipe(
    filter((s) => s !== 'initializing'),
    take(1),
    map(() => resolveAccess(session, router, guestRequested)),
  );
};

function resolveAccess(
  session: SessionStore,
  router: Router,
  guestRequested: boolean,
): boolean | ReturnType<Router['createUrlTree']> {
  if (session.status() === 'authenticated') {
    return true;
  }
  if (session.isGuestModeAllowed(guestRequested)) {
    return true;
  }
  return router.createUrlTree(['/login']);
}

export const guestGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);

  if (session.status() !== 'initializing') {
    return session.status() === 'authenticated'
      ? router.createUrlTree(['/'])
      : true;
  }

  return toObservable(session.status).pipe(
    filter((s) => s !== 'initializing'),
    take(1),
    map((s) =>
      s === 'authenticated' ? router.createUrlTree(['/']) : true,
    ),
  );
};
