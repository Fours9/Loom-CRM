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

const SORT_BY_BY_LOWER = Object.fromEntries(
  SORT_BY.map((key) => [key.toLowerCase(), key] as const),
) as Record<string, (typeof SORT_BY)[number]>;

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

/** Last token if query param was repeated. */
function lastQueryToken(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  const raw = Array.isArray(value) ? value[value.length - 1] : value;
  const token = String(raw).trim();
  return token || undefined;
}

/** Map case-insensitive / repeated sortBy onto canonical SORT_BY keys. */
function normalizeSortBy(value: unknown): string | undefined {
  const token = lastQueryToken(value);
  if (!token) return undefined;
  return SORT_BY_BY_LOWER[token.toLowerCase()] ?? token;
}

function normalizeSortDir(value: unknown): string | undefined {
  const token = lastQueryToken(value);
  return token ? token.toLowerCase() : undefined;
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
  /** Org ids may be v4 or deterministic v5 (PW cutover) — never pin to version 4. */
  @IsUUID('all', { each: true })
  @ArrayMaxSize(100)
  departmentIds?: string[];

  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsOptional()
  @Transform(({ value }) => parseIdList(value))
  @IsUUID('all', { each: true })
  @ArrayMaxSize(100)
  positionIds?: string[];

  @IsOptional()
  @Transform(({ value }) => parseIdList(value))
  @IsUUID('all', { each: true })
  @ArrayMaxSize(100)
  directionIds?: string[];

  @IsOptional()
  @IsIn(['active', 'deactivated', 'no_account'])
  status?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeSortBy(value))
  @IsIn([...SORT_BY])
  sortBy?: (typeof SORT_BY)[number];

  @IsOptional()
  @Transform(({ value }) => normalizeSortDir(value))
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
