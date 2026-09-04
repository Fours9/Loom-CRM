import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { FALLBACK_SURFACE_CATALOG } from './surface-catalog';

/** Permission bundle a role starts from; extras are added on top. */
export type PermissionPreset = 'employee' | 'department_manager' | 'admin';

export type AppSurface = {
  id: string;
  group: string;
  label: string;
  requiredPermission?: string | null;
};

/** Wire shape of the API surface catalog. */
type AppSurfaceDto = {
  id: string;
  labelUa: string;
  groupKey: string;
  sortOrder: number;
};

export type AccountRole = {
  id: string;
  /** System roles carry a stable code; custom roles are code-less. */
  code: string | null;
  name: string;
  isSystem: boolean;
  isAdminEquivalent: boolean;
  permissionPreset: PermissionPreset;
  extraPermissions: string[];
  effectivePermissions: string[];
  surfaceIds: string[];
  userCount: number;
  canViewConfidential: boolean;
  grantsConfidentialExplicitly: boolean;
  canEditConfidentialGrant: boolean;
};

export type CreateAccountRoleBody = {
  name: string;
  permissionPreset: PermissionPreset;
  isAdminEquivalent?: boolean;
  extraPermissions?: string[];
  surfaceIds?: string[];
};

export type UpdateAccountRoleBody = Partial<CreateAccountRoleBody>;

const ROLES_URL = '/api/v1/settings/account-roles';

/**
 * Settings «Доступи» HTTP boundary (Platform AccessControl).
 * Role-definition CRUD is adminEquivalent-only on the API.
 */
@Injectable({ providedIn: 'root' })
export class AccountRolesApiService {
  private readonly http = inject(HttpClient);

  getRoles(): Observable<AccountRole[]> {
    return this.http.get<AccountRole[]>(ROLES_URL);
  }

  createRole(body: CreateAccountRoleBody): Observable<AccountRole> {
    return this.http.post<AccountRole>(ROLES_URL, body);
  }

  updateRole(id: string, body: UpdateAccountRoleBody): Observable<AccountRole> {
    return this.http.patch<AccountRole>(`${ROLES_URL}/${id}`, body);
  }

  deleteRole(id: string): Observable<unknown> {
    return this.http.delete(`${ROLES_URL}/${id}`);
  }

  /** Surface catalog; falls back to the documented seed while the endpoint lands. */
  getSurfaces(): Observable<AppSurface[]> {
    return this.http.get<AppSurfaceDto[]>(`${ROLES_URL}/surfaces`).pipe(
      map((rows) =>
        rows.map((row) => ({
          id: row.id,
          group: row.groupKey,
          label: row.labelUa,
        })),
      ),
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          return of([...FALLBACK_SURFACE_CATALOG]);
        }
        return throwError(() => err);
      }),
    );
  }
}
