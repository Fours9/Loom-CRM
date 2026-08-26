import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Direction } from '../../organization/companies/direction.entity';
import { Department } from '../../organization/departments/department.entity';
import { Position } from '../../organization/positions/position.entity';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuidOrNull(value: unknown, key: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new BadRequestException(`${key} must be a UUID or null`);
  }
  return value;
}

export type QuestionnaireOrganizationSelection = {
  directionId: string | null;
  directionName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  positionId: string | null;
  positionName: string | null;
};

/**
 * Canonical hierarchy for Managing org refs / context freeze.
 * Position entity is SoT when set; department determines direction when position null;
 * direction-only allowed when both position and department are null.
 * Same domain rules as organization_ref validation — single entry for sync + submit.
 */
export async function resolveQuestionnaireOrganizationSelection(
  answers: Record<string, unknown>,
  manager: EntityManager,
): Promise<QuestionnaireOrganizationSelection> {
  const draftDirectionId = asUuidOrNull(
    Object.prototype.hasOwnProperty.call(answers, 'company_work.direction_id')
      ? answers['company_work.direction_id']
      : null,
    'company_work.direction_id',
  );
  const draftDepartmentId = asUuidOrNull(
    Object.prototype.hasOwnProperty.call(answers, 'company_work.department_id')
      ? answers['company_work.department_id']
      : null,
    'company_work.department_id',
  );
  const draftPositionId = asUuidOrNull(
    Object.prototype.hasOwnProperty.call(answers, 'company_work.position_id')
      ? answers['company_work.position_id']
      : null,
    'company_work.position_id',
  );

  if (draftPositionId) {
    const position = await manager.getRepository(Position).findOne({
      where: { id: draftPositionId },
    });
    if (!position || position.isActive === false) {
      throw new BadRequestException('Unknown or inactive position');
    }
    if (
      draftDepartmentId != null &&
      position.departmentId &&
      draftDepartmentId !== position.departmentId
    ) {
      throw new BadRequestException(
        'Position does not belong to selected department',
      );
    }
    if (
      draftDirectionId != null &&
      position.directionId &&
      draftDirectionId !== position.directionId
    ) {
      throw new BadRequestException(
        'Position does not belong to selected direction',
      );
    }

    const departmentId = position.departmentId ?? null;
    const directionId = position.directionId ?? null;
    const [departmentName, directionName] = await Promise.all([
      departmentId
        ? manager
            .getRepository(Department)
            .findOne({ where: { id: departmentId } })
            .then((d) => d?.name ?? null)
        : Promise.resolve(null),
      directionId
        ? manager
            .getRepository(Direction)
            .findOne({ where: { id: directionId } })
            .then((d) => d?.name ?? null)
        : Promise.resolve(null),
    ]);

    return {
      positionId: position.id,
      positionName: position.name,
      departmentId,
      departmentName,
      directionId,
      directionName,
    };
  }

  if (draftDepartmentId) {
    const department = await manager.getRepository(Department).findOne({
      where: { id: draftDepartmentId },
    });
    if (!department || department.isActive === false) {
      throw new BadRequestException('Unknown or inactive department');
    }
    const directionId = department.directionId ?? null;
    if (
      draftDirectionId != null &&
      directionId &&
      draftDirectionId !== directionId
    ) {
      throw new BadRequestException(
        'Department does not belong to selected direction',
      );
    }
    const directionName = directionId
      ? (
          await manager.getRepository(Direction).findOne({
            where: { id: directionId },
          })
        )?.name ?? null
      : null;

    return {
      positionId: null,
      positionName: null,
      departmentId: department.id,
      departmentName: department.name,
      directionId,
      directionName,
    };
  }

  if (draftDirectionId) {
    const direction = await manager.getRepository(Direction).findOne({
      where: { id: draftDirectionId },
    });
    if (!direction || direction.isActive === false) {
      throw new BadRequestException('Unknown or inactive direction');
    }
    return {
      positionId: null,
      positionName: null,
      departmentId: null,
      departmentName: null,
      directionId: direction.id,
      directionName: direction.name,
    };
  }

  return {
    positionId: null,
    positionName: null,
    departmentId: null,
    departmentName: null,
    directionId: null,
    directionName: null,
  };
}

/** Write Position-SoT org triple into draft answers (keeps draft ≡ frozen context). */
export function applyCanonicalOrganizationAnswers(
  answers: Record<string, unknown>,
  org: Pick<
    QuestionnaireOrganizationSelection,
    'directionId' | 'departmentId' | 'positionId'
  >,
): void {
  answers['company_work.direction_id'] = org.directionId;
  answers['company_work.department_id'] = org.departmentId;
  answers['company_work.position_id'] = org.positionId;
}
