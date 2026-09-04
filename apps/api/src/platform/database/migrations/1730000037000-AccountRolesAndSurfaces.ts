import { MigrationInterface, QueryRunner } from 'typeorm';

type SurfaceSeed = {
  id: string;
  labelUa: string;
  groupKey: string;
  sortOrder: number;
};

/** Catalog from docs/product/access-surfaces.md. */
const SURFACES: SurfaceSeed[] = [
  { id: 'nav.home', labelUa: 'Головна', groupKey: 'nav', sortOrder: 10 },
  { id: 'nav.people', labelUa: 'Люди', groupKey: 'nav', sortOrder: 20 },
  { id: 'nav.positions', labelUa: 'Посади', groupKey: 'nav', sortOrder: 30 },
  {
    id: 'nav.questionnaires',
    labelUa: 'Анкети',
    groupKey: 'nav',
    sortOrder: 40,
  },
  { id: 'nav.absences', labelUa: 'Відсутності', groupKey: 'nav', sortOrder: 50 },
  { id: 'nav.statistics', labelUa: 'Статистика', groupKey: 'nav', sortOrder: 60 },
  { id: 'nav.settings', labelUa: 'Налаштування', groupKey: 'nav', sortOrder: 70 },
  {
    id: 'route.positions',
    labelUa: 'Сторінка посад',
    groupKey: 'route',
    sortOrder: 10,
  },
  {
    id: 'people.tab.data',
    labelUa: 'Профіль — Дані',
    groupKey: 'people',
    sortOrder: 10,
  },
  {
    id: 'people.tab.work',
    labelUa: 'Профіль — Робота',
    groupKey: 'people',
    sortOrder: 20,
  },
  {
    id: 'people.tab.documents',
    labelUa: 'Профіль — Документи',
    groupKey: 'people',
    sortOrder: 30,
  },
  {
    id: 'people.tab.questionnaires',
    labelUa: 'Профіль — Анкети',
    groupKey: 'people',
    sortOrder: 40,
  },
  {
    id: 'people.tab.metrics',
    labelUa: 'Профіль — Показники',
    groupKey: 'people',
    sortOrder: 50,
  },
  {
    id: 'people.tab.administration',
    labelUa: 'Профіль — Адміністрування',
    groupKey: 'people',
    sortOrder: 60,
  },
  {
    id: 'people.tab.later',
    labelUa: 'Профіль — Пізніше',
    groupKey: 'people',
    sortOrder: 70,
  },
  {
    id: 'settings.access_roles',
    labelUa: 'Налаштування — Доступи',
    groupKey: 'settings',
    sortOrder: 10,
  },
];

const EMPLOYEE_SURFACES = [
  'nav.home',
  'nav.people',
  'nav.questionnaires',
  'nav.absences',
  'nav.statistics',
  'people.tab.data',
  'people.tab.work',
  'people.tab.documents',
  'people.tab.questionnaires',
  'people.tab.later',
];

const DEPARTMENT_MANAGER_SURFACES = [
  ...EMPLOYEE_SURFACES,
  'people.tab.metrics',
];

const DIRECTOR_SURFACES = [
  ...DEPARTMENT_MANAGER_SURFACES,
  'nav.positions',
  'route.positions',
];

const ADMIN_SURFACES = SURFACES.map((s) => s.id);

const SURFACE_GRANTS: Record<string, string[]> = {
  employee: EMPLOYEE_SURFACES,
  department_manager: DEPARTMENT_MANAGER_SURFACES,
  director: DIRECTOR_SURFACES,
  admin: ADMIN_SURFACES,
};

const SYSTEM_ROLES = [
  {
    code: 'employee',
    name: 'Працівник',
    preset: 'employee',
    isAdminEquivalent: false,
    extras: [] as string[],
  },
  {
    code: 'department_manager',
    name: 'Менеджер',
    preset: 'department_manager',
    isAdminEquivalent: false,
    extras: [] as string[],
  },
  {
    code: 'director',
    name: 'Директор',
    preset: 'department_manager',
    isAdminEquivalent: false,
    extras: ['positions.manage'],
  },
  {
    code: 'admin',
    name: 'Адміністратор',
    preset: 'admin',
    isAdminEquivalent: true,
    extras: [] as string[],
  },
];

/**
 * ADR 0011 step 2: Platform AccessControl becomes the authZ source of truth.
 * users.role stays only as a compatibility mirror.
 */
