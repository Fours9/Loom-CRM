import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

const SORT_BY = [
  'fullName',
  'employeeNumber',
  'department',
  'position',
  'direction',
  'status',
  'role',
  'completeness',
] as const;

/**
 * Normalize id lists from comma-separated string or repeated query params.
 */
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

export class EmployeeListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

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
  @Transform(({ value }) => parseIdList(value))
  @IsUUID('4', { each: true })
  @ArrayMaxSize(100)
  directionIds?: string[];

  @IsOptional()
  @IsIn(['active', 'deactivated', 'no_account'])
  status?: string;

  @IsOptional()
  @IsIn([...SORT_BY])
  sortBy?: (typeof SORT_BY)[number];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  /** Keep employees with core completenessPercent <= this value. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxCompleteness?: number;
}
