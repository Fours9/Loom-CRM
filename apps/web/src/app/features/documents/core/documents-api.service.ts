import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  EmployeeDocumentListResponse,
  EmployeeDocumentType,
  UploadEmployeeDocumentResponse,
} from '@loom/contracts-documents';

@Injectable({ providedIn: 'root' })
export class DocumentsApiService {
  private readonly http = inject(HttpClient);

  getEmployeeDocuments(employeeId: string): Observable<EmployeeDocumentListResponse> {
    return this.http.get<EmployeeDocumentListResponse>(
      `/api/v1/documents/employees/${employeeId}`,
    );
  }

  uploadEmployeeDocument(
    employeeId: string,
    input: { title: string; documentType: EmployeeDocumentType; file: File },
  ): Observable<UploadEmployeeDocumentResponse> {
    const form = new FormData();
    form.append('file', input.file, input.file.name);
    form.append('title', input.title);
    form.append('documentType', input.documentType);
    return this.http.post<UploadEmployeeDocumentResponse>(
      `/api/v1/documents/employees/${employeeId}`,
      form,
    );
  }

  downloadDocument(id: string): Observable<Blob> {
    return this.http.get(`/api/v1/documents/${id}/download`, {
      responseType: 'blob',
    });
  }

  deleteDocument(id: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`/api/v1/documents/${id}`);
  }
}
