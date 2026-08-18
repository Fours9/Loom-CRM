import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Position } from './position.entity';
import { DepartmentsService } from '../departments/departments.service';
import { resolvePositionDirectionId } from './resolve-position-direction';

export type PositionListQuery = {
  all?: boolean;
  departmentId?: string;
  directionId?: string;
  globalsOnly?: boolean;
};

export type PositionListItem = Position & {
  departmentName: string | null;
  directionName: string | null;
};

@Injectable()
export class PositionsService {
  constructor(
    @InjectRepository(Position)
    private readonly positions: Repository<Position>,
    private readonly departments: DepartmentsService,
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
    return rows.map((row) => ({
      ...row,
      departmentName: row.department?.name ?? null,
      directionName:
        row.direction?.name ??
        row.department?.direction?.name ??
        null,
    }));
  }

  async getOrFail(id: string): Promise<Position> {
    const row = await this.positions.findOne({
      where: { id },
      relations: ['department', 'department.direction', 'direction'],
    });
    if (!row) throw new NotFoundException('Position not found');
    return row;
  }

  async create(input: {
    name: string;
    departmentId?: string | null;
    directionId?: string | null;
    description?: string | null;
  }): Promise<Position> {
    const departmentId = input.departmentId ?? null;
    const directionId = await this.resolveDirectionId({
      departmentId,
      explicitDirectionId: input.directionId,
    });
    return this.positions.save(
      this.positions.create({
        name: input.name,
        departmentId,
        directionId,
        description: input.description ?? null,
        isActive: true,
      }),
    );
  }

  async update(
    id: string,
    input: Partial<
      Pick<
        Position,
        'name' | 'departmentId' | 'directionId' | 'description' | 'isActive'
      >
    >,
  ): Promise<Position> {
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

    if (input.name !== undefined) row.name = input.name;
    if (input.description !== undefined) row.description = input.description;
    if (input.isActive !== undefined) row.isActive = input.isActive;
    row.departmentId = departmentId;
    row.directionId = directionId;
    return this.positions.save(row);
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
