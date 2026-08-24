import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  CreateEmploymentAssignmentRequest,
  EmployeeProfileResponse,
  EmploymentAssignmentHistoryItem,
  UpdateEmploymentAssignmentRequest,
} from '@loom/contracts-employees';

/**
 * Single FE write/read entry for employment assignments on a People profile.
 * Presentation components must not call assignment REST paths directly.
 */
@Injectable({ providedIn: 'root' })
export class EmploymentAssignmentsApiService {
  private readonly http = inject(HttpClient);

  create(
    employeeId: string,
    body: CreateEmploymentAssignmentRequest,
  ): Observable<EmployeeProfileResponse> {
    return this.http.post<EmployeeProfileResponse>(
      `/api/v1/employees/${employeeId}/employment-assignments`,
      body,
    );
  }

  update(
    employeeId: string,
    assignmentId: string,
    body: UpdateEmploymentAssignmentRequest,
  ): Observable<EmployeeProfileResponse> {
    return this.http.patch<EmployeeProfileResponse>(
      `/api/v1/employees/${employeeId}/employment-assignments/${assignmentId}`,
      body,
    );
  }

  remove(
    employeeId: string,
    assignmentId: string,
  ): Observable<EmployeeProfileResponse> {
    return this.http.delete<EmployeeProfileResponse>(
      `/api/v1/employees/${employeeId}/employment-assignments/${assignmentId}`,
    );
  }

  listHistory(employeeId: string): Observable<EmploymentAssignmentHistoryItem[]> {
    return this.http.get<EmploymentAssignmentHistoryItem[]>(
      `/api/v1/employees/${employeeId}/employment-history`,
    );
  }
}
