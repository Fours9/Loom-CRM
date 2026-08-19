import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Skills may exist without a group (group is live classification / sorting).
 * Rollback is intentionally blocked once ungrouped skills exist;
 * there is no deterministic inverse mapping.
 */
export class SkillGroupOptional1730000026000 implements MigrationInterface {
  name = 'SkillGroupOptional1730000026000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "skills"
        ALTER COLUMN "group_id" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*)::int AS count FROM "skills" WHERE "group_id" IS NULL`,
    );
    const count = Number(rows[0]?.count ?? 0);
    if (count > 0) {
      throw new Error(
        `Cannot restore skills.group_id NOT NULL: ${count} ungrouped skill(s) exist. ` +
          'Rollback is intentionally blocked; there is no deterministic inverse mapping.',
      );
    }
    await queryRunner.query(`
      ALTER TABLE "skills"
        ALTER COLUMN "group_id" SET NOT NULL
    `);
  }
}
