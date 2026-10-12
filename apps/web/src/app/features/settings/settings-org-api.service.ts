import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import type { ManagementKind } from '../../shared/organization/labels';

export type OrgDirection = {
  id: string;
  name: string;
  code: string | null;
  companyId: string | null;
  isActive: boolean;
};

export type OrgDepartment = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  directionId: string | null;
  directionName?: string | null;
  direction?: OrgDirection | null;
  isHidden: boolean;
  isActive: boolean;
};

export type EmploymentCatalogItem = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type EmploymentCatalogWriteBody = {
  name?: string;
  description?: string | null;
  isActive?: boolean;
};

export type OrgPosition = {
  id: string;
  name: string;
  departmentId: string | null;
  /**
   * Synced from department when departmentId is set;
   * otherwise optional / manual.
   */
  directionId: string | null;
  description: string | null;
  isActive: boolean;
  /** @deprecated use managementKindTemplate. */
  isDepartmentManagerTemplate?: boolean;
  managementKindTemplate?: ManagementKind;
  managedDepartmentIds?: string[];
  managedDirectionIds?: string[];
  departmentName?: string | null;
  directionName?: string | null;
  department?: OrgDepartment | null;
};

export type OrgSkillGroup = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export type OrgSkill = {
  id: string;
  groupId: string | null;
  code: string;
  name: string;
  description: string | null;
  scaleKind: 'range' | 'percent';
  scaleMin: number;
  scaleMax: number;
  isActive: boolean;
  group?: OrgSkillGroup | null;
};

export type OrgPositionSkillRequirement = {
  id: string;
  positionId: string;
  skillId: string;
  targetLevel: number;
  required: boolean;
  weight: number | null;
  skillCode?: string | null;
  skillName?: string | null;
  skillScaleKind?: 'range' | 'percent' | null;
  skillScaleMin?: number | null;
  skillScaleMax?: number | null;
};

