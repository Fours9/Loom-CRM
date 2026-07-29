import {
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

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
