import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Permission } from '../../platform/permissions/permission.names';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../platform/permissions/permissions.guard';
import { RequirePermissions } from '../../platform/permissions/require-permissions.decorator';
import { CurrentUser } from '../../platform/auth/decorators/current-user.decorator';
import { User } from '../../platform/identity/user.entity';
import { UserRole } from '../../platform/identity/user.enums';
import { EmployeesService } from './employees.service';
import { EmployeeProfileExportService } from './employee-profile-export.service';
import { contentDisposition } from './employee-pdf-filename';

class CreateEmployeeDto {
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
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  positionId?: string | null;

  @IsOptional()
  @IsString()
  employeeNumber?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

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
  @IsBoolean()
  createAccount?: boolean;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  temporaryPassword?: string;
}

class UpdateEmployeeDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() middleName?: string | null;
  @IsOptional() @IsString() employeeNumber?: string;
  @IsOptional() @IsUUID() departmentId?: string | null;
  @IsOptional() @IsUUID() positionId?: string | null;
  @IsOptional() @IsString() calendarColor?: string | null;
  @IsOptional() @IsString() phoneNumber?: string | null;
  @IsOptional() @IsString() telegram?: string | null;
  @IsOptional() @IsString() workEmail?: string | null;
  @IsOptional() @IsString() personalPhoneNumber?: string | null;
  @IsOptional() @IsString() personalTelegram?: string | null;
  @IsOptional() @IsString() personalEmail?: string | null;
  @IsOptional() @IsString() comment?: string | null;
  @IsOptional() @IsString() adminComment?: string | null;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsBoolean() isDepartmentManager?: boolean;
  @IsOptional() @IsString() profileVisibilityOverride?: string | null;
  @IsOptional() @IsString() absenceVisibilityOverride?: string | null;
  @IsOptional() @IsString() showAbsenceTypeToPeersOverride?: string | null;
}

class ScheduleDayDto {
  @IsInt() @Min(1) @Max(7) weekday!: number;
  @IsOptional() @IsBoolean() isWorkingDay?: boolean;
  @IsOptional() @IsBoolean() isDayOff?: boolean;
  @IsOptional() @IsString() startTime?: string | null;
  @IsOptional() @IsString() endTime?: string | null;
  @IsOptional() @IsString() breakStart?: string | null;
  @IsOptional() @IsString() breakEnd?: string | null;
  @IsOptional() @IsString() note?: string | null;
}

class ReplaceScheduleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayDto)
  days!: ScheduleDayDto[];
}

class AttachAccountDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) temporaryPassword!: string;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
}

class AccountStatusDto {
  @IsString() status!: 'active' | 'deactivated';
}

@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly exportService: EmployeeProfileExportService,
  ) {}

  @Get()
  @RequirePermissions(Permission.EmployeesView)
  findAll(
    @CurrentUser() user: User,
    @Query('q') q?: string,
    @Query('departmentId') departmentId?: string,
    @Query('departmentIds') departmentIds?: string | string[],
    @Query('positionId') positionId?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    return this.employees.findAll(user, {
      q,
      departmentId,
      departmentIds: this.parseIdList(departmentIds),
      positionId,
      status,
      sortBy,
      sortDir,
    });
  }

  @Get('next-number')
  @RequirePermissions(Permission.EmployeesCreate)
  previewNextNumber(
    @CurrentUser() user: User,
    @Query('role') role?: UserRole,
  ) {
    return this.employees.previewNextEmployeeNumber(
      user,
      role ?? UserRole.Employee,
    );
  }

  @Get(':id/export.pdf')
  @RequirePermissions(Permission.EmployeesView)
  async exportPdf(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, asciiFilename, utf8Filename } =
      await this.exportService.exportPdf(user, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': contentDisposition(asciiFilename, utf8Filename),
      'Content-Length': buffer.length,
    });
    return new StreamableFile(buffer);
  }

  @Get(':id')
  @RequirePermissions(Permission.EmployeesView)
  findOne(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.employees.findOne(user, id);
  }

  @Post()
  @RequirePermissions(Permission.EmployeesCreate)
  create(@CurrentUser() user: User, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.EmployeesEdit)
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employees.update(user, id, dto);
  }

  @Post(':id/account')
  @RequirePermissions(Permission.EmployeesEdit)
  attachAccount(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachAccountDto,
  ) {
    return this.employees.attachAccount(user, id, dto);
  }

  @Patch(':id/account/status')
  @RequirePermissions(Permission.EmployeesEdit)
  updateAccountStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AccountStatusDto,
  ) {
    return this.employees.updateAccountStatus(user, id, dto.status);
  }

  @Delete(':id/account')
  @RequirePermissions(Permission.EmployeesEdit)
  deleteAccount(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employees.deleteAccount(user, id);
  }

  @Post(':id/deactivate')
  @RequirePermissions(Permission.EmployeesEdit)
  deactivate(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employees.updateAccountStatus(user, id, 'deactivated');
  }

  @Post(':id/activate')
  @RequirePermissions(Permission.EmployeesEdit)
  activate(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employees.updateAccountStatus(user, id, 'active');
  }

  @Get(':id/schedule')
  @RequirePermissions(Permission.EmployeesView)
  getSchedule(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employees.getSchedule(user, id);
  }

  @Put(':id/schedule')
  @RequirePermissions(Permission.EmployeesEdit)
  replaceSchedule(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceScheduleDto,
  ) {
    return this.employees.replaceSchedule(user, id, dto.days);
  }

  private parseIdList(value?: string | string[]): string[] {
    if (!value) return [];
    const raw = Array.isArray(value) ? value : value.split(',');
    return [...new Set(raw.map((id) => id.trim()).filter(Boolean))];
  }
}
