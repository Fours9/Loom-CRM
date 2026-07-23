import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { CurrentUserResponse, Permission } from '@loom/contracts-auth';
import { environment } from '../../../environments/environment';

export type SessionStatus = 'initializing' | 'authenticated' | 'anonymous';

export const ACCESS_TOKEN_KEY = 'loom_access_token';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly http = inject(HttpClient);

  readonly status = signal<SessionStatus>('initializing');
  readonly user = signal<CurrentUserResponse | null>(null);

  async initialize(): Promise<void> {
    const token =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(ACCESS_TOKEN_KEY)
        : null;

    if (!token) {
      this.user.set(null);
      this.status.set('anonymous');
      return;
    }

    try {
      const user = await firstValueFrom(
        this.http.get<CurrentUserResponse>(`${environment.apiBaseUrl}/auth/me`),
      );
      this.user.set(user);
      this.status.set('authenticated');
    } catch {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      this.user.set(null);
      this.status.set('anonymous');
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
