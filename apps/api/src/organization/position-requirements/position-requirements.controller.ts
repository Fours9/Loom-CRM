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
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Permission } from '../../platform/permissions/permission.names';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../platform/permissions/permissions.guard';
import { RequirePermissions } from '../../platform/permissions/require-permissions.decorator';
import { PositionRequirementsService } from './position-requirements.service';

const GOAL_KINDS = ['career', 'probation', 'quarterly'] as const;

class CreateSkillRequirementDto {
  @IsUUID()
  skillId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  targetLevel?: number;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  weight?: number | null;
}

class UpdateSkillRequirementDto {
  @IsOptional()
  @IsUUID()
  skillId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  targetLevel?: number;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  weight?: number | null;
}

class CreateDutyDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

class UpdateDutyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class CreateGoalTemplateDto {
  @IsIn(GOAL_KINDS)
  goalKind!: (typeof GOAL_KINDS)[number];

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

class UpdateGoalTemplateDto {
  @IsOptional()
  @IsIn(GOAL_KINDS)
  goalKind?: (typeof GOAL_KINDS)[number];

  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller('positions/:positionId')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PositionRequirementsController {
  constructor(private readonly requirements: PositionRequirementsService) {}

  @Get('skill-requirements')
  @RequirePermissions(Permission.EmployeesView)
  listSkillRequirements(@Param('positionId') positionId: string) {
    return this.requirements.listSkillRequirements(positionId);
  }

  @Post('skill-requirements')
  @RequirePermissions(Permission.PositionsManage)
  createSkillRequirement(
    @Param('positionId') positionId: string,
    @Body() dto: CreateSkillRequirementDto,
  ) {
    return this.requirements.createSkillRequirement(positionId, dto);
  }

  @Patch('skill-requirements/:id')
  @RequirePermissions(Permission.PositionsManage)
  updateSkillRequirement(
    @Param('positionId') positionId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSkillRequirementDto,
  ) {
    return this.requirements.updateSkillRequirement(positionId, id, dto);
  }

  @Delete('skill-requirements/:id')
  @RequirePermissions(Permission.PositionsManage)
  async removeSkillRequirement(
    @Param('positionId') positionId: string,
    @Param('id') id: string,
  ) {
    await this.requirements.deleteSkillRequirement(positionId, id);
    return { ok: true };
  }

  @Get('duties')
  @RequirePermissions(Permission.EmployeesView)
  listDuties(
    @Param('positionId') positionId: string,
    @Query('all') all?: string,
  ) {
    return this.requirements.listDuties(
      positionId,
      all === '1' || all === 'true',
    );
  }

  @Post('duties')
  @RequirePermissions(Permission.PositionsManage)
  createDuty(
    @Param('positionId') positionId: string,
    @Body() dto: CreateDutyDto,
  ) {
    return this.requirements.createDuty(positionId, dto);
  }

  @Patch('duties/:id')
  @RequirePermissions(Permission.PositionsManage)
  updateDuty(
    @Param('positionId') positionId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDutyDto,
  ) {
    return this.requirements.updateDuty(positionId, id, dto);
  }

  @Delete('duties/:id')
  @RequirePermissions(Permission.PositionsManage)
  async removeDuty(
    @Param('positionId') positionId: string,
    @Param('id') id: string,
  ) {
    await this.requirements.deleteDuty(positionId, id);
    return { ok: true };
  }

  @Get('goal-templates')
  @RequirePermissions(Permission.EmployeesView)
  listGoalTemplates(
    @Param('positionId') positionId: string,
    @Query('all') all?: string,
  ) {
    return this.requirements.listGoalTemplates(
      positionId,
      all === '1' || all === 'true',
    );
  }

  @Post('goal-templates')
  @RequirePermissions(Permission.PositionsManage)
  createGoalTemplate(
    @Param('positionId') positionId: string,
    @Body() dto: CreateGoalTemplateDto,
  ) {
    return this.requirements.createGoalTemplate(positionId, dto);
  }

  @Patch('goal-templates/:id')
  @RequirePermissions(Permission.PositionsManage)
  updateGoalTemplate(
    @Param('positionId') positionId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGoalTemplateDto,
  ) {
    return this.requirements.updateGoalTemplate(positionId, id, dto);
  }

  @Delete('goal-templates/:id')
  @RequirePermissions(Permission.PositionsManage)
  async removeGoalTemplate(
    @Param('positionId') positionId: string,
    @Param('id') id: string,
  ) {
    await this.requirements.deleteGoalTemplate(positionId, id);
    return { ok: true };
  }
}
