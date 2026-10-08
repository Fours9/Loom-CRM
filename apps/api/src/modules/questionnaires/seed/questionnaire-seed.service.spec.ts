import {
  EMPLOYEE_360_TEMPLATE_CODE,
  EMPLOYEE_360_TEMPLATE_TITLE,
  EMPLOYEE_360_V1_SCHEMA,
} from './employee-360-v1.schema';
import {
  EMPLOYEE_STARTER_TEMPLATE_CODE,
  EMPLOYEE_STARTER_TEMPLATE_TITLE,
  EMPLOYEE_STARTER_V1_SCHEMA,
} from './employee-starter-v1.schema';
import {
  EMPLOYEE_NAMED_TEMPLATE_CODE,
  EMPLOYEE_NAMED_TEMPLATE_TITLE,
  EMPLOYEE_NAMED_V1_SCHEMA,
} from './employee-named-v1.schema';
import {
  EMPLOYEE_DOCS_TEMPLATE_CODE,
  EMPLOYEE_DOCS_TEMPLATE_TITLE,
  EMPLOYEE_DOCS_V1_SCHEMA,
  EMPLOYEE_MANAGING_TEMPLATE_CODE,
  EMPLOYEE_MANAGING_TEMPLATE_TITLE,
  EMPLOYEE_MANAGING_V1_SCHEMA,
} from './questionnaire-stub-schemas';
import {
  QuestionnaireSeedService,
  schemaForPublishedVersion,
} from './questionnaire-seed.service';
import type { QuestionnaireTemplate } from '../questionnaire-template.entity';
import type { QuestionnaireTemplateVersion } from '../questionnaire-template-version.entity';

const SEED_BY_CODE: Record<
  string,
  { title: string; type: string; schema: Record<string, unknown> }
> = {
  [EMPLOYEE_360_TEMPLATE_CODE]: {
    title: EMPLOYEE_360_TEMPLATE_TITLE,
    type: 'full',
    schema: EMPLOYEE_360_V1_SCHEMA as unknown as Record<string, unknown>,
  },
  [EMPLOYEE_STARTER_TEMPLATE_CODE]: {
    title: EMPLOYEE_STARTER_TEMPLATE_TITLE,
    type: 'full',
    schema: EMPLOYEE_STARTER_V1_SCHEMA as unknown as Record<string, unknown>,
  },
  [EMPLOYEE_NAMED_TEMPLATE_CODE]: {
    title: EMPLOYEE_NAMED_TEMPLATE_TITLE,
    type: 'full',
    schema: EMPLOYEE_NAMED_V1_SCHEMA as unknown as Record<string, unknown>,
  },
  [EMPLOYEE_MANAGING_TEMPLATE_CODE]: {
    title: EMPLOYEE_MANAGING_TEMPLATE_TITLE,
    type: 'managing',
    schema: EMPLOYEE_MANAGING_V1_SCHEMA as unknown as Record<string, unknown>,
  },
  [EMPLOYEE_DOCS_TEMPLATE_CODE]: {
    title: EMPLOYEE_DOCS_TEMPLATE_TITLE,
    type: 'docs',
    schema: EMPLOYEE_DOCS_V1_SCHEMA as unknown as Record<string, unknown>,
  },
};

type VersionRow = QuestionnaireTemplateVersion & {
  schemaJson: Record<string, unknown>;
};

type HarnessOpts = {
  /** Latest published row for employee-360 (omit = no versions yet). */
  employee360Latest?: Partial<VersionRow> & { version: number };
  /** Assignment count on that latest version. */
  assignmentCount?: number;
};

