import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Position } from './position.entity';

@Injectable()
export class PositionsService {
  constructor(
    @InjectRepository(Position)
    private readonly positions: Repository<Position>,
  ) {}

  findAll(): Promise<Position[]> {
    return this.positions.find({ order: { name: 'ASC' } });
  }

  async getOrFail(id: string): Promise<Position> {
    const row = await this.positions.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Position not found');
    return row;
  }

  create(input: {
    name: string;
    departmentId?: string | null;
    description?: string | null;
  }): Promise<Position> {
    return this.positions.save(
      this.positions.create({
        name: input.name,
        departmentId: input.departmentId ?? null,
        description: input.description ?? null,
        isActive: true,
      }),
    );
  }

  async update(
    id: string,
    input: Partial<
      Pick<Position, 'name' | 'departmentId' | 'description' | 'isActive'>
    >,
  ): Promise<Position> {
    const row = await this.getOrFail(id);
    Object.assign(row, input);
    return this.positions.save(row);
  }

  async softDelete(id: string): Promise<void> {
    const row = await this.getOrFail(id);
    row.isActive = false;
    await this.positions.save(row);
  }
}
