import {
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  QUESTIONNAIRE_DIRECTORY_SORT_BY,
  type QuestionnaireAttachmentState,
  type QuestionnaireDirectorySortBy,
} from '@loom/contracts-questionnaires';

export class CreateQuestionnaireAssignmentDto {
  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsString()
  templateCode?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string | null;
}

export class PatchQuestionnaireDraftDto {
  @IsObject()
  answers!: Record<string, unknown>;

  @IsInt()
  @Min(0)
  revision!: number;
}

export class RequestQuestionnaireChangesDto {
  @IsOptional()
  @IsString()
  reviewComment?: string | null;
}

export class ReviewQuestionnaireSubmissionDto {
  @IsIn(['approved', 'changes_requested'])
  reviewStatus!: 'approved' | 'changes_requested';

  @IsOptional()
  @IsString()
  reviewComment?: string | null;
}

export class QuestionnaireDirectoryQueryDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsIn(['attached', 'detached', 'closed'])
  attachmentState?: QuestionnaireAttachmentState;

  @IsOptional()
  @IsIn([...QUESTIONNAIRE_DIRECTORY_SORT_BY])
  sortBy?: QuestionnaireDirectorySortBy;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
