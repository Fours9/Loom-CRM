import {
  ArrayMaxSize,
  IsArray,
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
  QUESTIONNAIRE_ASSIGNMENT_STATUSES,
  QUESTIONNAIRE_DIRECTORY_SORT_BY,
  QUESTIONNAIRE_TYPES,
  type QuestionnaireAssignmentStatus,
  type QuestionnaireAttachmentState,
  type QuestionnaireDirectorySortBy,
  type QuestionnaireType,
} from '@loom/contracts-questionnaires';

/** Normalize id lists from comma-separated string or repeated query params. */
function parseIdList(value: unknown): string[] | undefined {
  if (value == null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const ids = [
    ...new Set(
      raw
        .map((id) => String(id).trim())
        .filter(Boolean),
    ),
  ];
  return ids.length ? ids : undefined;
}
export class CreateQuestionnaireAssignmentDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  templateCode?: string;

  /** Display title for this assignment; defaults to template title when omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string | null;

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

export class SyncQuestionnairePositionContextDto {
  @IsInt()
  @Min(0)
  expectedDraftRevision!: number;

  /** Explicit selected catalog extras (not null-rating transport). */
  @IsArray()
  @IsString({ each: true })
  desiredExtraSkillCodes!: string[];
}

export class QuestionnaireDirectoryQueryDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @Transform(({ value }) => parseIdList(value))
  @IsUUID('4', { each: true })
  @ArrayMaxSize(100)
  departmentIds?: string[];

  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsOptional()
  @Transform(({ value }) => parseIdList(value))
  @IsUUID('4', { each: true })
  @ArrayMaxSize(100)
  positionIds?: string[];

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
  @Transform(({ value }) => parseIdList(value))
  @IsIn(['new', 'attached', 'detached', 'closed'], { each: true })
  @ArrayMaxSize(8)
  attachmentStates?: QuestionnaireAttachmentState[];

  @IsOptional()
  @IsIn([...QUESTIONNAIRE_TYPES])
  templateType?: QuestionnaireType;

  @IsOptional()
  @Transform(({ value }) => parseIdList(value))
  @IsIn([...QUESTIONNAIRE_TYPES], { each: true })
  @ArrayMaxSize(8)
  templateTypes?: QuestionnaireType[];

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsIn([...QUESTIONNAIRE_ASSIGNMENT_STATUSES])
  status?: QuestionnaireAssignmentStatus;

  @IsOptional()
  @Transform(({ value }) => parseIdList(value))
  @IsIn([...QUESTIONNAIRE_ASSIGNMENT_STATUSES], { each: true })
  @ArrayMaxSize(16)
  statuses?: QuestionnaireAssignmentStatus[];

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

export class QuestionnaireEmployeeListQueryDto {
  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsIn([...QUESTIONNAIRE_TYPES])
  templateType?: QuestionnaireType;

  @IsOptional()
  @Transform(({ value }) => parseIdList(value))
  @IsIn([...QUESTIONNAIRE_TYPES], { each: true })
  @ArrayMaxSize(8)
  templateTypes?: QuestionnaireType[];

  @IsOptional()
  @IsIn([...QUESTIONNAIRE_ASSIGNMENT_STATUSES])
  status?: QuestionnaireAssignmentStatus;

  @IsOptional()
  @Transform(({ value }) => parseIdList(value))
  @IsIn([...QUESTIONNAIRE_ASSIGNMENT_STATUSES], { each: true })
  @ArrayMaxSize(16)
  statuses?: QuestionnaireAssignmentStatus[];

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;
}

export class QuestionnaireSnapshotSummaryQueryDto {
  @IsOptional()
  @IsUUID()
  assignmentId?: string;
}
