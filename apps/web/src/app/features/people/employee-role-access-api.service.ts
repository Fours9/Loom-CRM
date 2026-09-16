import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { UpdateEmployeeAccessSettingsRequest } from '@loom/contracts-employees';
import type { Observable } from 'rxjs';

/**
 * People → access-settings mutation boundary.
 * Assignable role catalog SoT: {@link AccountRolesApiService.getAssignableRoles}
 * (`GET /settings/account-roles/assignable`).
 */
@Injectable({ providedIn: 'root' })
export class EmployeeRoleAccessApiService {
  private readonly http = inject(HttpClient);

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
