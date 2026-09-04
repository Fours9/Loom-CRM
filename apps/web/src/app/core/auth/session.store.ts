import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { CurrentUserResponse, Permission } from '@loom/contracts-auth';
import {
  canAccessSurface,
  hasSurfaceCatalog,
  type SurfaceId,
  type SurfaceSession,
} from '../access/can-access-surface';
import { ApiAvailabilityStore } from '../api/api-availability.store';
import { isNetworkHttpError } from '../api/is-network-http-error';
import { environment } from '../../../environments/environment';

export type SessionStatus = 'initializing' | 'authenticated' | 'anonymous';

export const ACCESS_TOKEN_KEY = 'loom_access_token';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly http = inject(HttpClient);
  private readonly apiAvailability = inject(ApiAvailabilityStore);

  readonly status = signal<SessionStatus>('initializing');
  readonly user = signal<CurrentUserResponse | null>(null);

  readonly surfaces = computed<readonly string[]>(
    () => this.user()?.surfaces ?? [],
  );

  /** System `admin` role or a custom account role flagged is_admin_equivalent. */
  readonly isAdminEquivalent = computed(() => {
    const user = this.user();
    if (!user) return false;
    return user.accountRole?.isAdminEquivalent ?? user.role === 'admin';
  });

  readonly surfaceSession = computed<SurfaceSession>(() => ({
    permissions: this.user()?.permissions ?? [],
    surfaces: this.surfaces(),
    isAdminEquivalent: this.isAdminEquivalent(),
  }));

  /** True once the API ships a surface catalog; before that callers gate on permissions. */
  readonly surfacesReady = computed(() =>
    hasSurfaceCatalog(this.surfaceSession()),
  );

  canAccessSurface(surfaceId: SurfaceId): boolean {
    return canAccessSurface(this.surfaceSession(), surfaceId);
  }

  async initialize(): Promise<void> {
    const token =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(ACCESS_TOKEN_KEY)
        : null;

    if (!token) {
      this.user.set(null);
      this.status.set('anonymous');
      await this.apiAvailability.probe();
      return;
    }

    try {
      const user = await firstValueFrom(
        this.http.get<CurrentUserResponse>(`${environment.apiBaseUrl}/auth/me`),
      );
      this.user.set(user);
      this.status.set('authenticated');
    } catch (err) {
      if (isNetworkHttpError(err)) {
        // Keep token so Retry can restore session after API returns.
        this.user.set(null);
        this.status.set('anonymous');
        this.apiAvailability.markUnreachable();
        return;
      }

      localStorage.removeItem(ACCESS_TOKEN_KEY);
      this.user.set(null);
      this.status.set('anonymous');

      if (err instanceof HttpErrorResponse && err.status === 401) {
        this.apiAvailability.markOk();
      }
    }
  }

  setAuthenticated(user: CurrentUserResponse, token: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    this.user.set(user);
    this.status.set('authenticated');
  }

  logout(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    this.user.set(null);
    this.status.set('anonymous');
  }

  hasPermission(permission: Permission | string): boolean {
    const u = this.user();
    return !!u?.permissions.includes(permission as Permission);
  }

  isGuestModeAllowed(queryGuest: boolean): boolean {
    return environment.allowGuestMode && queryGuest;
  }
}
