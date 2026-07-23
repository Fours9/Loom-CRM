import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './department.entity';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departments: Repository<Department>,
  ) {}

  findAll(): Promise<Department[]> {
    return this.departments.find({ order: { name: 'ASC' } });
  }

  async getOrFail(id: string): Promise<Department> {
    const row = await this.departments.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Department not found');
    return row;
  }

  create(input: {
    name: string;
    description?: string | null;
  }): Promise<Department> {
    return this.departments.save(
      this.departments.create({
        name: input.name,
        description: input.description ?? null,
        isActive: true,
        isHidden: false,
      }),
    );
  }

  async update(
    id: string,
    input: Partial<Pick<Department, 'name' | 'description' | 'isActive' | 'isHidden'>>,
  ): Promise<Department> {
    const row = await this.getOrFail(id);
    Object.assign(row, input);
    return this.departments.save(row);
  }

  async softDelete(id: string): Promise<void> {
    const row = await this.getOrFail(id);
    row.isActive = false;
    await this.departments.save(row);
  }
}
