import { BadRequestException } from '@nestjs/common';
import { Position } from './position.entity';
import { PositionsService } from './positions.service';
import type { DepartmentsService } from '../departments/departments.service';

function positionRow(overrides: Partial<Position> = {}): Position {
  return {
    id: 'pos-1',
    name: 'Position',
    departmentId: null,
    directionId: null,
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Position;
}

describe('PositionsService PATCH direction semantics', () => {
  function makeService(seed: {
    row?: Position;
    departments?: Record<string, { id: string; directionId: string | null }>;
  }) {
    const liveRow = seed.row ?? positionRow();
    const departments = seed.departments ?? {};

    const repo = {
      findOne: jest.fn(async () => liveRow),
      create: jest.fn((row: Partial<Position>) => row),
      save: jest.fn(async (row: Position) => {
        Object.assign(liveRow, row);
        return liveRow;
      }),
      createQueryBuilder: jest.fn(),
      remove: jest.fn(),
    };

    const deps = {
      getOrFail: jest.fn(async (id: string) => {
        const row = departments[id];
        if (!row) throw new Error(`Unknown department ${id}`);
        return row;
      }),
    } as unknown as DepartmentsService;

    const service = new PositionsService(repo as never, deps);
    return { service, liveRow, repo, deps };
  }

  it('create global with no direction defaults to null', async () => {
    const { service } = makeService({ row: positionRow() });
    const created = await service.create({ name: 'Global' });
    expect(created.directionId).toBeNull();
  });

  it('create global with manual direction preserves it', async () => {
    const { service } = makeService({ row: positionRow() });
    const created = await service.create({ name: 'Global', directionId: 'dir-x' });
    expect(created.directionId).toBe('dir-x');
  });

  it('create department position inherits department direction', async () => {
    const { service } = makeService({
      row: positionRow(),
      departments: { 'dept-a': { id: 'dept-a', directionId: 'dir-x' } },
    });
    const created = await service.create({
      name: 'Dept',
      departmentId: 'dept-a',
      directionId: 'dir-x',
    });
    expect(created.directionId).toBe('dir-x');
  });

  it('create department position rejects mismatched explicit direction', async () => {
    const { service } = makeService({
      row: positionRow(),
      departments: { 'dept-a': { id: 'dept-a', directionId: 'dir-x' } },
    });
    await expect(
      service.create({ name: 'Dept', departmentId: 'dept-a', directionId: 'dir-y' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update global manual direction preserves it on unrelated PATCH', async () => {
    const { service, liveRow } = makeService({
      row: positionRow({ departmentId: null, directionId: 'dir-x' }),
    });
    const updated = await service.update(liveRow.id, { name: 'Renamed' });
    expect(updated.directionId).toBe('dir-x');
  });

  it('update global manual direction preserves it on isActive PATCH', async () => {
    const { service, liveRow } = makeService({
      row: positionRow({ departmentId: null, directionId: 'dir-x' }),
    });
    const updated = await service.update(liveRow.id, { isActive: false });
    expect(updated.directionId).toBe('dir-x');
  });

  it('update global can clear direction explicitly', async () => {
    const { service, liveRow } = makeService({
      row: positionRow({ departmentId: null, directionId: 'dir-x' }),
    });
    const updated = await service.update(liveRow.id, { directionId: null });
    expect(updated.directionId).toBeNull();
  });

  it('update department position keeps current department direction on unrelated PATCH', async () => {
    const { service, liveRow } = makeService({
      row: positionRow({ departmentId: 'dept-a', directionId: 'dir-x' }),
      departments: { 'dept-a': { id: 'dept-a', directionId: 'dir-x' } },
    });
    const updated = await service.update(liveRow.id, { description: 'Changed' });
    expect(updated.directionId).toBe('dir-x');
  });

  it('update department change inherits new department direction when direction omitted', async () => {
    const { service, liveRow } = makeService({
      row: positionRow({ departmentId: 'dept-a', directionId: 'dir-x' }),
      departments: {
        'dept-a': { id: 'dept-a', directionId: 'dir-x' },
        'dept-b': { id: 'dept-b', directionId: 'dir-y' },
      },
    });
    const updated = await service.update(liveRow.id, { departmentId: 'dept-b' });
    expect(updated.directionId).toBe('dir-y');
  });

  it('update department change rejects stale explicit direction', async () => {
    const { service, liveRow } = makeService({
      row: positionRow({ departmentId: 'dept-a', directionId: 'dir-x' }),
      departments: {
        'dept-a': { id: 'dept-a', directionId: 'dir-x' },
        'dept-b': { id: 'dept-b', directionId: 'dir-y' },
      },
    });
    await expect(
      service.update(liveRow.id, { departmentId: 'dept-b', directionId: 'dir-x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update department to null keeps inherited direction as manual when direction omitted', async () => {
    const { service, liveRow } = makeService({
      row: positionRow({ departmentId: 'dept-a', directionId: 'dir-x' }),
      departments: { 'dept-a': { id: 'dept-a', directionId: 'dir-x' } },
    });
    const updated = await service.update(liveRow.id, { departmentId: null });
    expect(updated.departmentId).toBeNull();
    expect(updated.directionId).toBe('dir-x');
  });

  it('update department to null can clear direction explicitly', async () => {
    const { service, liveRow } = makeService({
      row: positionRow({ departmentId: 'dept-a', directionId: 'dir-x' }),
      departments: { 'dept-a': { id: 'dept-a', directionId: 'dir-x' } },
    });
    const updated = await service.update(liveRow.id, {
      departmentId: null,
      directionId: null,
    });
    expect(updated.departmentId).toBeNull();
    expect(updated.directionId).toBeNull();
  });
});
