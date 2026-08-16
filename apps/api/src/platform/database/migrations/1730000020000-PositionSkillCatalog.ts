import { MigrationInterface, QueryRunner } from 'typeorm';
import { v5 as uuidv5 } from 'uuid';
import {
  SKILL_DEFINITIONS,
  SKILL_GROUP_CODES,
  SKILL_GROUP_LABELS_UA,
} from '@loom/position-skill-catalog';

/** Deterministic namespace so seed UUIDs are stable across environments. */
const SEED_NS = '7c3e9a12-4b8f-4d21-9e06-a1b2c3d4e5f6';

function groupId(code: string): string {
  return uuidv5(`skill-group:${code}`, SEED_NS);
}

function skillId(code: string): string {
  return uuidv5(`skill:${code}`, SEED_NS);
}

/**
 * Position Catalog PR5: skill_groups / skills (seeded from @loom/position-skill-catalog)
 * + position_skill_requirements / position_duties / position_goal_templates.
 */
export class PositionSkillCatalog1730000020000 implements MigrationInterface {
  name = 'PositionSkillCatalog1730000020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "skill_groups" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" character varying(64) NOT NULL,
        "name" character varying(255) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_skill_groups" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_skill_groups_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "skills" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "group_id" uuid NOT NULL,
        "code" character varying(64) NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text,
        "scale_max" integer NOT NULL DEFAULT 5,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_skills" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_skills_code" UNIQUE ("code"),
        CONSTRAINT "FK_skills_group"
          FOREIGN KEY ("group_id") REFERENCES "skill_groups"("id")
          ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_skills_group" ON "skills" ("group_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "position_skill_requirements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "position_id" uuid NOT NULL,
        "skill_id" uuid NOT NULL,
        "target_level" integer NOT NULL DEFAULT 0,
        "required" boolean NOT NULL DEFAULT true,
        "weight" integer,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_position_skill_requirements" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_position_skill_req" UNIQUE ("position_id", "skill_id"),
        CONSTRAINT "FK_psr_position"
          FOREIGN KEY ("position_id") REFERENCES "positions"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_psr_skill"
          FOREIGN KEY ("skill_id") REFERENCES "skills"("id")
          ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_psr_position" ON "position_skill_requirements" ("position_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_psr_skill" ON "position_skill_requirements" ("skill_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "position_duties" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "position_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_position_duties" PRIMARY KEY ("id"),
        CONSTRAINT "FK_position_duties_position"
          FOREIGN KEY ("position_id") REFERENCES "positions"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_position_duties_position" ON "position_duties" ("position_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "position_goal_templates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "position_id" uuid NOT NULL,
        "goal_kind" character varying(32) NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_position_goal_templates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_position_goal_templates_position"
          FOREIGN KEY ("position_id") REFERENCES "positions"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_position_goal_templates_position" ON "position_goal_templates" ("position_id")`,
    );

    const groupSort: Record<string, number> = {
      TECH: 10,
      BEAUTY: 20,
      OFFICE: 30,
    };

    for (const code of SKILL_GROUP_CODES) {
      const id = groupId(code);
      const name = SKILL_GROUP_LABELS_UA[code];
      const sortOrder = groupSort[code] ?? 0;
      await queryRunner.query(
        `
        INSERT INTO "skill_groups" ("id", "code", "name", "sort_order", "is_active")
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT ("code") DO NOTHING
        `,
        [id, code, name, sortOrder],
      );
    }

    for (const def of SKILL_DEFINITIONS) {
      const id = skillId(def.code);
      const gid = groupId(def.group);
      await queryRunner.query(
        `
        INSERT INTO "skills" ("id", "group_id", "code", "name", "description", "scale_max", "is_active")
        VALUES ($1, $2, $3, $4, NULL, 5, true)
        ON CONFLICT ("code") DO NOTHING
        `,
        [id, gid, def.code, def.labelUa],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "position_goal_templates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "position_duties"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "position_skill_requirements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "skills"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "skill_groups"`);
  }
}
