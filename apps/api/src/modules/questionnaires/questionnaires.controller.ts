import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../platform/auth/decorators/current-user.decorator';
import { User } from '../../platform/identity/user.entity';
import { Permission } from '../../platform/permissions/permission.names';
import { RequirePermissions } from '../../platform/permissions/require-permissions.decorator';
import { PermissionsGuard } from '../../platform/permissions/permissions.guard';
import { QuestionnaireAssignmentService } from './questionnaire-assignment.service';
import { QuestionnaireResponseService } from './questionnaire-response.service';
import { QuestionnaireSubmissionService } from './questionnaire-submission.service';
import { QuestionnaireProposalService } from './questionnaire-proposal.service';
import {
  CreateQuestionnaireAssignmentDto,
  PatchQuestionnaireDraftDto,
  RequestQuestionnaireChangesDto,
  ReviewQuestionnaireSubmissionDto,
} from './questionnaire.dto';

@Controller('questionnaires')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuestionnairesController {
  constructor(
    private readonly assignments: QuestionnaireAssignmentService,
    private readonly responses: QuestionnaireResponseService,
    private readonly submissions: QuestionnaireSubmissionService,
    private readonly proposals: QuestionnaireProposalService,
  ) {}

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
    @Query('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return this.assignments.listByEmployee(actor, employeeId);
  }

  @Get('assignments/:id')
  @RequirePermissions(Permission.QuestionnairesView)
  getAssignment(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assignments.getDetail(actor, id);
  }

  @Patch('assignments/:id/draft')
  @RequirePermissions(Permission.QuestionnairesCompleteSelf)
  patchDraft(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchQuestionnaireDraftDto,
  ) {
    return this.responses.patchDraft(actor, id, dto);
  }

  @Post('assignments/:id/submit')
  @RequirePermissions(Permission.QuestionnairesCompleteSelf)
  submit(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.submissions.submit(actor, id);
  }

  @Post('assignments/:id/request-changes')
  @RequirePermissions(Permission.QuestionnairesReview)
  requestChanges(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestQuestionnaireChangesDto,
  ) {
    return this.submissions.requestChanges(actor, id, dto);
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

  @Get('employees/:employeeId/snapshot-summary')
  @RequirePermissions(Permission.QuestionnairesView)
  snapshotSummary(
    @CurrentUser() actor: User,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return this.proposals.latestSnapshotSummary(actor, employeeId);
  }
}
