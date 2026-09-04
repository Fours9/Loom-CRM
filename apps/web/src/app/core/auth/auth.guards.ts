import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
  ActivatedRouteSnapshot,
} from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';
import { SessionStore } from './session.store';
import {
  changePasswordPageRedirect,
  guestLandingRedirect,
  shellMustChangeRedirect,
} from './auth-session.policy';

/** Wait until session left `initializing`, then require authenticated (or allowed guest). */
export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  const guestRequested = isGuestRequested(route);

  return whenSessionReady(session, () => {
    if (session.status() === 'authenticated') {
      return true;
    }
    if (session.isGuestModeAllowed(guestRequested)) {
      return true;
    }
    return router.createUrlTree(['/login']);
  });
};

/** Shell: authenticated users with the temp-password flag go to /change-password. */
export const mustChangePasswordGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  const guestRequested = isGuestRequested(route);

  return whenSessionReady(session, () => {
    const redirect = shellMustChangeRedirect({
      authenticated: session.status() === 'authenticated',
      guestAllowed: session.isGuestModeAllowed(guestRequested),
      mustChangePassword: session.user()?.mustChangePassword === true,
    });
    return redirect ? router.createUrlTree([redirect]) : true;
  });
};

/** /change-password: JWT required, no must-change guard (would loop). */
export const changePasswordPageGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);

  return whenSessionReady(session, () => {
    const redirect = changePasswordPageRedirect({
      authenticated: session.status() === 'authenticated',
      mustChangePassword: session.user()?.mustChangePassword === true,
    });
    return redirect ? router.createUrlTree([redirect]) : true;
  });
};

export const guestGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);

  return whenSessionReady(session, () => {
    const redirect = guestLandingRedirect({
      authenticated: session.status() === 'authenticated',
      mustChangePassword: session.user()?.mustChangePassword === true,
    });
    return redirect ? router.createUrlTree([redirect]) : true;
  });
};

function isGuestRequested(route: ActivatedRouteSnapshot): boolean {
  return (
    route.queryParamMap.get('guest') === '1' ||
    route.root.queryParamMap.get('guest') === '1'
  );
}

/** Defer a guard decision until the session left `initializing`. */
export function whenSessionReady<T>(
  session: SessionStore,
  resolve: () => T,
): T | Observable<T> {
  if (session.status() !== 'initializing') {
    return resolve();
  }
  return toObservable(session.status).pipe(
    filter((s) => s !== 'initializing'),
    take(1),
    map(() => resolve()),
  );
}