export type OrgPositionDuty = {
  id: string;
  positionId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type GoalKind = 'career' | 'probation' | 'quarterly';

export type OrgPositionGoalTemplate = {
  id: string;
  positionId: string;
  goalKind: GoalKind | string;
  title: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

@Injectable({ providedIn: 'root' })
export class SettingsOrgApiService {
  private readonly http = inject(HttpClient);

  getDepartments(): Observable<OrgDepartment[]> {
    return this.http.get<OrgDepartment[]>('/api/v1/departments');
  }

  createDepartment(body: {
    name: string;
    description?: string;
    location?: string | null;
    directionId?: string | null;
  }): Observable<OrgDepartment> {
    return this.http.post<OrgDepartment>('/api/v1/departments', body);
  }

  updateDepartment(
    id: string,
    body: Partial<
      Pick<
        OrgDepartment,
        'name' | 'description' | 'location' | 'directionId' | 'isActive' | 'isHidden'
      >
    >,
  ): Observable<OrgDepartment> {
    return this.http.patch<OrgDepartment>(`/api/v1/departments/${id}`, body);
  }

  deleteDepartment(id: string): Observable<unknown> {
    return this.http.delete(`/api/v1/departments/${id}`);
  }

  getDirections(): Observable<OrgDirection[]> {
    return this.http.get<OrgDirection[]>('/api/v1/directions');
  }

  createDirection(body: {
    name: string;
    code?: string;
    companyId?: string;
  }): Observable<OrgDirection> {
    return this.http.post<OrgDirection>('/api/v1/directions', body);
  }

  updateDirection(
    id: string,
    body: Partial<Pick<OrgDirection, 'name' | 'code' | 'companyId' | 'isActive'>>,
  ): Observable<OrgDirection> {
    return this.http.patch<OrgDirection>(`/api/v1/directions/${id}`, body);
  }

  deleteDirection(id: string): Observable<unknown> {
    return this.http.delete(`/api/v1/directions/${id}`);
  }

  /** Catalog read — every authenticated user, no management scope. */
  getPositions(all = false): Observable<OrgPosition[]> {
    const params = all ? new HttpParams().set('all', '1') : undefined;
    return this.http.get<OrgPosition[]>('/api/v1/positions', { params });
  }

  /**
   * Scoped management list (`positions.manage` + PositionManagementScopePolicy).
   * Falls back to the catalog while the endpoint is still rolling out.
   */
  getManagedPositions(all = false): Observable<OrgPosition[]> {
    const params = all ? new HttpParams().set('all', '1') : undefined;
    return this.http.get<OrgPosition[]>('/api/v1/positions/manage', { params }).pipe(
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          return this.getPositions(all);
        }
        return throwError(() => err);
      }),
    );
  }

  createPosition(body: {
    name: string;
    departmentId?: string | null;
    directionId?: string | null;
    description?: string | null;
    isDepartmentManagerTemplate?: boolean;
    managementKindTemplate?: ManagementKind;
    managedDepartmentIds?: string[];
    managedDirectionIds?: string[];
  }): Observable<OrgPosition> {
    return this.http.post<OrgPosition>('/api/v1/positions', body);
  }

  updatePosition(
    id: string,
    body: Partial<{
      name: string;
      departmentId: string | null;
      directionId: string | null;
      description: string | null;
      isActive: boolean;
      isDepartmentManagerTemplate: boolean;
      managementKindTemplate: ManagementKind;
      managedDepartmentIds: string[];
      managedDirectionIds: string[];
    }>,
  ): Observable<OrgPosition> {
    return this.http.patch<OrgPosition>(`/api/v1/positions/${id}`, body);
  }

  deletePosition(id: string): Observable<unknown> {
    return this.http.delete(`/api/v1/positions/${id}`);
  }

  getWorkFormats(all = false): Observable<EmploymentCatalogItem[]> {
    const params = all ? new HttpParams().set('all', '1') : undefined;
    return this.http.get<EmploymentCatalogItem[]>('/api/v1/work-formats', {
      params,
    });
  }

  createWorkFormat(body: {
    name: string;
    description?: string | null;
  }): Observable<EmploymentCatalogItem> {
    return this.http.post<EmploymentCatalogItem>('/api/v1/work-formats', body);
  }

  updateWorkFormat(
    id: string,
    body: EmploymentCatalogWriteBody,
  ): Observable<EmploymentCatalogItem> {
    return this.http.patch<EmploymentCatalogItem>(
      `/api/v1/work-formats/${id}`,
      body,
    );
  }

  reorderWorkFormats(orderedIds: string[]): Observable<EmploymentCatalogItem[]> {
    return this.http.put<EmploymentCatalogItem[]>('/api/v1/work-formats/reorder', {
      orderedIds,
    });
  }

  deleteWorkFormat(id: string): Observable<unknown> {
    return this.http.delete(`/api/v1/work-formats/${id}`);
  }

  getEmploymentTypes(all = false): Observable<EmploymentCatalogItem[]> {
    const params = all ? new HttpParams().set('all', '1') : undefined;
    return this.http.get<EmploymentCatalogItem[]>('/api/v1/employment-types', {
      params,
    });
  }

  createEmploymentType(body: {
    name: string;
    description?: string | null;
  }): Observable<EmploymentCatalogItem> {
    return this.http.post<EmploymentCatalogItem>(
      '/api/v1/employment-types',
      body,
    );
  }

  updateEmploymentType(
    id: string,
    body: EmploymentCatalogWriteBody,
  ): Observable<EmploymentCatalogItem> {
    return this.http.patch<EmploymentCatalogItem>(
      `/api/v1/employment-types/${id}`,
      body,
    );
  }

  reorderEmploymentTypes(
    orderedIds: string[],
  ): Observable<EmploymentCatalogItem[]> {
    return this.http.put<EmploymentCatalogItem[]>(
      '/api/v1/employment-types/reorder',
      { orderedIds },
    );
  }

  deleteEmploymentType(id: string): Observable<unknown> {
    return this.http.delete(`/api/v1/employment-types/${id}`);
  }

  getSkillGroups(all = false): Observable<OrgSkillGroup[]> {
    const params = all ? new HttpParams().set('all', '1') : undefined;
    return this.http.get<OrgSkillGroup[]>('/api/v1/skill-groups', { params });
  }

  createSkillGroup(body: {
    name: string;
    sortOrder?: number;
  }): Observable<OrgSkillGroup> {
    return this.http.post<OrgSkillGroup>('/api/v1/skill-groups', body);
  }

  updateSkillGroup(
    id: string,
    body: Partial<{ name: string; sortOrder: number; isActive: boolean }>,
  ): Observable<OrgSkillGroup> {
    return this.http.patch<OrgSkillGroup>(`/api/v1/skill-groups/${id}`, body);
  }

  deleteSkillGroup(id: string): Observable<unknown> {
    return this.http.delete(`/api/v1/skill-groups/${id}`);
  }

  getSkills(all = false, groupId?: string): Observable<OrgSkill[]> {
    let params = new HttpParams();
    if (all) params = params.set('all', '1');
    if (groupId) params = params.set('groupId', groupId);
    return this.http.get<OrgSkill[]>('/api/v1/skills', { params });
  }

  createSkill(body: {
    groupId?: string | null;
    name: string;
    description?: string | null;
    scaleKind?: 'range' | 'percent';
    scaleMin?: number;
    scaleMax?: number;
  }): Observable<OrgSkill> {
    return this.http.post<OrgSkill>('/api/v1/skills', body);
  }

  updateSkill(
    id: string,
    body: Partial<{
      groupId: string | null;
      name: string;
      description: string | null;
      scaleKind: 'range' | 'percent';
      scaleMin: number;
      scaleMax: number;
      isActive: boolean;
    }>,
  ): Observable<OrgSkill> {
    return this.http.patch<OrgSkill>(`/api/v1/skills/${id}`, body);
  }

  deleteSkill(id: string): Observable<unknown> {
    return this.http.delete(`/api/v1/skills/${id}`);
  }

  getPositionSkillRequirements(
    positionId: string,
  ): Observable<OrgPositionSkillRequirement[]> {
    return this.http.get<OrgPositionSkillRequirement[]>(
      `/api/v1/positions/${positionId}/skill-requirements`,
    );
  }

  createPositionSkillRequirement(
    positionId: string,
    body: {
      skillId: string;
      targetLevel?: number;
      required?: boolean;
      weight?: number | null;
    },
  ): Observable<OrgPositionSkillRequirement> {
    return this.http.post<OrgPositionSkillRequirement>(
      `/api/v1/positions/${positionId}/skill-requirements`,
      body,
    );
  }

  updatePositionSkillRequirement(
    positionId: string,
    id: string,
    body: Partial<{
      skillId: string;
      targetLevel: number;
      required: boolean;
      weight: number | null;
    }>,
  ): Observable<OrgPositionSkillRequirement> {
    return this.http.patch<OrgPositionSkillRequirement>(
      `/api/v1/positions/${positionId}/skill-requirements/${id}`,
      body,
    );
  }

  deletePositionSkillRequirement(
    positionId: string,
    id: string,
  ): Observable<unknown> {
    return this.http.delete(
      `/api/v1/positions/${positionId}/skill-requirements/${id}`,
    );
  }

  getPositionDuties(positionId: string, all = false): Observable<OrgPositionDuty[]> {
    const params = all ? new HttpParams().set('all', '1') : undefined;
    return this.http.get<OrgPositionDuty[]>(
      `/api/v1/positions/${positionId}/duties`,
      { params },
    );
  }

  createPositionDuty(
    positionId: string,
    body: { title: string; description?: string | null; sortOrder?: number },
  ): Observable<OrgPositionDuty> {
    return this.http.post<OrgPositionDuty>(
      `/api/v1/positions/${positionId}/duties`,
      body,
    );
  }

  updatePositionDuty(
    positionId: string,
    id: string,
    body: Partial<Pick<OrgPositionDuty, 'title' | 'description' | 'sortOrder' | 'isActive'>>,
  ): Observable<OrgPositionDuty> {
    return this.http.patch<OrgPositionDuty>(
      `/api/v1/positions/${positionId}/duties/${id}`,
      body,
    );
  }

  deletePositionDuty(positionId: string, id: string): Observable<unknown> {
    return this.http.delete(`/api/v1/positions/${positionId}/duties/${id}`);
  }

  getPositionGoalTemplates(
    positionId: string,
    all = false,
  ): Observable<OrgPositionGoalTemplate[]> {
    const params = all ? new HttpParams().set('all', '1') : undefined;
    return this.http.get<OrgPositionGoalTemplate[]>(
      `/api/v1/positions/${positionId}/goal-templates`,
      { params },
    );
  }

  createPositionGoalTemplate(
    positionId: string,
    body: {
      goalKind: GoalKind;
      title: string;
      description?: string | null;
      sortOrder?: number;
    },
  ): Observable<OrgPositionGoalTemplate> {
    return this.http.post<OrgPositionGoalTemplate>(
      `/api/v1/positions/${positionId}/goal-templates`,
      body,
    );
  }

  updatePositionGoalTemplate(
    positionId: string,
    id: string,
    body: Partial<{
      goalKind: GoalKind;
      title: string;
      description: string | null;
      sortOrder: number;
      isActive: boolean;
    }>,
  ): Observable<OrgPositionGoalTemplate> {
    return this.http.patch<OrgPositionGoalTemplate>(
      `/api/v1/positions/${positionId}/goal-templates/${id}`,
      body,
    );
  }

  deletePositionGoalTemplate(
    positionId: string,
    id: string,
  ): Observable<unknown> {
    return this.http.delete(
      `/api/v1/positions/${positionId}/goal-templates/${id}`,
    );
  }
}
