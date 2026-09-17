import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../identity/user.entity';
import type { AccountRolePermissionPreset } from './account-role.entity';
import { AccountRolesService } from './account-roles.service';

class CreateAccountRoleDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(['employee', 'department_manager', 'admin'])
  permissionPreset!: AccountRolePermissionPreset;

  @IsOptional()
  @IsBoolean()
  isAdminEquivalent?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extraPermissions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  surfaceIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  questionnaireTemplateCodes?: string[];
}

class UpdateAccountRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(['employee', 'department_manager', 'admin'])
  permissionPreset?: AccountRolePermissionPreset;

  @IsOptional()
  @IsBoolean()
  isAdminEquivalent?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extraPermissions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  surfaceIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  questionnaireTemplateCodes?: string[];
}

class ReplaceSurfacesDto {
  @IsArray()
  @IsString({ each: true })
  surfaceIds!: string[];
}

class ReplaceQuestionnaireTemplatesDto {
  @IsArray()
  @IsString({ each: true })
  questionnaireTemplateCodes!: string[];
}

/**
 * Settings «Доступи». Authorization is admin-equivalent (checked inside the
 * service against AuthorizationContext), not a permission decorator — a
 * `settings.manage` grant must not allow privilege escalation (ADR 0011 §8).
 */
@Controller('settings/account-roles')
@UseGuards(JwtAuthGuard)
export class AccountRolesController {
  constructor(private readonly accountRoles: AccountRolesService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.accountRoles.list(user.id);
  }

  @Get('surfaces')
  listSurfaces(@CurrentUser() user: User) {
    return this.accountRoles.listSurfaces(user.id);
  }

  @Get('assignable')
  listAssignable(@CurrentUser() user: User) {
    return this.accountRoles.listAssignable(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: User, @Param('id') id: string) {
    return this.accountRoles.get(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateAccountRoleDto) {
    return this.accountRoles.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateAccountRoleDto,
  ) {
    return this.accountRoles.update(user.id, id, dto);
  }

  @Put(':id/surfaces')
  replaceSurfaces(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: ReplaceSurfacesDto,
  ) {
    return this.accountRoles.replaceSurfaces(user.id, id, dto.surfaceIds);
  }

  @Put(':id/questionnaire-templates')
  replaceQuestionnaireTemplates(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: ReplaceQuestionnaireTemplatesDto,
  ) {
    return this.accountRoles.replaceQuestionnaireTemplates(
      user.id,
      id,
      dto.questionnaireTemplateCodes,
    );
  }

  @Delete(':id')
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.accountRoles.remove(user.id, id);
    return { ok: true };
  }
}
