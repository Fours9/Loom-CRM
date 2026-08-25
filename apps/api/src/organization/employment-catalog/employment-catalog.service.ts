import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { EmploymentType } from './employment-type.entity';
import { WorkFormat } from './work-format.entity';
import {
  buildCatalogReorderUpdates,
  CatalogInvariantError,
  compareCatalogItems,
  EmploymentCatalogValidationError,
  employmentCatalogValidationMessage,
  nextCatalogSortOrder,
  normalizeCatalogDescription,
  normalizeCatalogName,
  type EmploymentCatalogItem,
} from './employment-catalog.helpers';

type CatalogKind = 'workFormat' | 'employmentType';

export type EmploymentCatalogWriteInput = {
  name?: string;
  description?: string | null;
  isActive?: boolean;
};

@Injectable()
export class EmploymentCatalogService {
  constructor(
    @InjectRepository(WorkFormat)
    private readonly workFormats: Repository<WorkFormat>,
    @InjectRepository(EmploymentType)
    private readonly employmentTypes: Repository<EmploymentType>,
    private readonly dataSource: DataSource,
  ) {}

  async listWorkFormats(all = false): Promise<WorkFormat[]> {
    return this.listCatalog(this.workFormats, all);
  }

  async listEmploymentTypes(all = false): Promise<EmploymentType[]> {
    return this.listCatalog(this.employmentTypes, all);
  }

  async createWorkFormat(input: {
    name: string;
    description?: string | null;
  }): Promise<WorkFormat> {
    return this.withCatalogWriter(WorkFormat, 'work_formats', async (repo) => {
      const existing = await repo.find();
      return repo.save(
        repo.create({
          name: normalizeCatalogName(input.name),
          description: normalizeCatalogDescription(input.description),
          sortOrder: nextCatalogSortOrder(existing),
          isActive: true,
        }),
      );
    });
  }

  async createEmploymentType(input: {
    name: string;
    description?: string | null;
  }): Promise<EmploymentType> {
    return this.withCatalogWriter(
      EmploymentType,
      'employment_types',
      async (repo) => {
        const existing = await repo.find();
        return repo.save(
          repo.create({
            name: normalizeCatalogName(input.name),
            description: normalizeCatalogDescription(input.description),
            sortOrder: nextCatalogSortOrder(existing),
            isActive: true,
          }),
        );
      },
    );
  }

  async updateWorkFormat(
    id: string,
    input: EmploymentCatalogWriteInput,
  ): Promise<WorkFormat> {
    return this.withCatalogWriter(WorkFormat, 'work_formats', (repo) =>
      this.updateCatalog(repo, 'Work format', id, input),
    );
  }

  async updateEmploymentType(
    id: string,
    input: EmploymentCatalogWriteInput,
  ): Promise<EmploymentType> {
    return this.withCatalogWriter(EmploymentType, 'employment_types', (repo) =>
      this.updateCatalog(repo, 'Employment type', id, input),
    );
  }

  /** Single entry for list order: full permutation of ids → contiguous sort_order. */
  async reorderWorkFormats(orderedIds: string[]): Promise<WorkFormat[]> {
    return this.withCatalogWriter(WorkFormat, 'work_formats', (repo) =>
      this.reorderCatalog(repo, orderedIds),
    );
  }

  async reorderEmploymentTypes(orderedIds: string[]): Promise<EmploymentType[]> {
    return this.withCatalogWriter(EmploymentType, 'employment_types', (repo) =>
      this.reorderCatalog(repo, orderedIds),
    );
  }

  async deleteWorkFormat(id: string): Promise<void> {
    await this.withCatalogWriter(WorkFormat, 'work_formats', (repo) =>
      this.deleteCatalog(repo, 'Work format', id),
    );
  }

  async deleteEmploymentType(id: string): Promise<void> {
    await this.withCatalogWriter(EmploymentType, 'employment_types', (repo) =>
      this.deleteCatalog(repo, 'Employment type', id),
    );
  }

  async assertActiveValue(
    kind: CatalogKind,
    value: string | null,
  ): Promise<void> {
    if (value == null) {
      return;
    }
    try {
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
    } catch (error) {
      this.rethrowMapped(error);
    }
  }

  private async withCatalogWriter<TEntity extends ObjectLiteral, TResult>(
    entity: EntityTarget<TEntity>,
    table: 'work_formats' | 'employment_types',
    work: (repo: Repository<TEntity>) => Promise<TResult>,
  ): Promise<TResult> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        await manager.query(
          `LOCK TABLE "${table}" IN SHARE ROW EXCLUSIVE MODE`,
        );
        return work(manager.getRepository(entity));
      });
    } catch (error) {
      this.rethrowMapped(error);
    }
  }

  private rethrowMapped(error: unknown): never {
    if (error instanceof EmploymentCatalogValidationError) {
      throw new BadRequestException(
        employmentCatalogValidationMessage(error.code),
      );
    }
    if (error instanceof CatalogInvariantError) {
      throw new InternalServerErrorException(error.message);
    }
    throw error;
  }

  private async listCatalog<T extends EmploymentCatalogItem>(
    repo: Repository<T>,
    all: boolean,
  ): Promise<T[]> {
    const rows = all
      ? await repo.find()
      : await repo.find({ where: { isActive: true } as never });
    return [...rows].sort(compareCatalogItems);
  }

  private async updateCatalog<T extends WorkFormat | EmploymentType>(
    repo: Repository<T>,
    label: string,
    id: string,
    input: EmploymentCatalogWriteInput,
  ): Promise<T> {
    const row = await repo.findOne({ where: { id } as never });
    if (!row) {
      throw new NotFoundException(`${label} not found`);
    }
    if (input.name !== undefined) {
      row.name = normalizeCatalogName(input.name);
    }
    if (input.description !== undefined) {
      row.description = normalizeCatalogDescription(input.description);
    }
    if (input.isActive !== undefined) {
      row.isActive = input.isActive;
    }
    return repo.save(row);
  }

  private async reorderCatalog<T extends WorkFormat | EmploymentType>(
    repo: Repository<T>,
    orderedIds: string[],
  ): Promise<T[]> {
    if (
      !Array.isArray(orderedIds) ||
      orderedIds.some((id) => typeof id !== 'string')
    ) {
      throw new EmploymentCatalogValidationError('ordered_ids_invalid');
    }
    const rows = await repo.find();
    const updates = buildCatalogReorderUpdates(
      rows.map((row) => row.id),
      orderedIds,
    );
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const update of updates) {
      const row = byId.get(update.id);
      if (!row) {
        throw new CatalogInvariantError(
          'Reorder update id missing after validated permutation',
        );
      }
      row.sortOrder = update.sortOrder;
    }
    await repo.save([...byId.values()]);
    return this.listCatalog(repo, true);
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
