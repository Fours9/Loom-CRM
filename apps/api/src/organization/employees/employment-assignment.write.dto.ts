import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type {
  CreateEmploymentAssignmentRequest,
  EmploymentManagementKind,
  UpdateEmploymentAssignmentRequest,
} from '@loom/contracts-employees';

type AssertNever<T extends never> = T;

/**
 * HTTP body for POST/PATCH …/employment-assignments.
 * Exact key parity with `@loom/contracts-employees` write requests (ADR 0011).
 */
export class CreateEmploymentAssignmentDto
  implements CreateEmploymentAssignmentRequest
{
  @IsOptional() @IsUUID() directionId?: string | null;
  @IsOptional() @IsUUID() departmentId?: string | null;
  @IsOptional() @IsUUID() positionId?: string | null;
  @IsOptional() @IsString() functionalRole?: string | null;
  @IsOptional() @IsUUID() managerEmployeeId?: string | null;
  @IsOptional() @IsUUID() mentorEmployeeId?: string | null;
  @IsOptional() @IsUUID() hrResponsibleEmployeeId?: string | null;
  @IsOptional() @IsString() @MaxLength(255) workLocation?: string | null;
  @IsOptional() @IsString() @MaxLength(64) workFormat?: string | null;
  @IsOptional() @IsString() @MaxLength(64) employmentType?: string | null;
  @IsOptional() @IsString() @MaxLength(64) contractType?: string | null;
  @IsOptional() @IsString() startDate?: string | null;
  @IsOptional() @IsString() endDate?: string | null;
  @IsOptional() @IsString() probationStartDate?: string | null;
  @IsOptional() @IsString() probationEndDate?: string | null;
  @IsOptional() @IsString() comment?: string | null;
  /** @deprecated use managementKind. */
  @IsOptional() @IsBoolean() isDepartmentManager?: boolean;
  @IsOptional()
  @IsIn(['none', 'departments', 'direction'] satisfies EmploymentManagementKind[])
  managementKind?: EmploymentManagementKind;
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  managedDepartmentIds?: string[];
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  managedDirectionIds?: string[];
}

export class UpdateEmploymentAssignmentDto
  extends CreateEmploymentAssignmentDto
  implements UpdateEmploymentAssignmentRequest {}

type _CreateDtoHasNoExtraFields = AssertNever<
  Exclude<
    keyof CreateEmploymentAssignmentDto,
    keyof CreateEmploymentAssignmentRequest
  >
>;
type _CreateContractHasNoMissingFields = AssertNever<
  Exclude<
    keyof CreateEmploymentAssignmentRequest,
    keyof CreateEmploymentAssignmentDto
  >
>;
type _UpdateDtoHasNoExtraFields = AssertNever<
  Exclude<
    keyof UpdateEmploymentAssignmentDto,
    keyof UpdateEmploymentAssignmentRequest
  >
>;
type _UpdateContractHasNoMissingFields = AssertNever<
  Exclude<
    keyof UpdateEmploymentAssignmentRequest,
    keyof UpdateEmploymentAssignmentDto
  >
>;

void 0 as unknown as _CreateDtoHasNoExtraFields;
void 0 as unknown as _CreateContractHasNoMissingFields;
void 0 as unknown as _UpdateDtoHasNoExtraFields;
void 0 as unknown as _UpdateContractHasNoMissingFields;
