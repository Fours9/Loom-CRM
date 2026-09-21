import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type {
  EmployeeAboutResponse,
  PatchEmployeeAboutSubtabRequest,
} from '@loom/contracts-employees';

@Injectable({ providedIn: 'root' })
export class EmployeeAboutApiService {
  private readonly http = inject(HttpClient);

  get(employeeId: string) {
    return this.http.get<EmployeeAboutResponse>(
      `/api/v1/employees/${employeeId}/about`,
    );
  }

  patch(employeeId: string, body: PatchEmployeeAboutSubtabRequest) {
    return this.http.patch<EmployeeAboutResponse>(
      `/api/v1/employees/${employeeId}/about`,
      body,
    );
  }
}
