import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Permission } from '../../../platform/permissions/permission.names';
import { JwtAuthGuard } from '../../../platform/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../platform/permissions/permissions.guard';
import { RequirePermissions } from '../../../platform/permissions/require-permissions.decorator';
import {
  ABSENCE_VISIBILITY_MODES,
  PROFILE_VISIBILITY_MODES,
} from './privacy-settings.keys';
import { PrivacySettingsService } from './privacy-settings.service';

class UpdatePrivacySettingsDto {
  @IsOptional()
  @IsIn([...ABSENCE_VISIBILITY_MODES])
  absenceVisibilityMode?: (typeof ABSENCE_VISIBILITY_MODES)[number];

  @IsOptional()
  @IsIn([...PROFILE_VISIBILITY_MODES])
  profileVisibilityMode?: (typeof PROFILE_VISIBILITY_MODES)[number];

  @IsOptional()
  @IsBoolean()
  globalPrivacyPriority?: boolean;

  @IsOptional()
  @IsBoolean()
  showDepartmentOnCalendar?: boolean;

  @IsOptional()
  @IsBoolean()
  showPositionOnCalendar?: boolean;

  @IsOptional()
  @IsBoolean()
  showAbsenceTypeToPeers?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24 * 60)
  sessionInactivityMinutes?: number;
}

@Controller('settings/privacy')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PrivacySettingsController {
  constructor(private readonly privacy: PrivacySettingsService) {}

  /** Used by admin page + employee override UI (`globalPrivacyPriority`). */
  @Get()
  @RequirePermissions(Permission.AbsencesCalendarView)
  get() {
    return this.privacy.get();
  }

  @Put()
  @RequirePermissions(Permission.AbsencesAdmin)
  update(@Body() dto: UpdatePrivacySettingsDto) {
    return this.privacy.update(dto);
  }
}
