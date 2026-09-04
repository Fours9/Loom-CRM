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
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Permission } from '../../platform/permissions/permission.names';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../platform/permissions/permissions.guard';
import { RequirePermissions } from '../../platform/permissions/require-permissions.decorator';
import { CurrentUser } from '../../platform/auth/decorators/current-user.decorator';
import { User } from '../../platform/identity/user.entity';
import { AuthorizationContextService } from '../../platform/access-control/authorization-context.service';
import { PositionsService } from './positions.service';
import { PositionManagementScopePolicy } from './position-management-scope.policy';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { Department } from '../departments/department.entity';
import { CurrentEmploymentAssignmentResolver } from '../employment-catalog/current-employment-assignment.resolver';

class CreatePositionDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  directionId?: string | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDepartmentManagerTemplate?: boolean;

  @IsOptional()
  @IsString()
  managementKindTemplate?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  managedDepartmentIds?: string[];
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
  @IsUUID()
  directionId?: string | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDepartmentManagerTemplate?: boolean;

  @IsOptional()
  @IsString()
  managementKindTemplate?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  managedDepartmentIds?: string[];
}

@Controller('positions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PositionsController {
  private readonly scopePolicy: PositionManagementScopePolicy;

  constructor(
    private readonly positions: PositionsService,
    private readonly authorization: AuthorizationContextService,
    private readonly currentAssignment: CurrentEmploymentAssignmentResolver,
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
    @InjectRepository(Department)
    private readonly departments: Repository<Department>,
  ) {
    this.scopePolicy = new PositionManagementScopePolicy(
      this.authorization,
      this.currentAssignment,
    );
  }

  @Get()
  @RequirePermissions(Permission.EmployeesView)
  findAll(
    @Query('all') all?: string,
    @Query('departmentId') departmentId?: string,
    @Query('directionId') directionId?: string,
    @Query('globalsOnly') globalsOnly?: string,
  ) {
    return this.positions.findAll({
      all: all === '1' || all === 'true',
      departmentId: departmentId || undefined,
      directionId: directionId || undefined,
      globalsOnly: globalsOnly === '1' || globalsOnly === 'true',
    });
  }

  @Get('manage')
  @RequirePermissions(Permission.PositionsManage)
  async findManageable(
    @CurrentUser() user: User,
    @Query('all') all?: string,
  ) {
    const scope = await this.scopePolicy.resolveForActor(
      user,
      this.employees,
      this.currentAssignment,
      this.departments,
    );
    return this.positions.findManageable({
      all: all === '1' || all === 'true',
      directionId: scope.directionId,
      isAdminEquivalent: scope.isAdminEquivalent,
    });
  }

  @Post()
  @RequirePermissions(Permission.PositionsManage)
  async create(@CurrentUser() user: User, @Body() dto: CreatePositionDto) {
    const scope = await this.scopePolicy.resolveForActor(
      user,
      this.employees,
      this.currentAssignment,
      this.departments,
    );
    const departmentId = dto.departmentId ?? null;
    const directionId = dto.directionId ?? null;
    this.scopePolicy.assertCanCreate(scope, { departmentId, directionId });
    return this.positions.create(dto as Parameters<PositionsService['create']>[0]);
  }

  @Patch(':id')
  @RequirePermissions(Permission.PositionsManage)
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdatePositionDto,
  ) {
    const scope = await this.scopePolicy.resolveForActor(
      user,
      this.employees,
      this.currentAssignment,
      this.departments,
    );
    const existing = await this.positions.getOrFail(id);
    this.scopePolicy.assertCanMutate(scope, existing);
    return this.positions.update(id, dto as Parameters<
      PositionsService['update']
    >[1]);
  }

  @Delete(':id')
  @RequirePermissions(Permission.PositionsManage)
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    const scope = await this.scopePolicy.resolveForActor(
      user,
      this.employees,
      this.currentAssignment,
      this.departments,
    );
    const existing = await this.positions.getOrFail(id);
    this.scopePolicy.assertCanMutate(scope, existing);
    await this.positions.hardDelete(id);
    return { ok: true };
  }
}
