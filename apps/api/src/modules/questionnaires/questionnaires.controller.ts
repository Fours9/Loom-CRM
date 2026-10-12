import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../platform/auth/decorators/current-user.decorator';
import { User } from '../../platform/identity/user.entity';
import { Permission } from '../../platform/permissions/permission.names';
import { RequirePermissions } from '../../platform/permissions/require-permissions.decorator';
import { PermissionsGuard } from '../../platform/permissions/permissions.guard';
import { attachmentContentDisposition } from '../../platform/http/content-disposition';
import { QuestionnaireAssignmentService } from './questionnaire-assignment.service';
import { QuestionnaireResponseService } from './questionnaire-response.service';
import { QuestionnaireSubmissionService } from './questionnaire-submission.service';
import { QuestionnaireProposalService } from './questionnaire-proposal.service';
import { QuestionnairePositionContextSyncService } from './questionnaire-position-context-sync.service';
import { QuestionnairePdfExportService } from './questionnaire-pdf-export.service';
import {
  AttachQuestionnaireAssignmentDto,
  CreateQuestionnaireAssignmentDto,
  PatchQuestionnaireDraftDto,
  QuestionnaireDirectoryQueryDto,
  QuestionnaireEmployeeListQueryDto,
  QuestionnaireSnapshotSummaryQueryDto,
  ResolveQuestionnaireChangesDto,
  ReviewQuestionnaireSubmissionDto,
  SyncQuestionnairePositionContextDto,
} from './questionnaire.dto';

