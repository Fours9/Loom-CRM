import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  CreateQuestionnaireAssignmentRequest,
  QuestionnaireAssignmentDetail,
  QuestionnaireAssignmentListResponse,
  QuestionnaireDraftDto,
  QuestionnaireProfileProposalItem,
  QuestionnaireProfileProposalListResponse,
  QuestionnaireSnapshotSummary,
  QuestionnaireSubmissionSummary,
  ReviewQuestionnaireSubmissionRequest,
} from '@loom/contracts-questionnaires';

@Injectable({ providedIn: 'root' })
export class QuestionnairesApiService {
  private readonly http = inject(HttpClient);

  listAssignments(employeeId: string): Observable<QuestionnaireAssignmentListResponse> {
    return this.http.get<QuestionnaireAssignmentListResponse>(
      `/api/v1/questionnaires/assignments`,
      { params: { employeeId } },
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

  patchDraft(
    assignmentId: string,
    body: { answers: Record<string, unknown>; revision: number },
  ): Observable<QuestionnaireDraftDto> {
    return this.http.patch<QuestionnaireDraftDto>(
      `/api/v1/questionnaires/assignments/${assignmentId}/draft`,
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

  requestChanges(
    assignmentId: string,
    body?: { reviewComment?: string | null },
  ): Observable<QuestionnaireSubmissionSummary> {
    return this.http.post<QuestionnaireSubmissionSummary>(
      `/api/v1/questionnaires/assignments/${assignmentId}/request-changes`,
      body ?? {},
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

  snapshotSummary(employeeId: string): Observable<QuestionnaireSnapshotSummary> {
    return this.http.get<QuestionnaireSnapshotSummary>(
      `/api/v1/questionnaires/employees/${employeeId}/snapshot-summary`,
    );
  }
}
