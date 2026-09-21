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
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
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
import { EmployeeProfileService } from './employee-profile.service';
import { EmployeeProfileExportService } from './employee-profile-export.service';
import { contentDisposition } from './employee-pdf-filename';
import { EmployeeHistoryQueryDto } from './employee-history-query.dto';
import { EmployeeListQueryDto } from './employee-list-query.dto';
import { EmployeeAccessService } from '../access/employee-access.service';
import { EmployeeSkillMatrixService } from '../skills/employee-skill-matrix.service';
import { EmployeeAboutService } from './employee-about.service';
import { PatchEmployeeAboutSubtabDto } from './patch-employee-about.dto';
import type {
  CreateEmployeeSkillAssessmentRequest,
  EmployeeSkillMatrixResponse,
  EmployeeAboutResponse,
  PatchEmployeeAboutSubtabRequest,
  UpdateEmployeeSkillAssessmentRequest,
  UpsertEmployeeSkillAssessmentRequest,
} from '@loom/contracts-employees';
import {
  CreateEmployeeDto,
  ScheduleDayDto,
} from './create-employee.dto';
import {
  CreateEmploymentAssignmentDto,
  UpdateEmploymentAssignmentDto,
} from './employment-assignment.write.dto';

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
}

class UpdateAccessSettingsDto {
  @IsOptional() @IsUUID() accountRoleId?: string;
  @IsOptional() @IsString() profileVisibilityOverride?: string | null;
  @IsOptional() @IsString() absenceVisibilityOverride?: string | null;
  @IsOptional() @IsBoolean() showAbsenceTypeToPeersOverride?: boolean | null;
}

class UpdateAccountEmailDto {
  @IsEmail() email!: string;
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
  @IsOptional() @IsUUID() accountRoleId?: string;
}

class AccountStatusDto {
  @IsString() status!: 'active' | 'deactivated';
}

class PatchBasicDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() middleName?: string | null;
  @IsOptional() @IsString() preferredName?: string | null;
  @IsOptional() @IsString() photoUrl?: string | null;
  @IsOptional() @IsString() employeeNumber?: string;
}

class PatchContactsDto {
  @IsOptional() @IsString() workPhone?: string | null;
  @IsOptional() @IsString() workEmail?: string | null;
  @IsOptional() @IsString() workTelegram?: string | null;
}

class PatchPersonalDto {
  @IsOptional() @IsString() birthDate?: string | null;
  @IsOptional() @IsString() city?: string | null;
  @IsOptional() @IsString() preferredLanguage?: string | null;
  @IsOptional() @IsString() preferredName?: string | null;
}

class PatchEmploymentMetaDto {
  @IsOptional() @IsString() hiredAt?: string | null;
}

class PersonalContactItemDto {
  @IsIn(['personal_phone', 'personal_email', 'personal_telegram'])
  type!: 'personal_phone' | 'personal_email' | 'personal_telegram';

  @IsString()
  @MinLength(1)
  @MaxLength(320)
  value!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

class ReplacePersonalContactsDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PersonalContactItemDto)
  contacts!: PersonalContactItemDto[];
}

class EmergencyContactItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  relationship?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  primaryPhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  secondaryPhone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}

class ReplaceEmergencyContactsDto {
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactItemDto)
  contacts!: EmergencyContactItemDto[];
}

class ImportantDateItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsString()
  @MinLength(1)
  startDate!: string;

  @IsOptional()
  @IsString()
  endDate?: string | null;
}

class ReplaceImportantDatesDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ImportantDateItemDto)
  dates!: ImportantDateItemDto[];
}

class StatusTransitionDto {
  @IsString() status!: string;
  @IsOptional() @IsString() reason?: string | null;
}

class CreateSkillAssessmentDto implements CreateEmployeeSkillAssessmentRequest {
  @IsUUID()
  skillId!: string;

  @IsOptional()
  @IsInt()
  level?: number | null;
}

class UpdateSkillAssessmentDto implements UpdateEmployeeSkillAssessmentRequest {
  @IsInt()
  @ValidateIf((_, v) => v !== null)
  level!: number | null;
}

