import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  AttachQuestionnaireAssignmentRequest,
  CreateQuestionnaireAssignmentRequest,
  QuestionnaireAssignmentDetail,
  QuestionnaireAssignmentListResponse,
  QuestionnaireAttachmentState,
  QuestionnaireDirectoryResponse,
  QuestionnaireDirectorySortBy,
  QuestionnaireDraftDto,
  QuestionnaireProfileProposalItem,
  QuestionnaireProfileProposalListResponse,
  QuestionnaireSnapshotSummary,
  QuestionnaireSubmissionSummary,
  QuestionnaireType,
  ReviewQuestionnaireSubmissionRequest,
  QuestionnaireTemplateListResponse,
} from '@loom/contracts-questionnaires';

@Injectable({ providedIn: 'root' })
export class QuestionnairesApiService {
  private readonly http = inject(HttpClient);

  listAssignments(
    employeeId: string,
    filters?: {
      code?: string;
      templateType?: string;
      status?: string;
      createdFrom?: string;
      createdTo?: string;
    },
  ): Observable<QuestionnaireAssignmentListResponse> {
    const params: Record<string, string> = { employeeId };
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined && v !== null && v !== '') params[k] = String(v);
      }
    }
    return this.http.get<QuestionnaireAssignmentListResponse>(
      `/api/v1/questionnaires/assignments`,
      { params },
    );
  }

  listTemplates(): Observable<QuestionnaireTemplateListResponse> {
    return this.http.get<QuestionnaireTemplateListResponse>(
      `/api/v1/questionnaires/templates`,
    );
  }

  getAssignment(id: string): Observable<QuestionnaireAssignmentDetail> {
    return this.http.get<QuestionnaireAssignmentDetail>(
      `/api/v1/questionnaires/assignments/${id}`,
    );
  }

  createAssignment(
    body: CreateQuestionnaireAssignmentRequest,
  ): Observable<QuestionnaireAssignmentDetail> {
    return this.http.post<QuestionnaireAssignmentDetail>(
      `/api/v1/questionnaires/assignments`,
      body,
    );
  }

  listDirectory(params: {
    departmentId?: string;
    positionId?: string;
    createdFrom?: string;
    createdTo?: string;
    attachmentState?: QuestionnaireAttachmentState | string;
    templateType?: QuestionnaireType | string;
    code?: string;
    status?: string;
    sortBy?: QuestionnaireDirectorySortBy | string;
    sortDir?: string;
    limit?: number;
    offset?: number;
  }): Observable<QuestionnaireDirectoryResponse> {
    const q: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') q[k] = String(v);
    }
    return this.http.get<QuestionnaireDirectoryResponse>(
      `/api/v1/questionnaires/directory`,
      { params: q },
    );
  }

  cancelAssignment(id: string): Observable<QuestionnaireAssignmentDetail> {
    return this.http.post<QuestionnaireAssignmentDetail>(
      `/api/v1/questionnaires/assignments/${id}/cancel`,
      {},
    );
  }

  attachAssignment(
    id: string,
    body: AttachQuestionnaireAssignmentRequest,
  ): Observable<QuestionnaireAssignmentDetail> {
    return this.http.post<QuestionnaireAssignmentDetail>(
      `/api/v1/questionnaires/assignments/${id}/attach`,
      body,
    );
  }

  closeAssignment(id: string): Observable<QuestionnaireAssignmentDetail> {
    return this.http.post<QuestionnaireAssignmentDetail>(
      `/api/v1/questionnaires/assignments/${id}/close`,
      {},
    );
  }

  deleteAssignment(id: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/questionnaires/assignments/${id}`);
  }

  startRevision(assignmentId: string): Observable<QuestionnaireSubmissionSummary> {
    return this.http.post<QuestionnaireSubmissionSummary>(
      `/api/v1/questionnaires/assignments/${assignmentId}/start-revision`,
      {},
    );
  }

  patchDraft(
    assignmentId: string,
    body: { answers: Record<string, unknown>; revision: number },
  ): Observable<QuestionnaireDraftDto> {
    return this.http.patch<QuestionnaireDraftDto>(
      `/api/v1/questionnaires/assignments/${assignmentId}/draft`,
      body,
    );
  }

  syncPositionContext(
    assignmentId: string,
    body: {
      expectedDraftRevision: number;
      desiredExtraSkillCodes: string[];
    },
  ): Observable<QuestionnaireAssignmentDetail> {
    return this.http.post<QuestionnaireAssignmentDetail>(
      `/api/v1/questionnaires/assignments/${assignmentId}/sync-position-context`,
      body,
    );
  }

  submit(assignmentId: string): Observable<QuestionnaireSubmissionSummary> {
    return this.http.post<QuestionnaireSubmissionSummary>(
      `/api/v1/questionnaires/assignments/${assignmentId}/submit`,
      {},
    );
  }

  reopenSelf(assignmentId: string): Observable<QuestionnaireSubmissionSummary> {
    return this.http.post<QuestionnaireSubmissionSummary>(
      `/api/v1/questionnaires/assignments/${assignmentId}/reopen`,
      {},
    );
  }

  resolveChanges(
    assignmentId: string,
    body:
      | { outcome: 'completed'; expectedDraftRevision: number }
      | { outcome: 'declined' },
  ): Observable<QuestionnaireSubmissionSummary> {
    return this.http.post<QuestionnaireSubmissionSummary>(
      `/api/v1/questionnaires/assignments/${assignmentId}/resolve-changes`,
      body,
    );
  }

  reviewSubmission(
    submissionId: string,
    body: ReviewQuestionnaireSubmissionRequest,
  ): Observable<QuestionnaireSubmissionSummary> {
    return this.http.post<QuestionnaireSubmissionSummary>(
      `/api/v1/questionnaires/submissions/${submissionId}/review`,
      body,
    );
  }

  listProposals(employeeId: string): Observable<QuestionnaireProfileProposalListResponse> {
    return this.http.get<QuestionnaireProfileProposalListResponse>(
      `/api/v1/questionnaires/proposals`,
      { params: { employeeId } },
    );
  }

  acceptProposal(id: string): Observable<QuestionnaireProfileProposalItem> {
    return this.http.post<QuestionnaireProfileProposalItem>(
      `/api/v1/questionnaires/proposals/${id}/accept`,
      {},
    );
  }

  rejectProposal(id: string): Observable<QuestionnaireProfileProposalItem> {
    return this.http.post<QuestionnaireProfileProposalItem>(
      `/api/v1/questionnaires/proposals/${id}/reject`,
      {},
    );
  }

  snapshotSummary(
    employeeId: string,
    assignmentId?: string | null,
  ): Observable<QuestionnaireSnapshotSummary> {
    const params: Record<string, string> = {};
    if (assignmentId?.trim()) {
      params['assignmentId'] = assignmentId.trim();
    }
    return this.http.get<QuestionnaireSnapshotSummary>(
      `/api/v1/questionnaires/employees/${employeeId}/snapshot-summary`,
      { params },
    );
  }

  listPrintableTemplates(): Observable<QuestionnaireTemplateListResponse> {
    return this.http.get<QuestionnaireTemplateListResponse>(
      `/api/v1/questionnaires/templates/printable`,
    );
  }

  exportAssignmentPdf(
    assignmentId: string,
    expectedDraftRevision?: number,
  ): Observable<Blob> {
    const params: Record<string, string> = {};
    if (expectedDraftRevision !== undefined) {
      params['expectedDraftRevision'] = String(expectedDraftRevision);
    }
    return this.http.get(
      `/api/v1/questionnaires/assignments/${assignmentId}/export.pdf`,
      { params, responseType: 'blob' },
    );
  }

  exportBlankPdf(templateCode: string): Observable<Blob> {
    return this.http.get(
      `/api/v1/questionnaires/templates/${encodeURIComponent(templateCode)}/blank.pdf`,
      { responseType: 'blob' },
    );
  }
}
