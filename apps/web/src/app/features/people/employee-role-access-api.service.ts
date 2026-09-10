import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { UpdateEmployeeAccessSettingsRequest } from '@loom/contracts-employees';
import type { Observable } from 'rxjs';

/** Assignable account role as shown in the People role dropdown. */
export type AccountRoleOption = {
  id: string;
  code: string | null;
  name: string;
  isSystem: boolean;
  isAdminEquivalent: boolean;
};

/**
 * People → Role / access-settings HTTP boundary.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeRoleAccessApiService {
  private readonly http = inject(HttpClient);

  /** Same catalog as Settings «Доступи»; readable by admin-equivalent actors only. */
  listAccountRoles(): Observable<AccountRoleOption[]> {
    return this.http.get<AccountRoleOption[]>('/api/v1/settings/account-roles');
  }

  updateAccessSettings(
    employeeId: string,
    body: UpdateEmployeeAccessSettingsRequest,
  ): Observable<unknown> {
    return this.http.patch(
      `/api/v1/employees/${employeeId}/access-settings`,
      body,
    );
  }
}
