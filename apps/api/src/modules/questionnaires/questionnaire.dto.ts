import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  QUESTIONNAIRE_DIRECTORY_SORT_BY,
  QUESTIONNAIRE_TYPES,
  type QuestionnaireAttachmentState,
  type QuestionnaireDirectorySortBy,
  type QuestionnaireType,
} from '@loom/contracts-questionnaires';

export class CreateQuestionnaireAssignmentDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string | null;
}

export class AttachQuestionnaireAssignmentDto {
  @IsUUID()
  employeeId!: string;
}

export class PatchQuestionnaireDraftDto {
  @IsObject()
  answers!: Record<string, unknown>;

  @IsInt()
  @Min(0)
  revision!: number;
}

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class RequestQuestionnaireChangesDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reviewComment!: string;
}

export class ReviewQuestionnaireSubmissionDto {
  @IsIn(['approved', 'changes_requested'])
  reviewStatus!: 'approved' | 'changes_requested';

  /** Required when reviewStatus is changes_requested. */
  @ValidateIf(
    (o: ReviewQuestionnaireSubmissionDto) =>
      o.reviewStatus === 'changes_requested',
  )
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reviewComment?: string | null;
}


export class ResolveQuestionnaireChangesDto {
  @IsIn(['completed', 'declined'])
  outcome!: 'completed' | 'declined';

  @ValidateIf((o: ResolveQuestionnaireChangesDto) => o.outcome === 'completed')
  @IsInt()
  @Min(0)
  expectedDraftRevision?: number;
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
  @IsIn(['new', 'attached', 'detached', 'closed'])
  attachmentState?: QuestionnaireAttachmentState;

  @IsOptional()
  @IsIn([...QUESTIONNAIRE_TYPES])
  templateType?: QuestionnaireType;

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

export class QuestionnaireSnapshotSummaryQueryDto {
  @IsOptional()
  @IsUUID()
  assignmentId?: string;
}
