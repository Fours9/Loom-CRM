import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Position } from './position.entity';
import { DepartmentsService } from '../departments/departments.service';
import { resolvePositionDirectionId } from './resolve-position-direction';
import { replacePositionManagedDepartments } from '../employees/managed-department-writes';

export type PositionListQuery = {
  all?: boolean;
  departmentId?: string;
  directionId?: string;
  globalsOnly?: boolean;
};

export type PositionView = Position & {
  managedDepartmentIds: string[];
};

export type PositionListItem = PositionView & {
  departmentName: string | null;
  directionName: string | null;
};

function resolveManagedDepartmentIds(input: {
  isDepartmentManagerTemplate: boolean;
  managedDepartmentIds?: string[];
  departmentId: string | null;
  previousManagedDepartmentIds: string[];
  templateExplicitlyEnabled: boolean;
}): string[] {
  if (!input.isDepartmentManagerTemplate) {
    return [];
  }

  let ids: string[];
  if (input.managedDepartmentIds !== undefined) {
    ids = [...new Set(input.managedDepartmentIds.filter(Boolean))];
  } else if (input.templateExplicitlyEnabled) {
    ids = [];
  } else {
    ids = [...input.previousManagedDepartmentIds];
  }

  if (ids.length === 0 && input.departmentId) {
    return [input.departmentId];
  }
  return ids;
}

function toPositionView(row: Position): PositionView {
  const managedDepartmentIds = (row.managedDepartments ?? []).map(
    (m) => m.departmentId,
  );
  return {
    ...row,
    managedDepartmentIds,
  };
}

@Injectable()
export class PositionsService {
  constructor(
    @InjectRepository(Position)
    private readonly positions: Repository<Position>,
    private readonly departments: DepartmentsService,
    private readonly dataSource: DataSource,
  ) {}

  private async resolveDirectionId(input: {
    departmentId: string | null;
    /** Only pass when the caller explicitly sent directionId in the request. */
    explicitDirectionId?: string | null;
  }): Promise<string | null> {
    let departmentDirectionId: string | null | undefined;
    if (input.departmentId) {
      const dept = await this.departments.getOrFail(input.departmentId);
      departmentDirectionId = dept.directionId;
    }
    const resolved = resolvePositionDirectionId({
      hasDepartment: Boolean(input.departmentId),
      departmentDirectionId,
      explicitDirectionId: input.explicitDirectionId,
    });
    if (!resolved.ok) {
      throw new BadRequestException(resolved.error);
    }
    return resolved.directionId;
  }

  async findAll(query: PositionListQuery = {}): Promise<PositionListItem[]> {
    const qb = this.positions
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.department', 'department')
      .leftJoinAndSelect('p.direction', 'direction')
      .leftJoinAndSelect('department.direction', 'deptDirection')
      .leftJoinAndSelect('p.managedDepartments', 'managedDepartments')
      .orderBy('p.name', 'ASC');

    if (!query.all) {
      qb.andWhere('p.is_active = true');
    }
    if (query.globalsOnly) {
      qb.andWhere('p.department_id IS NULL');
    } else if (query.departmentId) {
      qb.andWhere('p.department_id = :departmentId', {
        departmentId: query.departmentId,
      });
    }
    if (query.directionId) {
      qb.andWhere('p.direction_id = :directionId', {
        directionId: query.directionId,
      });
    }

    const rows = await qb.getMany();
    return rows.map((row) => {
      const view = toPositionView(row);
      return {
        ...view,
        departmentName: row.department?.name ?? null,
        directionName:
          row.direction?.name ??
          row.department?.direction?.name ??
          null,
      };
    });
  }

  async getOrFail(id: string): Promise<PositionView> {
    const row = await this.positions.findOne({
      where: { id },
      relations: [
        'department',
        'department.direction',
        'direction',
        'managedDepartments',
      ],
    });
    if (!row) throw new NotFoundException('Position not found');
    return toPositionView(row);
  }

  async create(input: {
    name: string;
    departmentId?: string | null;
    directionId?: string | null;
    description?: string | null;
    isDepartmentManagerTemplate?: boolean;
    managedDepartmentIds?: string[];
  }): Promise<PositionView> {
    const departmentId = input.departmentId ?? null;
    const directionId = await this.resolveDirectionId({
      departmentId,
      explicitDirectionId: input.directionId,
    });
    const isDepartmentManagerTemplate = Boolean(
      input.isDepartmentManagerTemplate,
    );
    const managedDepartmentIds = resolveManagedDepartmentIds({
      isDepartmentManagerTemplate,
      managedDepartmentIds: input.managedDepartmentIds ?? [],
      departmentId,
      previousManagedDepartmentIds: [],
      templateExplicitlyEnabled: isDepartmentManagerTemplate,
    });

    const id = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Position);
      const saved = await repo.save(
        repo.create({
          name: input.name,
          departmentId,
          directionId,
          description: input.description ?? null,
          isActive: true,
          isDepartmentManagerTemplate,
        }),
      );
      await replacePositionManagedDepartments(
        manager,
        saved.id,
        managedDepartmentIds,
      );
      return saved.id;
    });

    return this.getOrFail(id);
  }

  async update(
    id: string,
    input: Partial<
      Pick<
        Position,
        | 'name'
        | 'departmentId'
        | 'directionId'
        | 'description'
        | 'isActive'
        | 'isDepartmentManagerTemplate'
      >
    > & {
      managedDepartmentIds?: string[];
    },
  ): Promise<PositionView> {
    const row = await this.getOrFail(id);
    const departmentId =
      input.departmentId !== undefined ? input.departmentId : row.departmentId;
    const explicitDirectionId =
      input.directionId !== undefined
        ? input.directionId
        : departmentId === null
          ? row.directionId
          : undefined;
    const directionId = await this.resolveDirectionId({
      departmentId,
      // Department changes must inherit; global positions preserve manual direction
      // unless the caller explicitly sent directionId.
      explicitDirectionId,
    });

    const templateTouched = input.isDepartmentManagerTemplate !== undefined;
    const isDepartmentManagerTemplate = templateTouched
      ? Boolean(input.isDepartmentManagerTemplate)
      : row.isDepartmentManagerTemplate;
    const managedDepartmentIds = resolveManagedDepartmentIds({
      isDepartmentManagerTemplate,
      managedDepartmentIds: input.managedDepartmentIds,
      departmentId,
      previousManagedDepartmentIds: row.managedDepartmentIds,
      templateExplicitlyEnabled:
        templateTouched && Boolean(input.isDepartmentManagerTemplate),
    });

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Position);
      const entity = await repo.findOne({ where: { id } });
      if (!entity) throw new NotFoundException('Position not found');

      if (input.name !== undefined) entity.name = input.name;
      if (input.description !== undefined) entity.description = input.description;
      if (input.isActive !== undefined) entity.isActive = input.isActive;
      entity.departmentId = departmentId;
      entity.directionId = directionId;
      entity.isDepartmentManagerTemplate = isDepartmentManagerTemplate;
      await repo.save(entity);

      await replacePositionManagedDepartments(
        manager,
        id,
        managedDepartmentIds,
      );
    });

    return this.getOrFail(id);
  }

  async softDelete(id: string): Promise<void> {
    const row = await this.getOrFail(id);
    row.isActive = false;
    await this.positions.save(row);
  }

  async hardDelete(id: string): Promise<void> {
    const row = await this.getOrFail(id);
    await this.positions.remove(row);
  }
}
