import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Direction } from '../companies/direction.entity';

@Injectable()
export class DirectionsService {
  constructor(
    @InjectRepository(Direction)
    private readonly directions: Repository<Direction>,
  ) {}

  findAll(): Promise<Direction[]> {
    return this.directions.find({ order: { name: 'ASC' } });
  }

  async getOrFail(id: string): Promise<Direction> {
    const row = await this.directions.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Direction not found');
    return row;
  }

  create(input: {
    name: string;
    code?: string | null;
    companyId?: string | null;
  }): Promise<Direction> {
    return this.directions.save(
      this.directions.create({
        name: input.name,
        code: input.code ?? null,
        companyId: input.companyId ?? null,
        isActive: true,
      }),
    );
  }

  async update(
    id: string,
    input: Partial<Pick<Direction, 'name' | 'code' | 'companyId' | 'isActive'>>,
  ): Promise<Direction> {
    const row = await this.getOrFail(id);
    Object.assign(row, input);
    return this.directions.save(row);
  }

  async softDelete(id: string): Promise<void> {
    const row = await this.getOrFail(id);
    row.isActive = false;
    await this.directions.save(row);
  }

  async hardDelete(id: string): Promise<void> {
    const row = await this.getOrFail(id);
    await this.directions.remove(row);
  }
}
