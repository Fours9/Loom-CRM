import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { QuestionnaireType } from '../questionnaire.enums';
import { EMPLOYEE_360_TEMPLATE_CODE } from '../seed/employee-360-v1.schema';
import { EMPLOYEE_STARTER_TEMPLATE_CODE } from '../seed/employee-starter-v1.schema';

/** Fail-closed stable prefix map (no UA transliteration). */
export function questionnaireAssignmentCodePrefix(
  templateCode: string,
  type: QuestionnaireType | string,
): string {
  if (templateCode === EMPLOYEE_360_TEMPLATE_CODE) {
    return '360';
  }
  if (templateCode === EMPLOYEE_STARTER_TEMPLATE_CODE) {
    return 'STA';
  }
  switch (type) {
    case 'full':
      return 'POV';
    case 'managing':
      return 'MAN';
    case 'docs':
      return 'DOC';
    default:
      throw new BadRequestException(
        `Unknown questionnaire code prefix for template=${templateCode} type=${type}`,
      );
  }
}

export function formatAssignmentCode(prefix: string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new BadRequestException(
      `Invalid assignment code sequence: ${sequence}`,
    );
  }
  return `${prefix}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Monotonic per-prefix allocator inside an open transaction.
 * INSERT … ON CONFLICT DO NOTHING → FOR UPDATE → return old next_value, increment.
 */
export async function allocateNextAssignmentCode(
  manager: EntityManager,
  prefix: string,
): Promise<string> {
  await manager.query(
    `
      INSERT INTO "questionnaire_assignment_code_counters" ("prefix", "next_value")
      VALUES ($1, 1)
      ON CONFLICT ("prefix") DO NOTHING
    `,
    [prefix],
  );

  const rows = await manager.query(
    `
      SELECT "next_value" AS "nextValue"
      FROM "questionnaire_assignment_code_counters"
      WHERE "prefix" = $1
      FOR UPDATE
    `,
    [prefix],
  );
  const current = Number(rows[0]?.nextValue);
  if (!Number.isFinite(current) || current < 1) {
    throw new BadRequestException(
      `Counter missing or invalid for prefix ${prefix}`,
    );
  }

  await manager.query(
    `
      UPDATE "questionnaire_assignment_code_counters"
      SET "next_value" = $2
      WHERE "prefix" = $1
    `,
    [prefix, current + 1],
  );

  return formatAssignmentCode(prefix, current);
}

/** Escape `%` / `_` / `\` for ILIKE … ESCAPE '\'. */
export function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
