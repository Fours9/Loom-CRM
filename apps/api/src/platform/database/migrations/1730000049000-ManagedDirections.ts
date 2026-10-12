import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR 0011 amendment: `managementKind=direction` stores explicit managed
 * direction IDs (multi-select), mirrored for Position template + EA.
 * Access expands those directions to department scope.
 *
 * Backfill: existing direction leadership → one join row from EA/position
 * direction_id (or department.direction_id fallback).
 */
export class ManagedDirections1730000049000 implements MigrationInterface {
  name = 'ManagedDirections1730000049000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "position_managed_directions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "position_id" uuid NOT NULL,
        "direction_id" uuid NOT NULL,
        CONSTRAINT "PK_position_managed_directions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_position_managed_directions_pair" UNIQUE ("position_id", "direction_id"),
        CONSTRAINT "FK_pmd_position"
          FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pmd_direction"
          FOREIGN KEY ("direction_id") REFERENCES "directions"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_pmd_position_id" ON "position_managed_directions" ("position_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_pmd_direction_id" ON "position_managed_directions" ("direction_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "employment_assignment_managed_directions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "assignment_id" uuid NOT NULL,
        "direction_id" uuid NOT NULL,
        CONSTRAINT "PK_ea_managed_directions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ea_managed_directions_pair" UNIQUE ("assignment_id", "direction_id"),
        CONSTRAINT "FK_eamd_assignment"
          FOREIGN KEY ("assignment_id") REFERENCES "employment_assignments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_eamd_direction"
          FOREIGN KEY ("direction_id") REFERENCES "directions"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_eamd_assignment_id"
        ON "employment_assignment_managed_directions" ("assignment_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_eamd_direction_id"
        ON "employment_assignment_managed_directions" ("direction_id")
    `);

    await queryRunner.query(`
      INSERT INTO "position_managed_directions" ("position_id", "direction_id")
      SELECT p."id", COALESCE(p."direction_id", d."direction_id")
      FROM "positions" p
      LEFT JOIN "departments" d ON d."id" = p."department_id"
      WHERE p."management_kind_template" = 'direction'
        AND COALESCE(p."direction_id", d."direction_id") IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "employment_assignment_managed_directions" ("assignment_id", "direction_id")
      SELECT ea."id", COALESCE(ea."direction_id", d."direction_id")
      FROM "employment_assignments" ea
      LEFT JOIN "departments" d ON d."id" = ea."department_id"
      WHERE ea."management_kind" = 'direction'
        AND COALESCE(ea."direction_id", d."direction_id") IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "employment_assignment_managed_directions"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "position_managed_directions"`,
    );
  }
}
