import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type {
  CreateEmployeeSkillAssessmentRequest,
  EmployeeSkillMatrixItem,
  EmployeeSkillMatrixResponse,
  UpsertEmployeeSkillAssessmentRequest,
} from '@loom/contracts-employees';
import type { Observable } from 'rxjs';

/**
 * People → skill matrix HTTP boundary.
 * Keeps the panel free of raw URL / DTO wiring.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeSkillsMatrixApiService {
  private readonly http = inject(HttpClient);

  list(employeeId: string): Observable<EmployeeSkillMatrixResponse> {
    return this.http.get<EmployeeSkillMatrixResponse>(
      `/api/v1/employees/${employeeId}/skill-assessments`,
    );
  }

  /** Add a manual extra (skill ∉ current requirements). */
  createExtra(
    employeeId: string,
    body: CreateEmployeeSkillAssessmentRequest,
  ): Observable<EmployeeSkillMatrixItem> {
    return this.http.post<EmployeeSkillMatrixItem>(
      `/api/v1/employees/${employeeId}/skill-assessments`,
      body,
    );
  }

  /** Set level for a profile requirement (insert if absent) or existing assessment. */
  upsertLevel(
    employeeId: string,
    body: UpsertEmployeeSkillAssessmentRequest,
  ): Observable<EmployeeSkillMatrixItem> {
    return this.http.put<EmployeeSkillMatrixItem>(
      `/api/v1/employees/${employeeId}/skill-assessments`,
      body,
    );
  }

  deleteExtra(employeeId: string, assessmentId: string): Observable<void> {
    return this.http.delete<void>(
      `/api/v1/employees/${employeeId}/skill-assessments/${assessmentId}`,
    );
  }
}
