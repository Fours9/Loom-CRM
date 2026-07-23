import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { Permission } from '../../platform/permissions/permission.names';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../platform/permissions/permissions.guard';
import { RequirePermissions } from '../../platform/permissions/require-permissions.decorator';
import { DepartmentsService } from './departments.service';

class CreateDepartmentDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;
}

@Controller('departments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @RequirePermissions(Permission.EmployeesView)
  findAll() {
    return this.departments.findAll();
  }

  @Post()
  @RequirePermissions(Permission.DepartmentsManage)
  create(@Body() dto: CreateDepartmentDto) {
    return this.departments.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.DepartmentsManage)
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departments.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DepartmentsManage)
  async remove(@Param('id') id: string) {
    await this.departments.softDelete(id);
    return { ok: true };
  }
}
