import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmploymentType } from './employment-type.entity';
import { WorkFormat } from './work-format.entity';
import {
  compareCatalogItems,
  normalizeCatalogName,
  type EmploymentCatalogItem,
} from './employment-catalog.helpers';

type CatalogKind = 'workFormat' | 'employmentType';

@Injectable()
export class EmploymentCatalogService {
  constructor(
    @InjectRepository(WorkFormat)
    private readonly workFormats: Repository<WorkFormat>,
    @InjectRepository(EmploymentType)
    private readonly employmentTypes: Repository<EmploymentType>,
  ) {}

  async listWorkFormats(all = false): Promise<WorkFormat[]> {
    return this.listCatalog(this.workFormats, all);
  }

  async listEmploymentTypes(all = false): Promise<EmploymentType[]> {
    return this.listCatalog(this.employmentTypes, all);
  }

  async createWorkFormat(input: {
    name: string;
    sortOrder?: number;
  }): Promise<WorkFormat> {
    return this.workFormats.save(
      this.workFormats.create({
        name: normalizeCatalogName(input.name),
        sortOrder: input.sortOrder ?? 0,
        isActive: true,
      }),
    );
  }

  async createEmploymentType(input: {
    name: string;
    sortOrder?: number;
  }): Promise<EmploymentType> {
    return this.employmentTypes.save(
      this.employmentTypes.create({
        name: normalizeCatalogName(input.name),
        sortOrder: input.sortOrder ?? 0,
        isActive: true,
      }),
    );
  }

  async updateWorkFormat(
    id: string,
    input: Partial<Pick<WorkFormat, 'name' | 'sortOrder' | 'isActive'>>,
  ): Promise<WorkFormat> {
    return this.updateCatalog(this.workFormats, 'Work format', id, input);
  }

  async updateEmploymentType(
    id: string,
    input: Partial<Pick<EmploymentType, 'name' | 'sortOrder' | 'isActive'>>,
  ): Promise<EmploymentType> {
    return this.updateCatalog(
      this.employmentTypes,
      'Employment type',
      id,
      input,
    );
  }

  async deleteWorkFormat(id: string): Promise<void> {
    await this.deleteCatalog(this.workFormats, 'Work format', id);
  }

  async deleteEmploymentType(id: string): Promise<void> {
    await this.deleteCatalog(this.employmentTypes, 'Employment type', id);
  }

  async assertActiveValue(
    kind: CatalogKind,
    value: string | null,
  ): Promise<void> {
    if (value == null) {
      return;
    }
    const normalized = normalizeCatalogName(value);
    const row =
      kind === 'workFormat'
        ? await this.workFormats.findOne({ where: { name: normalized } })
        : await this.employmentTypes.findOne({ where: { name: normalized } });
    if (!row || !row.isActive) {
      throw new BadRequestException(
        `${kind === 'workFormat' ? 'Work format' : 'Employment type'} is inactive`,
      );
    }
  }

  private async listCatalog<T extends EmploymentCatalogItem>(
    repo: Repository<T>,
    all: boolean,
  ): Promise<T[]> {
    const rows = all ? await repo.find() : await repo.find({ where: { isActive: true } as never });
    return [...rows].sort(compareCatalogItems);
  }

  private async updateCatalog<T extends WorkFormat | EmploymentType>(
    repo: Repository<T>,
    label: string,
    id: string,
    input: Partial<Pick<T, 'name' | 'sortOrder' | 'isActive'>>,
  ): Promise<T> {
    const row = await repo.findOne({ where: { id } as never });
    if (!row) {
      throw new NotFoundException(`${label} not found`);
    }
    if (input.name !== undefined) {
      row.name = normalizeCatalogName(input.name);
    }
    if (input.sortOrder !== undefined) {
      if (!Number.isInteger(input.sortOrder)) {
        throw new BadRequestException('sortOrder must be an integer');
      }
      row.sortOrder = input.sortOrder;
    }
    if (input.isActive !== undefined) {
      row.isActive = input.isActive;
    }
    return repo.save(row);
  }

  private async deleteCatalog<T extends WorkFormat | EmploymentType>(
    repo: Repository<T>,
    label: string,
    id: string,
  ): Promise<void> {
    const row = await repo.findOne({ where: { id } as never });
    if (!row) {
      throw new NotFoundException(`${label} not found`);
    }
    await repo.remove(row);
  }
}
