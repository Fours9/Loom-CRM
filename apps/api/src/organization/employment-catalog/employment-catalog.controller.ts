import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Permission } from '../../platform/permissions/permission.names';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../platform/auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../../platform/permissions/permissions.guard';
import { RequirePermissions } from '../../platform/permissions/require-permissions.decorator';
import { AuthorizationContextService } from '../../platform/access-control/authorization-context.service';
import { hasPermission } from '../../platform/access-control/authorization-context';
import { User } from '../../platform/identity/user.entity';
import { EmploymentCatalogService } from './employment-catalog.service';
import { EMPLOYMENT_CATALOG_DESCRIPTION_MAX } from './employment-catalog.helpers';

class CreateCatalogItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(EMPLOYMENT_CATALOG_DESCRIPTION_MAX)
  description?: string | null;
}

class UpdateCatalogItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(EMPLOYMENT_CATALOG_DESCRIPTION_MAX)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class ReorderCatalogDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  orderedIds!: string[];
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmploymentCatalogController {
  constructor(
    private readonly catalogs: EmploymentCatalogService,
    private readonly authorization: AuthorizationContextService,
  ) {}

  @Get('work-formats')
  @RequirePermissions(Permission.EmployeesView)
  async listWorkFormats(@CurrentUser() user: User, @Query('all') all?: string) {
    await this.assertCanSeeAll(user, all);
    return this.catalogs.listWorkFormats(all === '1' || all === 'true');
  }

  @Post('work-formats')
  @RequirePermissions(Permission.PositionsManage)
  createWorkFormat(@Body() dto: CreateCatalogItemDto) {
    return this.catalogs.createWorkFormat(dto);
  }

  @Put('work-formats/reorder')
  @RequirePermissions(Permission.PositionsManage)
  reorderWorkFormats(@Body() dto: ReorderCatalogDto) {
    return this.catalogs.reorderWorkFormats(dto.orderedIds);
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
  async listEmploymentTypes(
    @CurrentUser() user: User,
    @Query('all') all?: string,
  ) {
    await this.assertCanSeeAll(user, all);
    return this.catalogs.listEmploymentTypes(all === '1' || all === 'true');
  }

  @Post('employment-types')
  @RequirePermissions(Permission.PositionsManage)
  createEmploymentType(@Body() dto: CreateCatalogItemDto) {
    return this.catalogs.createEmploymentType(dto);
  }

  @Put('employment-types/reorder')
  @RequirePermissions(Permission.PositionsManage)
  reorderEmploymentTypes(@Body() dto: ReorderCatalogDto) {
    return this.catalogs.reorderEmploymentTypes(dto.orderedIds);
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

  private async assertCanSeeAll(user: User, all?: string): Promise<void> {
    const wantsAll = all === '1' || all === 'true';
    if (!wantsAll) {
      return;
    }
    const authz = await this.authorization.resolve(user.id);
    if (!hasPermission(authz, Permission.PositionsManage)) {
      throw new ForbiddenException(
        'Only PositionsManage may view inactive catalog rows',
      );
    }
  }
}
