import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';

/**
 * People → Акаунт HTTP boundary (account lifecycle + hard-delete).
 */
@Injectable({ providedIn: 'root' })
export class EmployeeAccountApiService {
  private readonly http = inject(HttpClient);

  attachAccount(
    employeeId: string,
    body: { email: string; temporaryPassword: string },
  ): Observable<unknown> {
    return this.http.post(`/api/v1/employees/${employeeId}/account`, body);
  }

  resetPassword(
    userId: string,
    temporaryPassword: string,
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `/api/v1/auth/reset-password/${userId}`,
      { temporaryPassword },
    );
  }

  updateStatus(
    employeeId: string,
    status: 'active' | 'deactivated',
  ): Observable<unknown> {
    return this.http.patch(`/api/v1/employees/${employeeId}/account/status`, {
      status,
    });
  }

  deleteAccount(employeeId: string): Observable<unknown> {
    return this.http.delete(`/api/v1/employees/${employeeId}/account`);
  }

  /** Hard-delete Employee operational aggregate (204). */
  deleteEmployee(employeeId: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/employees/${employeeId}`);
  }
}
