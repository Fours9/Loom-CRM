import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { whenSessionReady } from '../auth/auth.guards';
import { SessionStore } from '../auth/session.store';
import type { SurfaceId } from './can-access-surface';

/**
 * Route-level surface gate. Redirects to the dashboard when the surface is not exposed.
 * Pre-rollout sessions (no surface catalog) pass through — permissions still guard the API.
 */
export function surfaceGuard(surfaceId: SurfaceId): CanActivateFn {
  return () => {
    const session = inject(SessionStore);
    const router = inject(Router);

    return whenSessionReady(session, () => {
      if (!session.surfacesReady()) return true;
      return session.canAccessSurface(surfaceId) ? true : router.createUrlTree(['/']);
    });
  };
}