function makeHarness(opts: HarnessOpts = {}) {
  const templatesByCode = new Map<string, QuestionnaireTemplate>();
  const versionsByTemplateId = new Map<string, VersionRow[]>();
  const versionSaves: VersionRow[] = [];

  for (const [code, meta] of Object.entries(SEED_BY_CODE)) {
    const id = `tpl-${code}`;
    templatesByCode.set(code, {
      id,
      code,
      title: meta.title,
      type: meta.type,
      status: 'published',
    } as QuestionnaireTemplate);

    if (code === EMPLOYEE_360_TEMPLATE_CODE && opts.employee360Latest) {
      const version: VersionRow = {
        id: 'ver-360-latest',
        templateId: id,
        version: opts.employee360Latest.version,
        schemaJson:
          opts.employee360Latest.schemaJson ??
          schemaForPublishedVersion(
            meta.schema,
            opts.employee360Latest.version,
          ),
        publishedAt: opts.employee360Latest.publishedAt ?? new Date('2024-01-01'),
        createdAt: new Date('2024-01-01'),
      } as VersionRow;
      versionsByTemplateId.set(id, [version]);
    } else {
      // Other templates (and 360 without override): already match seed at v1.
      versionsByTemplateId.set(id, [
        {
          id: `ver-${code}-1`,
          templateId: id,
          version: 1,
          schemaJson: schemaForPublishedVersion(meta.schema, 1),
          publishedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
        } as VersionRow,
      ]);
    }
  }

  const templates = {
    findOne: jest.fn(async ({ where }: { where: { code: string } }) => {
      return templatesByCode.get(where.code) ?? null;
    }),
    create: jest.fn((row: Partial<QuestionnaireTemplate>) => row),
    save: jest.fn(async (row: QuestionnaireTemplate) => {
      templatesByCode.set(row.code, row);
      return row;
    }),
  };

  const versions = {
    findOne: jest.fn(
      async ({
        where,
        order,
      }: {
        where: { templateId: string };
        order?: { version: 'ASC' | 'DESC' };
      }) => {
        const list = versionsByTemplateId.get(where.templateId) ?? [];
        if (list.length === 0) return null;
        const sorted = [...list].sort((a, b) => a.version - b.version);
        return order?.version === 'DESC'
          ? sorted[sorted.length - 1]
          : sorted[0];
      },
    ),
    create: jest.fn((row: Partial<VersionRow>) => row),
    save: jest.fn(async (row: VersionRow) => {
      versionSaves.push(row);
      const list = versionsByTemplateId.get(row.templateId) ?? [];
      const idx = list.findIndex((v) => v.id === row.id || v.version === row.version);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...row };
      } else {
        const created = {
          ...row,
          id: row.id ?? `ver-new-${row.version}`,
          createdAt: row.createdAt ?? new Date(),
        } as VersionRow;
        list.push(created);
      }
      versionsByTemplateId.set(row.templateId, list);
      return row;
    }),
  };

  const assignments = {
    count: jest.fn(async () => opts.assignmentCount ?? 0),
  };

  const service = new QuestionnaireSeedService(
    templates as never,
    versions as never,
    assignments as never,
  );

  return { service, templates, versions, assignments, versionSaves };
}

describe('QuestionnaireSeedService latest-version publish', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('latest v2 equals seed after normalize → no v3', async () => {
    process.env.NODE_ENV = 'development';
    const { service, versions, assignments, versionSaves } = makeHarness({
      employee360Latest: {
        version: 2,
        schemaJson: schemaForPublishedVersion(
          EMPLOYEE_360_V1_SCHEMA as unknown as Record<string, unknown>,
          2,
        ),
      },
    });

    await service.ensureEmployee360V1();

    expect(assignments.count).not.toHaveBeenCalled();
    const createdV3 = versionSaves.some(
      (row) =>
        row.templateId === `tpl-${EMPLOYEE_360_TEMPLATE_CODE}` &&
        row.version === 3,
    );
    expect(createdV3).toBe(false);
    // findOne for latest was used; no new version row for 360
    expect(versions.save).not.toHaveBeenCalledWith(
      expect.objectContaining({ version: 3 }),
    );
  });

  it('drift + assignments → v3 with schema_json.version=3', async () => {
    process.env.NODE_ENV = 'development';
    const drifted = schemaForPublishedVersion(
      EMPLOYEE_360_V1_SCHEMA as unknown as Record<string, unknown>,
      2,
    );
    drifted.title = 'Drifted title';

    const { service, versionSaves, assignments } = makeHarness({
      employee360Latest: { version: 2, schemaJson: drifted },
      assignmentCount: 2,
    });

    await service.ensureEmployee360V1();

    expect(assignments.count).toHaveBeenCalled();
    const v3 = versionSaves.find(
      (row) =>
        row.templateId === `tpl-${EMPLOYEE_360_TEMPLATE_CODE}` &&
        row.version === 3,
    );
    expect(v3).toBeDefined();
    expect(v3!.schemaJson.version).toBe(3);
    expect(v3!.schemaJson.title).toBe(
      (EMPLOYEE_360_V1_SCHEMA as { title: string }).title,
    );
  });

  it('production drift throws', async () => {
    process.env.NODE_ENV = 'production';
    const drifted = schemaForPublishedVersion(
      EMPLOYEE_360_V1_SCHEMA as unknown as Record<string, unknown>,
      2,
    );
    drifted.title = 'Prod drift';

    const { service, versionSaves } = makeHarness({
      employee360Latest: { version: 2, schemaJson: drifted },
      assignmentCount: 0,
    });

    await expect(service.ensureEmployee360V1()).rejects.toThrow(
      /immutable in production/i,
    );
    expect(
      versionSaves.some(
        (row) => row.templateId === `tpl-${EMPLOYEE_360_TEMPLATE_CODE}`,
      ),
    ).toBe(false);
  });
});
