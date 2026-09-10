import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  CreateEmployeeRequest,
  CreateEmployeeResponse,
  EmployeeListItem,
} from '@loom/contracts-employees';
import type { EmployeeDirectoryFilters } from '../../shared/employees/normalize-directory-filters';
import type {
  EmployeeDirectorySortDir,
  EmployeeDirectorySortKey,
} from '../../shared/employees/employee-directory-sort';

export type PeopleEmployeesListQuery = EmployeeDirectoryFilters & {
  sortBy: EmployeeDirectorySortKey;
  sortDir: EmployeeDirectorySortDir;
};

@Injectable({ providedIn: 'root' })
export class PeopleEmployeesApiService {
  private readonly http = inject(HttpClient);

  getEmployees(query: PeopleEmployeesListQuery): Observable<EmployeeListItem[]> {
    let params = new HttpParams()
      .set('sortBy', query.sortBy)
      .set('sortDir', query.sortDir);
    const q = query.q?.trim();
    if (q) params = params.set('q', q);
    for (const id of query.directionIds) {
      params = params.append('directionIds', id);
    }
    for (const id of query.departmentIds) {
      params = params.append('departmentIds', id);
    }
    for (const id of query.positionIds) {
      params = params.append('positionIds', id);
    }
    return this.http.get<EmployeeListItem[]>('/api/v1/employees', { params });
  }

  createEmployee(
    body: CreateEmployeeRequest,
  ): Observable<CreateEmployeeResponse> {
    return this.http.post<CreateEmployeeResponse>('/api/v1/employees', body);
  }
}