@Controller('questionnaires')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuestionnairesController {
  constructor(
    private readonly assignments: QuestionnaireAssignmentService,
    private readonly responses: QuestionnaireResponseService,
    private readonly submissions: QuestionnaireSubmissionService,
    private readonly proposals: QuestionnaireProposalService,
    private readonly positionContextSync: QuestionnairePositionContextSyncService,
    private readonly pdfExport: QuestionnairePdfExportService,
  ) {}

  @Get('directory')
  @RequirePermissions(Permission.QuestionnairesView)
  listDirectory(
    @CurrentUser() actor: User,
    @Query() query: QuestionnaireDirectoryQueryDto,
  ) {
    return this.assignments.listDirectory(actor, query);
  }

  @Get('templates/printable')
  @RequirePermissions(Permission.QuestionnairesView)
  listPrintableTemplates(@CurrentUser() actor: User) {
    return this.assignments.listPrintableTemplates(actor);
  }

  @Get('templates/:code/blank.pdf')
  @RequirePermissions(Permission.QuestionnairesView)
  async exportBlankTemplatePdf(
    @CurrentUser() actor: User,
    @Param('code') code: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, asciiFilename, utf8Filename } =
      await this.pdfExport.exportBlankTemplatePdf(actor, code);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': attachmentContentDisposition(
        utf8Filename,
        asciiFilename,
      ),
      'Content-Length': buffer.length,
    });
    return new StreamableFile(buffer);
  }

  @Get('templates')
  @RequirePermissions(Permission.QuestionnairesAssign)
  listTemplates(@CurrentUser() actor: User) {
    return this.assignments.listPublishableTemplates(actor);
  }

  @Post('assignments')
  @RequirePermissions(Permission.QuestionnairesAssign)
  createAssignment(
    @CurrentUser() actor: User,
    @Body() dto: CreateQuestionnaireAssignmentDto,
  ) {
    return this.assignments.create(actor, dto);
  }

  @Get('assignments')
  @RequirePermissions(Permission.QuestionnairesView)
  listAssignments(
    @CurrentUser() actor: User,
    @Query() query: QuestionnaireEmployeeListQueryDto,
  ) {
    const { employeeId, ...filters } = query;
    return this.assignments.listByEmployee(actor, employeeId, filters);
  }

  @Get('assignments/:id')
  @RequirePermissions(Permission.QuestionnairesView)
  getAssignment(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assignments.getDetail(actor, id);
  }

  @Get('assignments/:id/export.pdf')
  @RequirePermissions(Permission.QuestionnairesView)
  async exportAssignmentPdf(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('expectedDraftRevision') expectedDraftRevisionRaw: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    let expectedDraftRevision: number | undefined;
    if (
      expectedDraftRevisionRaw !== undefined &&
      expectedDraftRevisionRaw !== ''
    ) {
      const n = Number(expectedDraftRevisionRaw);
      if (!Number.isInteger(n) || n < 0) {
        throw new ConflictException('Invalid expectedDraftRevision');
      }
      expectedDraftRevision = n;
    }
    const { buffer, asciiFilename, utf8Filename } =
      await this.pdfExport.exportAssignmentPdf(actor, id, {
        expectedDraftRevision,
      });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': attachmentContentDisposition(
        utf8Filename,
        asciiFilename,
      ),
      'Content-Length': buffer.length,
    });
    return new StreamableFile(buffer);
  }

  @Post('assignments/:id/cancel')
  @RequirePermissions(Permission.QuestionnairesManageLifecycle)
  cancelAssignment(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assignments.cancel(actor, id);
  }

  /** Assign (new) or ManageLifecycle (reattach) enforced in service. */
  @Post('assignments/:id/attach')
  @RequirePermissions(Permission.QuestionnairesView)
  attachAssignment(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachQuestionnaireAssignmentDto,
  ) {
    return this.assignments.attach(actor, id, dto);
  }

  @Post('assignments/:id/close')
  @RequirePermissions(Permission.QuestionnairesManageLifecycle)
  closeAssignment(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assignments.close(actor, id);
  }

  @Delete('assignments/:id')
  @HttpCode(204)
  @RequirePermissions(Permission.QuestionnairesDelete)
  async deleteAssignment(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.assignments.deleteAssignment(actor, id);
  }

  /** Service enforces CompleteSelf OR CompleteAny via capabilities. */
  @Patch('assignments/:id/draft')
  @RequirePermissions(Permission.QuestionnairesView)
  patchDraft(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchQuestionnaireDraftDto,
  ) {
    return this.responses.patchDraft(actor, id, dto);
  }

  /** Managing only; service enforces editable + revision match. */
  @Post('assignments/:id/sync-position-context')
  @RequirePermissions(Permission.QuestionnairesView)
  syncPositionContext(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SyncQuestionnairePositionContextDto,
  ) {
    return this.positionContextSync.sync(actor, id, {
      expectedDraftRevision: dto.expectedDraftRevision,
      desiredExtraSkillCodes: dto.desiredExtraSkillCodes,
    });
  }

  @Post('assignments/:id/submit')
  @RequirePermissions(Permission.QuestionnairesView)
  submit(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.submissions.submit(actor, id);
  }

  @Post('assignments/:id/reopen')
  @RequirePermissions(Permission.QuestionnairesCompleteSelf)
  reopenSelf(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.submissions.reopenSelf(actor, id);
  }

  @Post('assignments/:id/start-revision')
  @RequirePermissions(Permission.QuestionnairesCompleteAny)
  startRevision(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.submissions.startRevision(actor, id);
  }

  @Post('assignments/:id/resolve-changes')
  resolveChanges(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveQuestionnaireChangesDto,
  ) {
    if (dto.outcome === 'completed') {
      return this.submissions.resolveChanges(actor, id, {
        outcome: 'completed',
        expectedDraftRevision: dto.expectedDraftRevision!,
      });
    }
    return this.submissions.resolveChanges(actor, id, { outcome: 'declined' });
  }

  @Post('submissions/:id/review')
  @RequirePermissions(Permission.QuestionnairesReview)
  review(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewQuestionnaireSubmissionDto,
  ) {
    return this.submissions.review(actor, id, dto);
  }

  @Get('proposals')
  @RequirePermissions(Permission.QuestionnairesView)
  listProposals(
    @CurrentUser() actor: User,
    @Query('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return this.proposals.listForEmployee(actor, employeeId);
  }

  @Post('proposals/:id/accept')
  @RequirePermissions(Permission.QuestionnairesApplyProfileChanges)
  acceptProposal(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.proposals.accept(actor, id);
  }

  @Post('proposals/:id/reject')
  @RequirePermissions(Permission.QuestionnairesApplyProfileChanges)
  rejectProposal(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.proposals.reject(actor, id);
  }

  /**
   * One-shot repair: copy company_work direction/department/position from the
   * latest submission onto each employee's current employment assignment.
   * Admin-equivalent only (service enforces).
   */
  @Post('admin/backfill-employment-org')
  @RequirePermissions(Permission.QuestionnairesApplyProfileChanges)
  backfillEmploymentOrg(@CurrentUser() actor: User) {
    return this.proposals.backfillEmploymentOrgFromSubmissions(actor);
  }

  @Get('employees/:employeeId/snapshot-summary')
  @RequirePermissions(Permission.QuestionnairesView)
  snapshotSummary(
    @CurrentUser() actor: User,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: QuestionnaireSnapshotSummaryQueryDto,
  ) {
    return this.proposals.latestSnapshotSummary(
      actor,
      employeeId,
      query.assignmentId ?? null,
    );
  }
}