export class AccountRolesAndSurfaces1730000037000
  implements MigrationInterface
{
  name = 'AccountRolesAndSurfaces1730000037000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Schema
    await queryRunner.query(`
      CREATE TABLE "app_surfaces" (
        "id" varchar(96) NOT NULL,
        "label_ua" varchar(160) NOT NULL,
        "group_key" varchar(64) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_app_surfaces_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "account_roles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" varchar(64),
        "name" varchar(160) NOT NULL,
        "permission_preset" varchar(64) NOT NULL,
        "is_admin_equivalent" boolean NOT NULL DEFAULT false,
        "is_system" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_account_roles_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_account_roles_code" UNIQUE ("code"),
        CONSTRAINT "CHK_account_roles_permission_preset"
          CHECK ("permission_preset" IN ('employee', 'department_manager', 'admin')),
        CONSTRAINT "CHK_account_roles_system_has_code"
          CHECK ("is_system" = false OR "code" IS NOT NULL)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "account_role_surfaces" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "account_role_id" uuid NOT NULL,
        "surface_id" varchar(96) NOT NULL,
        CONSTRAINT "PK_account_role_surfaces_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_account_role_surfaces_role_surface"
          UNIQUE ("account_role_id", "surface_id"),
        CONSTRAINT "FK_account_role_surfaces_role"
          FOREIGN KEY ("account_role_id") REFERENCES "account_roles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_account_role_surfaces_surface"
          FOREIGN KEY ("surface_id") REFERENCES "app_surfaces"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_account_role_surfaces_role_id"
        ON "account_role_surfaces" ("account_role_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "account_role_permissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "account_role_id" uuid NOT NULL,
        "permission" varchar(96) NOT NULL,
        CONSTRAINT "PK_account_role_permissions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_account_role_permissions_role_permission"
          UNIQUE ("account_role_id", "permission"),
        CONSTRAINT "FK_account_role_permissions_role"
          FOREIGN KEY ("account_role_id") REFERENCES "account_roles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_account_role_permissions_role_id"
        ON "account_role_permissions" ("account_role_id")
    `);

    // 2. Seed surfaces + system roles
    for (const surface of SURFACES) {
      await queryRunner.query(
        `INSERT INTO "app_surfaces" ("id", "label_ua", "group_key", "sort_order")
         VALUES ($1, $2, $3, $4)`,
        [surface.id, surface.labelUa, surface.groupKey, surface.sortOrder],
      );
    }

    for (const role of SYSTEM_ROLES) {
      await queryRunner.query(
        `INSERT INTO "account_roles"
           ("id", "code", "name", "permission_preset", "is_admin_equivalent", "is_system")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true)`,
        [role.code, role.name, role.preset, role.isAdminEquivalent],
      );
      for (const permission of role.extras) {
        await queryRunner.query(
          `INSERT INTO "account_role_permissions" ("id", "account_role_id", "permission")
           SELECT gen_random_uuid(), r."id", $2
           FROM "account_roles" r
           WHERE r."code" = $1`,
          [role.code, permission],
        );
      }
    }

    // 3. Seed surface grants
    for (const [code, surfaceIds] of Object.entries(SURFACE_GRANTS)) {
      for (const surfaceId of surfaceIds) {
        await queryRunner.query(
          `INSERT INTO "account_role_surfaces" ("id", "account_role_id", "surface_id")
           SELECT gen_random_uuid(), r."id", $2
           FROM "account_roles" r
           WHERE r."code" = $1`,
          [code, surfaceId],
        );
      }
    }

    // 4. Nullable link column
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN "account_role_id" uuid
    `);

    // 5. Backfill from the legacy users.role mirror
    await queryRunner.query(`
      UPDATE "users" u
      SET "account_role_id" = r."id"
      FROM "account_roles" r
      WHERE r."code" = u."role"
    `);

    // 6. Fail closed — never leave a User without an account role
    const orphans: { count: string }[] = await queryRunner.query(`
      SELECT COUNT(*)::text AS count FROM "users" WHERE "account_role_id" IS NULL
    `);
    if (Number(orphans[0]?.count ?? 0) > 0) {
      throw new Error(
        `Cannot migrate: ${orphans[0].count} user(s) have a role that matches no account_roles.code. Resolve users.role before migration.`,
      );
    }

    // 7. Constrain
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD CONSTRAINT "FK_users_account_role"
        FOREIGN KEY ("account_role_id") REFERENCES "account_roles"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "account_role_id" SET NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_users_account_role_id" ON "users" ("account_role_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_users_account_role_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_account_role"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "account_role_id"
    `);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "account_role_permissions"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "account_role_surfaces"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "account_roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "app_surfaces"`);
  }
}
