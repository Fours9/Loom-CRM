import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Department } from './department.entity';
import { Position } from '../positions/position.entity';

export type DepartmentListItem = Department & {
  directionName: string | null;
};

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departments: Repository<Department>,
    @InjectRepository(Position)
    private readonly positions: Repository<Position>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<DepartmentListItem[]> {
    const rows = await this.departments.find({
      relations: ['direction'],
      order: { name: 'ASC' },
    });
    return rows.map((row) => ({
      ...row,
      directionName: row.direction?.name ?? null,
    }));
  }

  async getOrFail(id: string): Promise<Department> {
    const row = await this.departments.findOne({
      where: { id },
      relations: ['direction'],
    });
    if (!row) throw new NotFoundException('Department not found');
    return row;
  }

  create(input: {
    name: string;
    description?: string | null;
    directionId?: string | null;
  }): Promise<Department> {
    return this.departments.save(
      this.departments.create({
        name: input.name,
        description: input.description ?? null,
        directionId: input.directionId ?? null,
        isActive: true,
        isHidden: false,
      }),
    );
  }

  async update(
    id: string,
    input: Partial<
      Pick<
        Department,
        'name' | 'description' | 'directionId' | 'isActive' | 'isHidden'
      >
    >,
  ): Promise<Department> {
    return this.dataSource.transaction(async (manager) => {
      const deptRepo = manager.getRepository(Department);
      const posRepo = manager.getRepository(Position);
      const row = await deptRepo.findOne({
        where: { id },
        relations: ['direction'],
      });
      if (!row) throw new NotFoundException('Department not found');

      const directionChanged =
        input.directionId !== undefined &&
        input.directionId !== row.directionId;
      Object.assign(row, input);
      const saved = await deptRepo.save(row);
      if (directionChanged) {
        await posRepo.update(
          { departmentId: id },
          { directionId: saved.directionId },
        );
      }
      return saved;
    });
  }

  async softDelete(id: string): Promise<void> {
    const row = await this.getOrFail(id);
    row.isActive = false;
    row.isHidden = true;
    await this.departments.save(row);
  }

  async hardDelete(id: string): Promise<void> {
    const row = await this.getOrFail(id);
    await this.departments.remove(row);
  }
}
