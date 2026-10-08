import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { whenSessionReady } from '../auth/auth.guards';
import { SessionStore } from '../auth/session.store';
import type { SurfaceId } from './can-access-surface';

/**
 * Route-level surface gate. Fail-closed when the surface catalog is not ready
 * or the surface is not exposed — redirects to the dashboard.
 */
export function surfaceGuard(surfaceId: SurfaceId): CanActivateFn {
  return () => {
    const session = inject(SessionStore);
    const router = inject(Router);

    return whenSessionReady(session, () => {
      if (!session.surfacesReady()) return router.createUrlTree(['/']);
      return session.canAccessSurface(surfaceId)
        ? true
        : router.createUrlTree(['/']);
    });
  };
}
