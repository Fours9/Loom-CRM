import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Permission } from '../../platform/permissions/permission.names';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../platform/permissions/permissions.guard';
import { RequirePermissions } from '../../platform/permissions/require-permissions.decorator';
import { CurrentUser } from '../../platform/auth/decorators/current-user.decorator';
import { User } from '../../platform/identity/user.entity';
import { AbsenceType } from './absence.enums';
import { AbsenceRequestsService } from './absence-requests.service';
import { AbsenceCalendarService } from './calendar/absence-calendar.service';

class CreateAbsenceDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsEnum(AbsenceType)
  type!: AbsenceType;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  absenceStartTime?: string | null;

  @IsOptional()
  @IsString()
  absenceEndTime?: string | null;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  isUnpaid?: boolean;

  @IsOptional()
  @IsString()
  employeeComment?: string | null;
}

class UpdateAbsenceDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsEnum(AbsenceType)
  type?: AbsenceType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsString()
  absenceStartTime?: string | null;

  @IsOptional()
  @IsString()
  absenceEndTime?: string | null;

  @IsOptional()
  @IsBoolean()
  isUnpaid?: boolean;

  @IsOptional()
  @IsString()
  reason?: string | null;

  @IsOptional()
  @IsString()
  employeeComment?: string | null;

  @IsOptional()
  @IsString()
  adjustmentComment?: string;
}

class DecisionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  version?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  decisionComment?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  deletionComment?: string;

  @IsOptional()
  @IsString()
  adjustmentComment?: string;
}

class AdjustDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsEnum(AbsenceType)
  type?: AbsenceType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsString()
  absenceStartTime?: string | null;

  @IsOptional()
  @IsString()
  absenceEndTime?: string | null;

  @IsOptional()
  @IsBoolean()
  isUnpaid?: boolean;

  @IsOptional()
  @IsString()
  reason?: string | null;

  @IsOptional()
  @IsString()
  employeeComment?: string | null;

  @IsOptional()
  @IsString()
  adjustmentComment?: string;
}

@Controller('absences')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AbsencesController {
  constructor(
    private readonly requests: AbsenceRequestsService,
    private readonly calendar: AbsenceCalendarService,
  ) {}

  @Get('metadata')
  @RequirePermissions(Permission.AbsencesCalendarView)
  metadata(@CurrentUser() user: User) {
    return this.requests.metadata(user);
  }

  @Get('requests')
  @RequirePermissions(Permission.AbsencesCalendarView)
  list(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('scope') scope?: 'mine' | 'managed' | 'all',
    @Query('status') status?: string,
    @Query('statusGroup') statusGroup?: string,
    @Query('statusGroups') statusGroups?: string,
    @Query('type') type?: string,
    @Query('types') types?: string,
    @Query('employeeId') employeeId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('departmentIds') departmentIds?: string,
    @Query('positionId') positionId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.requests.findAll(user, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      scope,
      status,
      statusGroup,
      statusGroups: statusGroups
        ? statusGroups.split(',').filter(Boolean)
        : undefined,
      type,
      types: types ? types.split(',').filter(Boolean) : undefined,
      employeeId,
      departmentId,
      departmentIds: departmentIds
        ? departmentIds.split(',').filter(Boolean)
        : undefined,
      positionId,
      sortBy,
      sortDir,
    });
  }

  @Get('employees/:employeeId/requests')
  @RequirePermissions(Permission.AbsencesCalendarView)
  employeeRequests(
    @CurrentUser() user: User,
    @Param('employeeId') employeeId: string,
  ) {
    return this.requests.findForEmployee(user, employeeId);
  }

  @Get('employees/:employeeId/document-items')
  @RequirePermissions(Permission.AbsencesCalendarView)
  employeeDocumentItems(
    @CurrentUser() user: User,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return this.requests.documentItemsForEmployee(user, employeeId);
  }

  @Post('requests')
  @RequirePermissions(Permission.AbsencesCreate)
  create(@CurrentUser() user: User, @Body() dto: CreateAbsenceDto) {
    return this.requests.create(user, dto);
  }

  @Get('requests/:id')
  @RequirePermissions(Permission.AbsencesCalendarView)
  one(@CurrentUser() user: User, @Param('id') id: string) {
    return this.requests.findOne(user, id);
  }

  @Patch('requests/:id')
  @RequirePermissions(Permission.AbsencesCreate)
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateAbsenceDto,
  ) {
    return this.requests.updatePending(user, id, dto);
  }

  @Delete('requests/:id')
  @RequirePermissions(Permission.AbsencesCancel)
  remove(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('version') version?: string,
  ) {
    return this.requests.deletePending(
      user,
      id,
      version ? Number(version) : undefined,
    );
  }

  @Post('requests/:id/approve')
  @RequirePermissions(Permission.AbsencesApprove)
  approve(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.requests.approve(user, id, dto);
  }

  @Post('requests/:id/reject')
  @RequirePermissions(Permission.AbsencesApprove)
  reject(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.requests.reject(user, id, dto);
  }

  @Post('requests/:id/cancel')
  @RequirePermissions(Permission.AbsencesCancel)
  cancel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.requests.deletePending(user, id);
  }

  @Post('requests/:id/adjust')
  @RequirePermissions(Permission.AbsencesApprove)
  adjust(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: AdjustDto,
  ) {
    return this.requests.adjust(user, id, dto);
  }

  @Post('requests/:id/request-deletion')
  @RequirePermissions(Permission.AbsencesCancel)
  requestDeletion(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.requests.requestDeletion(user, id, dto);
  }

  @Post('requests/:id/approve-deletion')
  @RequirePermissions(Permission.AbsencesApprove)
  approveDeletion(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.requests.approveDeletion(user, id, dto);
  }

  @Post('requests/:id/reject-deletion')
  @RequirePermissions(Permission.AbsencesApprove)
  rejectDeletion(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.requests.rejectDeletion(user, id, dto);
  }

  @Get('requests/:id/attachments')
  @RequirePermissions(Permission.AbsencesCalendarView)
  listAttachments(@CurrentUser() user: User, @Param('id') id: string) {
    return this.requests.listAttachments(user, id);
  }

  @Post('requests/:id/attachments')
  @RequirePermissions(Permission.AbsencesCreate)
  @UseInterceptors(FileInterceptor('file'))
  addAttachment(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.requests.addAttachmentFile(user, id, file);
  }

  @Delete('requests/:id/attachments/:attachmentId')
  @RequirePermissions(Permission.AbsencesCreate)
  removeAttachment(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.requests.removeAttachment(user, id, attachmentId);
  }

  @Get('requests/:id/attachments/:attachmentId/download')
  @RequirePermissions(Permission.AbsencesCalendarView)
  async downloadAttachment(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const file = await this.requests.downloadAttachment(user, id, attachmentId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    );
    res.send(file.buffer);
  }

  @Get('calendar')
  @RequirePermissions(Permission.AbsencesCalendarView)
  calendarRange(
    @CurrentUser() user: User,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.calendar.getRange(user, from, to);
  }

  @Get('calendar/days/:date')
  @RequirePermissions(Permission.AbsencesCalendarView)
  calendarDay(@CurrentUser() user: User, @Param('date') date: string) {
    return this.calendar.getDay(user, date);
  }
}
