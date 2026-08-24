import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Permission } from '../../platform/permissions/permission.names';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../platform/auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../../platform/permissions/permissions.guard';
import { RequirePermissions } from '../../platform/permissions/require-permissions.decorator';
import { permissionsForRole } from '../../platform/permissions/role-permissions';
import { User } from '../../platform/identity/user.entity';
import { EmploymentCatalogService } from './employment-catalog.service';

class CreateCatalogItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

class UpdateCatalogItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmploymentCatalogController {
  constructor(private readonly catalogs: EmploymentCatalogService) {}

  @Get('work-formats')
  @RequirePermissions(Permission.EmployeesView)
  listWorkFormats(@CurrentUser() user: User, @Query('all') all?: string) {
    this.assertCanSeeAll(user, all);
    return this.catalogs.listWorkFormats(all === '1' || all === 'true');
  }

  @Post('work-formats')
  @RequirePermissions(Permission.PositionsManage)
  createWorkFormat(@Body() dto: CreateCatalogItemDto) {
    return this.catalogs.createWorkFormat(dto);
  }

  @Patch('work-formats/:id')
  @RequirePermissions(Permission.PositionsManage)
  updateWorkFormat(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogItemDto,
  ) {
    return this.catalogs.updateWorkFormat(id, dto);
  }

  @Delete('work-formats/:id')
  @RequirePermissions(Permission.PositionsManage)
  async deleteWorkFormat(@Param('id') id: string) {
    await this.catalogs.deleteWorkFormat(id);
    return { ok: true };
  }

  @Get('employment-types')
  @RequirePermissions(Permission.EmployeesView)
  listEmploymentTypes(@CurrentUser() user: User, @Query('all') all?: string) {
    this.assertCanSeeAll(user, all);
    return this.catalogs.listEmploymentTypes(all === '1' || all === 'true');
  }

  @Post('employment-types')
  @RequirePermissions(Permission.PositionsManage)
  createEmploymentType(@Body() dto: CreateCatalogItemDto) {
    return this.catalogs.createEmploymentType(dto);
  }

  @Patch('employment-types/:id')
  @RequirePermissions(Permission.PositionsManage)
  updateEmploymentType(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogItemDto,
  ) {
    return this.catalogs.updateEmploymentType(id, dto);
  }

  @Delete('employment-types/:id')
  @RequirePermissions(Permission.PositionsManage)
  async deleteEmploymentType(@Param('id') id: string) {
    await this.catalogs.deleteEmploymentType(id);
    return { ok: true };
  }

  private assertCanSeeAll(user: User, all?: string): void {
    const wantsAll = all === '1' || all === 'true';
    if (!wantsAll) {
      return;
    }
    if (!permissionsForRole(user.role).includes(Permission.PositionsManage)) {
      throw new ForbiddenException('Only PositionsManage may view inactive catalog rows');
    }
  }
}
