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
    input: {
      title: string;
      documentType: EmployeeDocumentType;
      isConfidential?: boolean;
      files: File[];
    },
  ): Observable<UploadEmployeeDocumentResponse> {
    const form = new FormData();
    form.append('title', input.title);
    form.append('documentType', input.documentType);
    if (input.isConfidential === true) {
      form.append('isConfidential', 'true');
    } else if (input.isConfidential === false) {
      form.append('isConfidential', 'false');
    }
    for (const file of input.files) {
      form.append('files', file, file.name);
    }
    return this.http.post<UploadEmployeeDocumentResponse>(
      `/api/v1/documents/employees/${employeeId}`,
      form,
    );
  }

  downloadDocumentFile(documentId: string, fileId: string): Observable<Blob> {
    return this.http.get(
      `/api/v1/documents/${documentId}/files/${fileId}/download`,
      { responseType: 'blob' },
    );
  }

  deleteDocument(id: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`/api/v1/documents/${id}`);
  }
}
