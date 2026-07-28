import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of, catchError } from 'rxjs';
import {
  AbsenceMetadataResponse,
  AbsenceRequestAttachment,
  AbsenceRequestDetail,
  AbsenceRequestListItem,
  AbsenceType,
  CalendarDayResponse,
  CalendarQueryFilters,
  CalendarRangeResponse,
  CreateAbsenceRequestPayload,
  CreateEmployeePayload,
  Department,
  EmployeeListItem,
  EmployeeProfile,
  Paginated,
  Position,
  PrivacySettings,
  ScheduleDay,
  UserRole,
  UserStatus,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  getAbsenceMetadata(): Observable<AbsenceMetadataResponse> {
    return this.http.get<AbsenceMetadataResponse>('/api/v1/absences/metadata');
  }

  getDepartments(all = false): Observable<Department[]> {
    const params = all ? new HttpParams().set('all', '1') : undefined;
    return this.http.get<Department[]>('/api/v1/departments', { params });
  }

  createDepartment(body: { name: string; description?: string }): Observable<Department> {
    return this.http.post<Department>('/api/v1/departments', body);
  }

  updateDepartment(id: string, body: Partial<Department>): Observable<Department> {
    return this.http.patch<Department>(`/api/v1/departments/${id}`, body);
  }

  deleteDepartment(id: string): Observable<Department> {
    return this.http.delete<Department>(`/api/v1/departments/${id}`);
  }

  getPositions(
    departmentIdOrIds?: string | string[],
    all = false,
    globalsOnly = false,
  ): Observable<Position[]> {
    let params = new HttpParams();
    if (typeof departmentIdOrIds === 'string' && departmentIdOrIds) {
      params = params.set('departmentId', departmentIdOrIds);
    } else if (Array.isArray(departmentIdOrIds) && departmentIdOrIds.length) {
      params = params.set('departmentIds', departmentIdOrIds.join(','));
    }
    if (globalsOnly) {
      params = params.set('globalsOnly', '1');
    }
    if (all) {
      params = params.set('all', '1');
    }
    return this.http.get<Position[]>('/api/v1/positions', { params });
  }

  createPosition(body: {
    name: string;
    departmentId?: string | null;
    description?: string;
  }): Observable<Position> {
    return this.http.post<Position>('/api/v1/positions', body);
  }

  updatePosition(id: string, body: Partial<Position>): Observable<Position> {
    return this.http.patch<Position>(`/api/v1/positions/${id}`, body);
  }

  deletePosition(id: string): Observable<Position> {
    return this.http.delete<Position>(`/api/v1/positions/${id}`);
  }

  getEmployees(filters?: {
    q?: string;
    departmentId?: string;
    departmentIds?: string[];
    positionId?: string;
    status?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }): Observable<EmployeeListItem[]> {
    let params = new HttpParams();
    if (filters?.q) params = params.set('q', filters.q);
    if (filters?.departmentId) params = params.set('departmentId', filters.departmentId);
    if (filters?.departmentIds?.length) {
      params = params.set('departmentIds', filters.departmentIds.join(','));
    }
    if (filters?.positionId) params = params.set('positionId', filters.positionId);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.sortBy) params = params.set('sortBy', filters.sortBy);
    if (filters?.sortDir) params = params.set('sortDir', filters.sortDir);
    return this.http.get<EmployeeListItem[]>('/api/v1/employees', { params });
  }

  getEmployee(id: string): Observable<EmployeeProfile> {
    return this.http.get<EmployeeProfile>(`/api/v1/employees/${id}`);
  }

  createEmployee(body: CreateEmployeePayload): Observable<EmployeeProfile> {
    return this.http.post<EmployeeProfile>('/api/v1/employees', body);
  }

  attachEmployeeAccount(
    id: string,
    body: { email: string; temporaryPassword: string },
  ): Observable<EmployeeProfile> {
    return this.http.post<EmployeeProfile>(`/api/v1/employees/${id}/account`, body);
  }

  updateEmployeeAccountStatus(
    id: string,
    status: UserStatus,
  ): Observable<EmployeeProfile> {
    return this.http.patch<EmployeeProfile>(`/api/v1/employees/${id}/account/status`, {
      status,
    });
  }

  deleteEmployeeAccount(id: string): Observable<EmployeeProfile> {
    return this.http.delete<EmployeeProfile>(`/api/v1/employees/${id}/account`);
  }

  getNextEmployeeNumber(role: UserRole): Observable<{ employeeNumber: string }> {
    return this.http.get<{ employeeNumber: string }>('/api/v1/employees/next-number', {
      params: { role },
    });
  }

  updateEmployee(id: string, body: Record<string, unknown>): Observable<EmployeeProfile> {
    return this.http.patch<EmployeeProfile>(`/api/v1/employees/${id}`, body);
  }

  downloadEmployeePdf(id: string): Observable<Blob> {
    return this.http.get(`/api/v1/employees/${id}/export.pdf`, {
      responseType: 'blob',
    });
  }

  deactivateEmployee(id: string): Observable<EmployeeProfile> {
    return this.http.post<EmployeeProfile>(`/api/v1/employees/${id}/deactivate`, {});
  }

  activateEmployee(id: string): Observable<EmployeeProfile> {
    return this.http.post<EmployeeProfile>(`/api/v1/employees/${id}/activate`, {});
  }

  getSchedule(id: string): Observable<ScheduleDay[]> {
    return this.http.get<ScheduleDay[]>(`/api/v1/employees/${id}/schedule`);
  }

  putSchedule(id: string, days: ScheduleDay[]): Observable<ScheduleDay[]> {
    return this.http.put<ScheduleDay[]>(`/api/v1/employees/${id}/schedule`, { days });
  }

  getEmployeeRequests(employeeId: string): Observable<{ items: AbsenceRequestListItem[] }> {
    return this.http.get<{ items: AbsenceRequestListItem[] }>(
      `/api/v1/absences/employees/${employeeId}/requests`,
    );
  }

  resetPassword(userId: string, temporaryPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`/api/v1/auth/reset-password/${userId}`, {
      temporaryPassword,
    });
  }

  getPrivacy(): Observable<PrivacySettings> {
    return this.http.get<PrivacySettings>('/api/v1/settings/privacy').pipe(
      catchError(() =>
        of({
          id: 1,
          absenceVisibilityMode: 'all_approved',
          profileVisibilityMode: 'all',
          globalPrivacyPriority: false,
          showDepartmentOnCalendar: true,
          showPositionOnCalendar: true,
          showAbsenceTypeToPeers: true,
          sessionInactivityMinutes: 60,
        } satisfies PrivacySettings),
      ),
    );
  }

  updatePrivacy(body: Partial<PrivacySettings>): Observable<PrivacySettings> {
    return this.http.put<PrivacySettings>('/api/v1/settings/privacy', body).pipe(
      catchError(() => this.getPrivacy().pipe(map((p) => ({ ...p, ...body })))),
    );
  }

  getRequests(filters?: {
    page?: number;
    pageSize?: number;
    statusGroup?: string;
    type?: string;
    employeeId?: string;
    departmentId?: string;
    departmentIds?: string[];
    positionId?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }): Observable<Paginated<AbsenceRequestListItem>> {
    let params = new HttpParams();
    if (filters?.page) params = params.set('page', String(filters.page));
    if (filters?.pageSize) params = params.set('pageSize', String(filters.pageSize));
    if (filters?.statusGroup) params = params.set('statusGroup', filters.statusGroup);
    if (filters?.type) params = params.set('type', filters.type);
    if (filters?.employeeId) params = params.set('employeeId', filters.employeeId);
    if (filters?.departmentIds?.length) {
      params = params.set('departmentIds', filters.departmentIds.join(','));
    } else if (filters?.departmentId) {
      params = params.set('departmentId', filters.departmentId);
    }
    if (filters?.positionId) params = params.set('positionId', filters.positionId);
    if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);
    if (filters?.sortBy) params = params.set('sortBy', filters.sortBy);
    if (filters?.sortDir) params = params.set('sortDir', filters.sortDir);
    return this.http.get<Paginated<AbsenceRequestListItem>>('/api/v1/absences/requests', { params });
  }

  getRequest(id: string): Observable<AbsenceRequestDetail> {
    return this.http.get<AbsenceRequestDetail>(`/api/v1/absences/requests/${id}`);
  }

  createRequest(body: CreateAbsenceRequestPayload): Observable<AbsenceRequestDetail> {
    return this.http.post<AbsenceRequestDetail>('/api/v1/absences/requests', body);
  }

  deleteRequest(id: string, version: number): Observable<{ ok: boolean }> {
    const params = new HttpParams().set('version', String(version));
    return this.http.delete<{ ok: boolean }>(`/api/v1/absences/requests/${id}`, { params });
  }

  approveRequest(id: string, body: { version: number; decisionComment?: string }) {
    return this.http.post<AbsenceRequestDetail>(`/api/v1/absences/requests/${id}/approve`, body);
  }

  rejectRequest(id: string, body: { version: number; decisionComment?: string }) {
    return this.http.post<AbsenceRequestDetail>(`/api/v1/absences/requests/${id}/reject`, body);
  }

  adjustRequest(
    id: string,
    body: {
      version: number;
      adjustmentComment: string;
      type?: AbsenceType;
      startDate?: string;
      endDate?: string | null;
      absenceStartTime?: string | null;
      absenceEndTime?: string | null;
      isUnpaid?: boolean;
      reason?: string | null;
      employeeComment?: string | null;
    },
  ) {
    return this.http.post<AbsenceRequestDetail>(`/api/v1/absences/requests/${id}/adjust`, body);
  }

  updateRequest(
    id: string,
    body: {
      version: number;
      type?: AbsenceType;
      startDate?: string;
      endDate?: string | null;
      absenceStartTime?: string | null;
      absenceEndTime?: string | null;
      isUnpaid?: boolean;
      reason?: string | null;
      employeeComment?: string | null;
      adjustmentComment?: string;
    },
  ) {
    return this.http.patch<AbsenceRequestDetail>(`/api/v1/absences/requests/${id}`, body);
  }

  requestDeletion(id: string, body: { version: number; deletionComment?: string }) {
    return this.http.post<AbsenceRequestDetail>(`/api/v1/absences/requests/${id}/request-deletion`, body);
  }

  approveDeletion(id: string, body: { version: number; comment?: string }) {
    return this.http.post<{ ok: boolean }>(`/api/v1/absences/requests/${id}/approve-deletion`, body);
  }

  rejectDeletion(id: string, body: { version: number; comment: string }) {
    return this.http.post<AbsenceRequestDetail>(`/api/v1/absences/requests/${id}/reject-deletion`, body);
  }

  uploadRequestAttachment(id: string, file: File): Observable<AbsenceRequestAttachment> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<AbsenceRequestAttachment>(
      `/api/v1/absences/requests/${id}/attachments`,
      form,
    );
  }

  deleteRequestAttachment(id: string, attachmentId: string) {
    return this.http.delete(`/api/v1/absences/requests/${id}/attachments/${attachmentId}`);
  }

  downloadRequestAttachment(id: string, attachmentId: string): Observable<Blob> {
    return this.http.get(`/api/v1/absences/requests/${id}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    });
  }

  getCalendarRange(
    from: string,
    to: string,
    filters?: CalendarQueryFilters,
  ): Observable<CalendarRangeResponse> {
    let params = new HttpParams().set('from', from).set('to', to);
    params = this.appendCalendarFilters(params, filters);
    return this.http.get<CalendarRangeResponse>('/api/v1/absences/calendar', { params });
  }

  getCalendarDay(
    date: string,
    filters?: CalendarQueryFilters,
  ): Observable<CalendarDayResponse> {
    let params = new HttpParams();
    params = this.appendCalendarFilters(params, filters);
    return this.http.get<CalendarDayResponse>(`/api/v1/absences/calendar/days/${date}`, {
      params,
    });
  }

  private appendCalendarFilters(
    params: HttpParams,
    filters?: CalendarQueryFilters,
  ): HttpParams {
    if (!filters) return params;
    for (const id of filters.employeeIds ?? []) {
      params = params.append('employeeIds', id);
    }
    for (const id of filters.departmentIds ?? []) {
      params = params.append('departmentIds', id);
    }
    for (const id of filters.positionIds ?? []) {
      params = params.append('positionIds', id);
    }
    for (const t of filters.types ?? []) {
      params = params.append('types', t);
    }
    for (const s of filters.statusGroups ?? []) {
      params = params.append('statusGroups', s);
    }
    return params;
  }
}
