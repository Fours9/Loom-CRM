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
import { DirectionsService } from './directions.service';

class CreateDirectionDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;
}

class UpdateDirectionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  code?: string | null;

  @IsOptional()
  @IsUUID()
  companyId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller('directions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DirectionsController {
  constructor(private readonly directions: DirectionsService) {}

  @Get()
  @RequirePermissions(Permission.EmployeesView)
  findAll() {
    return this.directions.findAll();
  }

  @Post()
  @RequirePermissions(Permission.DirectionsManage)
  create(@Body() dto: CreateDirectionDto) {
    return this.directions.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.DirectionsManage)
  update(@Param('id') id: string, @Body() dto: UpdateDirectionDto) {
    return this.directions.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DirectionsManage)
  async remove(@Param('id') id: string) {
    await this.directions.hardDelete(id);
    return { ok: true };
  }
}
