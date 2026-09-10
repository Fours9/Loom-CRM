import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import type { EmploymentManagementKind } from '@loom/contracts-employees';

export type OrganizationCatalogDirection = {
  id: string;
  name: string;
  code: string | null;
  companyId: string | null;
};

export type OrganizationCatalogDepartment = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  directionId: string | null;
  directionName?: string | null;
};

export type OrganizationCatalogPosition = {
  id: string;
  name: string;
  departmentId: string | null;
  directionId: string | null;
  departmentName?: string | null;
  directionName?: string | null;
  managementKindTemplate: EmploymentManagementKind;
};

export type OrganizationCatalogNamedItem = {
  id: string;
  name: string;
  sortOrder: number;
};

export type OrganizationCatalogSnapshot = {
  companies: Array<{ id: string; name: string; code: string | null }>;
  directions: OrganizationCatalogDirection[];
  departments: OrganizationCatalogDepartment[];
  positions: OrganizationCatalogPosition[];
  workFormats: OrganizationCatalogNamedItem[];
  employmentTypes: OrganizationCatalogNamedItem[];
};

@Injectable({ providedIn: 'root' })
export class OrganizationCatalogApiService {
  private readonly http = inject(HttpClient);

  getSnapshot(): Observable<OrganizationCatalogSnapshot> {
    return this.http.get<OrganizationCatalogSnapshot>('/api/v1/employees/catalogs/org');
  }
}
