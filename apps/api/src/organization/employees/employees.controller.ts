import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
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
import { EmployeesService } from './employees.service';

class CreateEmployeeDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  positionId?: string | null;
}

class ScheduleDayDto {
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @IsOptional()
  @IsString()
  startTime?: string | null;

  @IsOptional()
  @IsString()
  endTime?: string | null;

  @IsOptional()
  @IsBoolean()
  isDayOff?: boolean;
}

class ReplaceScheduleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayDto)
  days!: ScheduleDayDto[];
}

@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @RequirePermissions(Permission.EmployeesView)
  findAll(@CurrentUser() user: User) {
    return this.employees.findAll(user);
  }

  @Get(':id')
  @RequirePermissions(Permission.EmployeesView)
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.employees.findOne(user, id);
  }

  @Post()
  @RequirePermissions(Permission.EmployeesCreate)
  create(@CurrentUser() user: User, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(user, dto);
  }

  @Get(':id/schedule')
  @RequirePermissions(Permission.EmployeesView)
  getSchedule(@CurrentUser() user: User, @Param('id') id: string) {
    return this.employees.getSchedule(user, id);
  }

  @Put(':id/schedule')
  @RequirePermissions(Permission.EmployeesEdit)
  replaceSchedule(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: ReplaceScheduleDto,
  ) {
    return this.employees.replaceSchedule(user, id, dto.days);
  }
}
