import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type {
  CreateEmployeeRequest,
  EmployeeCreateScheduleDay,
  EmploymentManagementKind,
} from '@loom/contracts-employees';

type AssertNever<T extends never> = T;

export class ScheduleDayDto implements EmployeeCreateScheduleDay {
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @IsOptional()
  @IsBoolean()
  isWorkingDay?: boolean;

  @IsOptional()
  @IsBoolean()
  isDayOff?: boolean;

  @IsOptional()
  @IsString()
  startTime?: string | null;

  @IsOptional()
  @IsString()
  endTime?: string | null;

  @IsOptional()
  @IsString()
  breakStart?: string | null;

  @IsOptional()
  @IsString()
  breakEnd?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}

export class CreateEmployeeDto implements CreateEmployeeRequest {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsOptional()
  @IsString()
  middleName?: string | null;

  @IsOptional()
  @IsUUID()
  directionId?: string | null;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  positionId?: string | null;

  @IsOptional()
  @IsString()
  employeeNumber?: string;

  @IsOptional()
  @IsString()
  calendarColor?: string | null;

  @IsOptional()
  @IsString()
  phoneNumber?: string | null;

  @IsOptional()
  @IsString()
  telegram?: string | null;

  @IsOptional()
  @IsString()
  workEmail?: string | null;

  @IsOptional()
  @IsString()
  personalPhoneNumber?: string | null;

  @IsOptional()
  @IsString()
  personalTelegram?: string | null;

  @IsOptional()
  @IsString()
  personalEmail?: string | null;

  @IsOptional()
  @IsBoolean()
  createAccount?: boolean;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  temporaryPassword?: string;

  @IsOptional()
  @IsUUID()
  accountRoleId?: string;

  @IsOptional()
  @IsIn(['none', 'departments', 'direction'] satisfies EmploymentManagementKind[])
  managementKind?: EmploymentManagementKind;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayDto)
  schedule?: ScheduleDayDto[];
}

/** Compile-time exact key parity: DTO ↔ CreateEmployeeRequest. */
type _CreateDtoHasNoExtraFields = AssertNever<
  Exclude<keyof CreateEmployeeDto, keyof CreateEmployeeRequest>
>;
type _CreateContractHasNoMissingFields = AssertNever<
  Exclude<keyof CreateEmployeeRequest, keyof CreateEmployeeDto>
>;

/** Nested schedule day exact key parity. */
type _ScheduleDayDtoHasNoExtraFields = AssertNever<
  Exclude<keyof ScheduleDayDto, keyof EmployeeCreateScheduleDay>
>;
type _ScheduleDayContractHasNoMissingFields = AssertNever<
  Exclude<keyof EmployeeCreateScheduleDay, keyof ScheduleDayDto>
>;

void 0 as unknown as _CreateDtoHasNoExtraFields;
void 0 as unknown as _CreateContractHasNoMissingFields;
void 0 as unknown as _ScheduleDayDtoHasNoExtraFields;
void 0 as unknown as _ScheduleDayContractHasNoMissingFields;
