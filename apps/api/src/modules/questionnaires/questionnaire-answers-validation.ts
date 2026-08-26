import { BadRequestException } from '@nestjs/common';
import type {
  OrganizationEntityKind,
  QuestionnaireSchemaJson,
} from '@loom/contracts-questionnaires';
import {
  InvalidEmployeeContactsBundle,
  parseEmployeeContactsBundleStrict,
  validateEmployeeContactsBundleForWrite,
} from '@loom/employee-contacts';
import {
  InvalidPositionSkillsMatrix,
  listTopLevelFields,
  parsePositionSkillsMatrixStrict,
  validatePositionSkillsMatrixForSubmit,
} from '@loom/questionnaire-schema';
import { EntityManager } from 'typeorm';
import { Direction } from '../../organization/companies/direction.entity';
import { Department } from '../../organization/departments/department.entity';
import { Position } from '../../organization/positions/position.entity';
import { WorkFormat } from '../../organization/employment-catalog/work-format.entity';
import { EmploymentType } from '../../organization/employment-catalog/employment-type.entity';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidOrNull(value: unknown): value is string | null {
  if (value === null) return true;
  return typeof value === 'string' && UUID_RE.test(value);
}

function isNameOrNull(value: unknown): value is string | null {
  if (value === null) return true;
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Structural + semantic validation for organization_ref answers.
 * FE cascade is UX only — this is the domain SoT.
 */
export async function validateOrganizationRefAnswers(
  schema: QuestionnaireSchemaJson,
  answers: Record<string, unknown>,
  manager: EntityManager,
): Promise<void> {
  const fields = listTopLevelFields(schema).filter(
    (f) => f.valueType === 'organization_ref',
  );
  if (!fields.length) return;

  const directionId = Object.prototype.hasOwnProperty.call(
    answers,
    'company_work.direction_id',
  )
    ? answers['company_work.direction_id']
    : undefined;
  const departmentId = Object.prototype.hasOwnProperty.call(
    answers,
    'company_work.department_id',
  )
    ? answers['company_work.department_id']
    : undefined;
  const positionId = Object.prototype.hasOwnProperty.call(
    answers,
    'company_work.position_id',
  )
    ? answers['company_work.position_id']
    : undefined;

  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(answers, field.key)) continue;
    const raw = answers[field.key];
    const entity = field.organizationEntity as OrganizationEntityKind | undefined;
    if (!entity) {
      throw new BadRequestException(
        `Field ${field.key} missing organizationEntity`,
      );
    }

    if (entity === 'direction' || entity === 'department' || entity === 'position') {
      if (!isUuidOrNull(raw)) {
        throw new BadRequestException(`${field.key} must be a UUID or null`);
      }
    } else if (entity === 'work_format' || entity === 'employment_type') {
      if (!isNameOrNull(raw)) {
        throw new BadRequestException(
          `${field.key} must be a non-empty catalog name or null`,
        );
      }
    }

    if (raw === null) continue;

    if (entity === 'direction') {
      const row = await manager.getRepository(Direction).findOne({
        where: { id: raw as string },
      });
      if (!row || row.isActive === false) {
        throw new BadRequestException(`Unknown or inactive direction`);
      }
    } else if (entity === 'department') {
      const row = await manager.getRepository(Department).findOne({
        where: { id: raw as string },
      });
      if (!row || row.isActive === false) {
        throw new BadRequestException(`Unknown or inactive department`);
      }
      if (
        typeof directionId === 'string' &&
        row.directionId &&
        row.directionId !== directionId
      ) {
        throw new BadRequestException(
          'Department does not belong to selected direction',
        );
      }
    } else if (entity === 'position') {
      const row = await manager.getRepository(Position).findOne({
        where: { id: raw as string },
      });
      if (!row || row.isActive === false) {
        throw new BadRequestException(`Unknown or inactive position`);
      }
      if (
        typeof departmentId === 'string' &&
        row.departmentId &&
        row.departmentId !== departmentId
      ) {
        throw new BadRequestException(
          'Position does not belong to selected department',
        );
      }
      if (
        typeof directionId === 'string' &&
        row.directionId &&
        row.directionId !== directionId
      ) {
        throw new BadRequestException(
          'Position does not belong to selected direction',
        );
      }
    } else if (entity === 'work_format') {
      const row = await manager.getRepository(WorkFormat).findOne({
        where: { name: raw as string, isActive: true },
      });
      if (!row) {
        throw new BadRequestException(`Unknown or inactive work format`);
      }
    } else if (entity === 'employment_type') {
      const row = await manager.getRepository(EmploymentType).findOne({
        where: { name: raw as string, isActive: true },
      });
      if (!row) {
        throw new BadRequestException(`Unknown or inactive employment type`);
      }
    }
  }

  // Cross-check when multiple owned without relying on undefined
  void departmentId;
  void positionId;
}

export function normalizeDraftAnswersForPatch(
  schema: QuestionnaireSchemaJson,
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...answers };
  for (const field of listTopLevelFields(schema)) {
    if (!Object.prototype.hasOwnProperty.call(out, field.key)) continue;
    if (field.valueType === 'contacts_bundle') {
      try {
        out[field.key] = parseEmployeeContactsBundleStrict(out[field.key]);
      } catch (err) {
        if (err instanceof InvalidEmployeeContactsBundle) throw err;
        throw new InvalidEmployeeContactsBundle('Invalid contacts bundle');
      }
      continue;
    }
    if (field.valueType === 'position_skills_matrix') {
      try {
        out[field.key] = parsePositionSkillsMatrixStrict(out[field.key]);
      } catch (err) {
        if (err instanceof InvalidPositionSkillsMatrix) throw err;
        throw new InvalidPositionSkillsMatrix('Invalid skills matrix');
      }
    }
  }
  return out;
}

export function validateDraftAnswersForSubmit(
  schema: QuestionnaireSchemaJson,
  answers: Record<string, unknown>,
  options?: {
    allowedSkillCodes?: ReadonlySet<string> | readonly string[];
    levelBoundsByCode?: ReadonlyMap<string, { min: number; max: number }>;
  },
): void {
  for (const field of listTopLevelFields(schema)) {
    if (!Object.prototype.hasOwnProperty.call(answers, field.key)) continue;
    if (field.valueType === 'contacts_bundle') {
      let bundle;
      try {
        bundle = parseEmployeeContactsBundleStrict(answers[field.key]);
      } catch (err) {
        if (err instanceof InvalidEmployeeContactsBundle) throw err;
        throw new InvalidEmployeeContactsBundle('Invalid contacts bundle');
      }
      validateEmployeeContactsBundleForWrite(bundle);
      continue;
    }
    if (field.valueType === 'position_skills_matrix') {
      let matrix;
      try {
        matrix = parsePositionSkillsMatrixStrict(answers[field.key]);
      } catch (err) {
        if (err instanceof InvalidPositionSkillsMatrix) throw err;
        throw new InvalidPositionSkillsMatrix('Invalid skills matrix');
      }
      validatePositionSkillsMatrixForSubmit(
        matrix,
        options?.allowedSkillCodes,
        options?.levelBoundsByCode,
      );
    }
  }
}
