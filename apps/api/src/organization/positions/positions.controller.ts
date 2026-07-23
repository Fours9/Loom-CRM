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
import { IsBoolean, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { Permission } from '../../platform/permissions/permission.names';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../platform/permissions/permissions.guard';
import { RequirePermissions } from '../../platform/permissions/require-permissions.decorator';
import { PositionsService } from './positions.service';

class CreatePositionDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class UpdatePositionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller('positions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PositionsController {
  constructor(private readonly positions: PositionsService) {}

  @Get()
  @RequirePermissions(Permission.EmployeesView)
  findAll() {
    return this.positions.findAll();
  }

  @Post()
  @RequirePermissions(Permission.PositionsManage)
  create(@Body() dto: CreatePositionDto) {
    return this.positions.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.PositionsManage)
  update(@Param('id') id: string, @Body() dto: UpdatePositionDto) {
    return this.positions.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.PositionsManage)
  async remove(@Param('id') id: string) {
    await this.positions.softDelete(id);
    return { ok: true };
  }
}
