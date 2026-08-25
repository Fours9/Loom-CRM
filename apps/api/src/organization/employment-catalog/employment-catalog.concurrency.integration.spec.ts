import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WorkFormat } from './work-format.entity';
import { EmploymentCatalogService } from './employment-catalog.service';
import { requireIsolatedTestDatabaseUrl } from '../../platform/database/require-isolated-test-database-url';

/**
 * Real PostgreSQL concurrency for employment catalog writers.
 * Requires TEST_DATABASE_URL → isolated DB (never loom_crm).
 */
describe('EmploymentCatalogService concurrency (integration)', () => {
  let dataSource: DataSource;
  let service: EmploymentCatalogService;

  beforeAll(async () => {
    const url = requireIsolatedTestDatabaseUrl();
    dataSource = new DataSource({
      type: 'postgres',
      url,
      entities: [WorkFormat],
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS "work_formats" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(64) NOT NULL UNIQUE,
        "description" text NULL,
        "sort_order" int NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const repo = dataSource.getRepository(WorkFormat);
    service = new EmploymentCatalogService(repo, repo as never, dataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "work_formats"');
  });

  it('empty dual-create yields distinct contiguous sortOrder [0,1] in DB', async () => {
    await Promise.all([
      service.createWorkFormat({ name: 'Alpha' }),
      service.createWorkFormat({ name: 'Beta' }),
    ]);
    const rows: Array<{ sort_order: number }> = await dataSource.query(
      `SELECT sort_order FROM work_formats ORDER BY sort_order ASC, name ASC`,
    );
    const orders = rows.map((r) => Number(r.sort_order));
    expect(orders).toEqual([0, 1]);
    expect(new Set(orders).size).toBe(2);
  });

  it('reorder vs create serializes to a valid outcome (success+append or stale 400)', async () => {
    const a = await service.createWorkFormat({ name: 'A' });
    const b = await service.createWorkFormat({ name: 'B' });
    const staleIds = [b.id, a.id];

    const results = await Promise.allSettled([
      service.reorderWorkFormats(staleIds),
      service.createWorkFormat({ name: 'C' }),
    ]);

    const reorder = results[0];
    const create = results[1];
    expect(create.status).toBe('fulfilled');

    const finalRows = await dataSource.getRepository(WorkFormat).find();
    const names = new Set(finalRows.map((r) => r.name));
    expect(names.has('A')).toBe(true);
    expect(names.has('B')).toBe(true);
    expect(names.has('C')).toBe(true);

    if (reorder.status === 'fulfilled') {
      const orders = finalRows.map((r) => r.sortOrder).sort((x, y) => x - y);
      expect(orders).toEqual([0, 1, 2]);
      const c = finalRows.find((r) => r.name === 'C')!;
      expect(c.sortOrder).toBe(2);
    } else {
      expect(reorder.reason).toBeInstanceOf(BadRequestException);
    }
  });

  it('reorder vs delete: stale reorder fails closed if delete wins', async () => {
    const a = await service.createWorkFormat({ name: 'A' });
    const b = await service.createWorkFormat({ name: 'B' });
    const c = await service.createWorkFormat({ name: 'C' });

    const results = await Promise.allSettled([
      service.reorderWorkFormats([c.id, b.id, a.id]),
      service.deleteWorkFormat(b.id),
    ]);

    const remaining = await dataSource.getRepository(WorkFormat).find();
    const ids = new Set(remaining.map((r) => r.id));
    expect(ids.has(b.id)).toBe(false);
    expect(ids.has(a.id)).toBe(true);
    expect(ids.has(c.id)).toBe(true);
    expect(remaining).toHaveLength(2);

    const reorder = results[0];
    const del = results[1];
    expect(del.status).toBe('fulfilled');

    if (reorder.status === 'rejected') {
      expect(reorder.reason).toBeInstanceOf(BadRequestException);
    } else {
      // reorder won first: A and C remain; orders stay distinct after serialized delete
      const orders = remaining.map((r) => r.sortOrder).sort((x, y) => x - y);
      expect(new Set(orders).size).toBe(orders.length);
    }
  });
});
