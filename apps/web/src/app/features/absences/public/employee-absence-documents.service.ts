import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { AbsenceDocumentListItem } from '@loom/contracts-absences';

@Injectable({ providedIn: 'root' })
export class EmployeeAbsenceDocumentsService {
  private readonly http = inject(HttpClient);

  getEmployeeDocumentItems(employeeId: string): Observable<AbsenceDocumentListItem[]> {
    return this.http.get<AbsenceDocumentListItem[]>(
      `/api/v1/absences/employees/${employeeId}/document-items`,
    );
  }

  downloadAttachment(requestId: string, attachmentId: string): Observable<Blob> {
    return this.http.get(
      `/api/v1/absences/requests/${requestId}/attachments/${attachmentId}/download`,
      { responseType: 'blob' },
    );
  }
}
