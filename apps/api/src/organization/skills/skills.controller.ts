import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Permission } from '../../platform/permissions/permission.names';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../platform/permissions/permissions.guard';
import { RequirePermissions } from '../../platform/permissions/require-permissions.decorator';
import { SkillsService } from './skills.service';

class CreateSkillGroupDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

class UpdateSkillGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class CreateSkillDto {
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  groupId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['range', 'percent'])
  scaleKind?: 'range' | 'percent';

  @IsOptional()
  @IsInt()
  scaleMin?: number;

  @IsOptional()
  @IsInt()
  scaleMax?: number;
}

class UpdateSkillDto {
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  groupId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(['range', 'percent'])
  scaleKind?: 'range' | 'percent';

  @IsOptional()
  @IsInt()
  scaleMin?: number;

  @IsOptional()
  @IsInt()
  scaleMax?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

  @Get('skill-groups')
  @RequirePermissions(Permission.EmployeesView)
  listGroups(@Query('all') all?: string) {
    return this.skills.findGroups(all === '1' || all === 'true');
  }

  @Post('skill-groups')
  @RequirePermissions(Permission.PositionsManage)
  createGroup(@Body() dto: CreateSkillGroupDto) {
    return this.skills.createCustomGroup(dto);
  }

  @Patch('skill-groups/:id')
  @RequirePermissions(Permission.PositionsManage)
  updateGroup(@Param('id') id: string, @Body() dto: UpdateSkillGroupDto) {
    return this.skills.updateGroup(id, dto);
  }

  @Delete('skill-groups/:id')
  @RequirePermissions(Permission.PositionsManage)
  async removeGroup(@Param('id') id: string) {
    await this.skills.hardDeleteGroup(id);
    return { ok: true };
  }

  @Get('skills')
  @RequirePermissions(Permission.EmployeesView)
  listSkills(
    @Query('all') all?: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.skills.findSkills({
      all: all === '1' || all === 'true',
      groupId: groupId || undefined,
    });
  }

  @Post('skills')
  @RequirePermissions(Permission.PositionsManage)
  createSkill(@Body() dto: CreateSkillDto) {
    return this.skills.createSkill(dto);
  }

  @Patch('skills/:id')
  @RequirePermissions(Permission.PositionsManage)
  updateSkill(@Param('id') id: string, @Body() dto: UpdateSkillDto) {
    return this.skills.updateSkill(id, dto);
  }

  @Delete('skills/:id')
  @RequirePermissions(Permission.PositionsManage)
  async removeSkill(@Param('id') id: string) {
    await this.skills.hardDeleteSkill(id);
    return { ok: true };
  }
}
