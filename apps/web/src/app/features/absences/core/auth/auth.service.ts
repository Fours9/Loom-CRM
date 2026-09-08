import { Injectable, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { SessionStore } from '../../../../core/auth/session.store';
import type { AuthUser } from './auth.models';
import type { CurrentUserResponse, Permission } from '@loom/contracts-auth';
import { environment } from '../../../../../environments/environment';
import { ACCESS_TOKEN_KEY } from '../../../../core/auth/session.store';

/** PW-compatible AuthService facade over Loom SessionStore. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  readonly user = computed<AuthUser | null>(() => {
    const u = this.session.user();
    if (!u) return null;
    return this.toAuthUser(u);
  });

  readonly isAuthenticated = computed(
    () => this.session.status() === 'authenticated',
  );

  employeeId(): string | null {
    return this.session.user()?.employeeId ?? null;
  }

  isAdmin(): boolean {
    return this.session.user()?.role === 'admin';
  }

  isManager(): boolean {
    const user = this.session.user();
    return Boolean(
      user &&
        (user.role === 'department_manager' || user.role === 'admin'),
    );
  }

  hasPermission(permission: Permission | string): boolean {
    return this.session.hasPermission(permission);
  }

  me(): Observable<AuthUser> {
    return this.http
      .get<CurrentUserResponse>(`${environment.apiBaseUrl}/auth/me`)
      .pipe(
        tap((raw) => {
          const token =
            typeof localStorage !== 'undefined'
              ? localStorage.getItem(ACCESS_TOKEN_KEY)
              : null;
          if (token) {
            this.session.setAuthenticated(raw, token);
          }
        }),
        map((raw) => this.toAuthUser(raw)),
      );
  }

  logout(): void {
    this.session.logout();
    void this.router.navigateByUrl('/login');
  }

  private toAuthUser(u: CurrentUserResponse): AuthUser {
    return {
      id: u.id,
      email: u.email ?? '',
      role: u.role,
      isDepartmentManager: u.role === 'department_manager',
      status: 'active',
      mustChangePassword: u.mustChangePassword,
      lastLoginAt: null,
      createdAt: '',
      employeeId: u.employeeId,
      accountRole: u.accountRole,
    };
  }
}