class UpsertSkillAssessmentDto implements UpsertEmployeeSkillAssessmentRequest {
  @IsUUID()
  skillId!: string;

  @IsInt()
  @ValidateIf((_, v) => v !== null)
  level!: number | null;
}

@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly profile: EmployeeProfileService,
    private readonly exportService: EmployeeProfileExportService,
    private readonly access: EmployeeAccessService,
    private readonly skillMatrix: EmployeeSkillMatrixService,
    private readonly about: EmployeeAboutService,
  ) {}

  @Get()
  @RequirePermissions(Permission.EmployeesView)
  findAll(
    @CurrentUser() user: User,
    @Query() query: EmployeeListQueryDto,
  ) {
    return this.employees.findAll(user, query);
  }

  @Get('catalogs/org')
  @RequirePermissions(Permission.EmployeesView)
  orgCatalogs() {
    return this.profile.listCatalogs();
  }

  @Get('next-number')
  @RequirePermissions(Permission.EmployeesCreate)
  previewNextNumber(
    @CurrentUser() user: User,
    @Query('positionId') positionId?: string,
  ) {
    return this.employees.previewNextEmployeeNumberFromPosition(
      user,
      positionId,
    );
  }

  @Get(':id/profile')
  @RequirePermissions(Permission.EmployeesView)
  getProfile(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.profile.getProfile(user, id);
  }

  @Get(':id/completeness')
  @RequirePermissions(Permission.EmployeesView)
  completeness(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.profile.completeness(user, id);
  }

  @Get(':id/history')
  @RequirePermissions(Permission.EmployeesView)
  history(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: EmployeeHistoryQueryDto,
  ) {
    return this.profile.history(user, id, query.limit);
  }

  @Get(':id/employment')
  @RequirePermissions(Permission.EmployeesView)
  async employment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const p = await this.profile.getProfile(user, id);
    return p.sections.employment;
  }

  @Get(':id/employment-history')
  @RequirePermissions(Permission.EmployeesView)
  employmentHistory(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.profile.employmentHistory(user, id);
  }

  @Get(':id/skill-assessments')
  @RequirePermissions(Permission.EmployeesView)
  listSkillAssessments(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmployeeSkillMatrixResponse> {
    return this.skillMatrix.listMatrix(user, id);
  }

  @Get(':id/about')
  @RequirePermissions(Permission.EmployeesView)
  getAbout(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmployeeAboutResponse> {
    return this.about.get(user, id);
  }

  @Patch(':id/about')
  @RequirePermissions(Permission.EmployeesView)
  patchAbout(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchEmployeeAboutSubtabDto,
  ): Promise<EmployeeAboutResponse> {
    return this.about.patchSubtab(user, id, dto as PatchEmployeeAboutSubtabRequest);
  }

  @Post(':id/skill-assessments')
  @RequirePermissions(Permission.EmployeesManageProfiles)
  createSkillAssessment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSkillAssessmentDto,
  ) {
    return this.skillMatrix.createExtra(user, id, dto);
  }

  @Put(':id/skill-assessments')
  @RequirePermissions(Permission.EmployeesManageProfiles)
  upsertSkillAssessment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertSkillAssessmentDto,
  ) {
    return this.skillMatrix.upsertLevel(user, id, dto);
  }

  @Patch(':id/skill-assessments/:assessmentId')
  @RequirePermissions(Permission.EmployeesManageProfiles)
  updateSkillAssessment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Body() dto: UpdateSkillAssessmentDto,
  ) {
    return this.skillMatrix.updateLevel(user, id, assessmentId, dto);
  }

  @Delete(':id/skill-assessments/:assessmentId')
  @RequirePermissions(Permission.EmployeesManageProfiles)
  deleteSkillAssessment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    return this.skillMatrix.deleteExtra(user, id, assessmentId);
  }

  @Post(':id/employment-assignments')
  @RequirePermissions(
    Permission.EmployeesManageProfiles,
    Permission.EmployeesChangeAssignment,
  )
  createAssignment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEmploymentAssignmentDto,
  ) {
    return this.profile.createAssignment(user, id, dto);
  }

  @Patch(':id/employment-assignments/:assignmentId')
  @RequirePermissions(
    Permission.EmployeesManageProfiles,
    Permission.EmployeesChangeAssignment,
  )
  updateAssignment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: UpdateEmploymentAssignmentDto,
  ) {
    return this.profile.updateAssignment(user, id, assignmentId, dto);
  }

  @Delete(':id/employment-assignments/:assignmentId')
  @RequirePermissions(
    Permission.EmployeesManageProfiles,
    Permission.EmployeesChangeAssignment,
  )
  deleteAssignment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.profile.deleteAssignment(user, id, assignmentId);
  }

  @Post(':id/status-transitions')
  @RequirePermissions(
    Permission.EmployeesManageProfiles,
    Permission.EmployeesChangeStatus,
  )
  statusTransition(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusTransitionDto,
  ) {
    return this.profile.transitionStatus(user, id, dto);
  }

  @Patch(':id/basic')
  @RequirePermissions(Permission.EmployeesManageProfiles)
  patchBasic(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchBasicDto,
  ) {
    return this.profile.patchBasic(user, id, dto);
  }

  @Patch(':id/contacts')
  @RequirePermissions(Permission.EmployeesManageProfiles)
  patchContacts(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchContactsDto,
  ) {
    return this.profile.patchContacts(user, id, dto);
  }

  @Patch(':id/personal')
  @RequirePermissions(
    Permission.EmployeesManageProfiles,
    Permission.EmployeesWritePersonal,
  )
  patchPersonal(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchPersonalDto,
  ) {
    return this.profile.patchPersonal(user, id, dto);
  }

  @Patch(':id/employment-meta')
  @RequirePermissions(Permission.EmployeesManageProfiles)
  patchEmploymentMeta(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchEmploymentMetaDto,
  ) {
    return this.profile.patchEmploymentMeta(user, id, dto);
  }

  @Put(':id/personal-contacts')
  @RequirePermissions(
    Permission.EmployeesManageProfiles,
    Permission.EmployeesWritePersonal,
  )
  putPersonalContacts(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplacePersonalContactsDto,
  ) {
    return this.profile.replacePersonalContacts(user, id, dto.contacts);
  }

  @Put(':id/emergency-contact')
  @RequirePermissions(Permission.EmployeesView)
  putEmergency(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceEmergencyContactsDto,
  ) {
    return this.profile.replaceEmergencyContacts(user, id, dto.contacts);
  }

  @Put(':id/important-dates')
  @RequirePermissions(
    Permission.EmployeesManageProfiles,
    Permission.EmployeesWritePersonal,
  )
  putImportantDates(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceImportantDatesDto,
  ) {
    return this.profile.replaceImportantDates(user, id, dto.dates);
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
  @RequirePermissions(Permission.EmployeesManageProfiles)
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employees.update(user, id, dto);
  }

  @Patch(':id/access-settings')
  @RequirePermissions(Permission.EmployeesAssignAccountRole)
  updateAccessSettings(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccessSettingsDto,
  ) {
    return this.employees.updateAccessSettings(user, id, dto);
  }

  @Patch(':id/account/email')
  @RequirePermissions(Permission.EmployeesManageProfiles)
  updateAccountEmail(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountEmailDto,
  ) {
    return this.employees.updateAccountEmail(user, id, dto.email);
  }

  @Post(':id/account')
  @RequirePermissions(Permission.EmployeesCreate)
  attachAccount(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachAccountDto,
  ) {
    return this.employees.attachAccount(user, id, dto);
  }

  @Patch(':id/account/status')
  @RequirePermissions(Permission.EmployeesManageProfiles)
  updateAccountStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AccountStatusDto,
  ) {
    return this.employees.updateAccountStatus(user, id, dto.status);
  }

  @Delete(':id/account')
  @RequirePermissions(Permission.EmployeesManageProfiles)
  deleteAccount(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employees.deleteAccount(user, id);
  }

  @Post(':id/deactivate')
  @RequirePermissions(Permission.EmployeesManageProfiles)
  deactivate(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employees.updateAccountStatus(user, id, 'deactivated');
  }

  @Post(':id/activate')
  @RequirePermissions(Permission.EmployeesManageProfiles)
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
  @RequirePermissions(Permission.EmployeesManageProfiles)
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
