import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { EntityManager, In, Repository } from 'typeorm';
import {
  type PositionSkillContext,
  type QuestionnaireContextV2,
  parseQuestionnaireContext,
} from '@loom/contracts-questionnaires';
import {
  InvalidPositionSkillsMatrix,
  parsePositionSkillsMatrixStrict,
  pruneUnratedMatrixRatings,
  type PositionSkillsMatrixAnswer,
} from '@loom/questionnaire-schema';
import { PositionCatalogFacade } from '../../organization/position-catalog/position-catalog.facade';
import { Skill } from '../../organization/skills/skill.entity';
import { QuestionnaireAssignment } from './questionnaire-assignment.entity';
import { QuestionnaireResponse } from './questionnaire-response.entity';
import {
  resolveValidatedExtras,
  staleRatingCodes,
  validateDesiredExtraSkillCodes,
} from './questionnaire-position-context-sync.policy';
import {
  resolveQuestionnaireOrganizationSelection,
  applyCanonicalOrganizationAnswers,
} from './questionnaire-organization-selection';

const MATRIX_KEY = 'skills.matrix';

export type SyncLockedInput = {
  desiredExtraSkillCodes: string[];
  /**
   * When set, must match lockedResponse.revision (public sync).
   * Omit on close-submit (revision sealed by this sync).
   */
  expectedDraftRevision?: number;
};

/**
 * Core sync body for Managing position context.
 * Caller must hold assignment + response write locks inside an open TX.
 * No auth, no outer TX, no getDetail. Always bumps response.revision.
 */
export async function syncLocked(
  manager: EntityManager,
  lockedAssignment: QuestionnaireAssignment,
  lockedResponse: QuestionnaireResponse,
  input: SyncLockedInput,
  positionCatalog: PositionCatalogFacade,
): Promise<void> {
  const desiredParsed = validateDesiredExtraSkillCodes(
    input.desiredExtraSkillCodes,
  );
  if (!desiredParsed.ok) {
    throw new BadRequestException(desiredParsed.error);
  }

  if (!lockedAssignment.employeeId) {
    throw new BadRequestException(
      'Questionnaire must be attached before syncing position context',
    );
  }

  if (
    input.expectedDraftRevision != null &&
    lockedResponse.revision !== input.expectedDraftRevision
  ) {
    throw new ConflictException({
      message: 'Draft revision conflict',
      currentRevision: lockedResponse.revision,
    });
  }

  const answers = {
    ...(lockedResponse.answersJson ?? {}),
  } as Record<string, unknown>;

  const existingCtx = parseQuestionnaireContext(lockedAssignment.contextJson);
  if (existingCtx.ok) {
    const catalog = existingCtx.context.positionCatalog;
    const draftEmpty = [
      'company_work.direction_id',
      'company_work.department_id',
      'company_work.position_id',
    ].every((key) => {
      const v = answers[key];
      return v == null || v === '';
    });
    const contextHasOrg =
      catalog.directionId != null ||
      catalog.departmentId != null ||
      catalog.positionId != null;
    if (draftEmpty && contextHasOrg) {
      applyCanonicalOrganizationAnswers(answers, catalog);
    }
  }

  const org = await resolveQuestionnaireOrganizationSelection(answers, manager);
  applyCanonicalOrganizationAnswers(answers, org);

  const baseSnapshot = await positionCatalog.buildSnapshotForPosition(
    lockedAssignment.employeeId,
    org.positionId,
    manager,
  );
  const newRequirementCodes = new Set(
    baseSnapshot.positionCatalog.skills.map((s) => s.code),
  );

  const extrasResolved = resolveValidatedExtras({
    desiredExtraSkillCodes: desiredParsed.codes,
    newRequirementCodes,
  });
  if (!extrasResolved.ok) {
    throw new BadRequestException(extrasResolved.error);
  }

  const skillsByCode = await loadSkillsByCode(
    manager.getRepository(Skill),
    extrasResolved.extraCodes,
  );

  const extraSkills: PositionSkillContext[] = [];
  for (const code of extrasResolved.extraCodes) {
    const skill = skillsByCode.get(code);
    if (!skill || !skill.isActive) {
      throw new BadRequestException(
        `Unknown or inactive skill code "${code}"`,
      );
    }
    extraSkills.push(skillEntityToExtraContext(skill));
  }

  const contextSkills = [
    ...baseSnapshot.positionCatalog.skills,
    ...extraSkills,
  ];
  const contextSkillCodes = new Set(contextSkills.map((s) => s.code));

  let matrix = readMatrix(answers);
  const draftRatingCodes = matrix.ratings
    .map((r) => r.skillCode)
    .filter(Boolean);
  const stale = staleRatingCodes(draftRatingCodes, contextSkillCodes);
  if (stale.size > 0) {
    matrix = {
      ...matrix,
      ratings: matrix.ratings.filter((r) => !stale.has(r.skillCode)),
    };
  }
  matrix = pruneUnratedMatrixRatings(matrix);
  answers[MATRIX_KEY] = matrix;

  const contextV2: QuestionnaireContextV2 = {
    version: 2,
    positionCatalog: {
      ...baseSnapshot.positionCatalog,
      positionId: org.positionId,
      positionName: org.positionName,
      departmentId: org.departmentId,
      departmentName: org.departmentName,
      directionId: org.directionId,
      directionName: org.directionName,
      skills: contextSkills,
    },
  };

  lockedAssignment.contextJson = contextV2 as unknown as Record<
    string,
    unknown
  >;
  lockedResponse.answersJson = answers;
  lockedResponse.revision = lockedResponse.revision + 1;

  await manager.getRepository(QuestionnaireAssignment).save(lockedAssignment);
  await manager.getRepository(QuestionnaireResponse).save(lockedResponse);
}

/** Extras SoT for People close-submit: persisted V2 questionnaire_extra codes. */
export function desiredExtrasFromPersistedContext(
  contextJson: unknown,
): string[] {
  const parsed = parseQuestionnaireContext(contextJson);
  if (!parsed.ok) return [];
  return parsed.context.positionCatalog.skills
    .filter((s) => s.source === 'questionnaire_extra')
    .map((s) => s.code);
}

function readMatrix(
  answers: Record<string, unknown>,
): PositionSkillsMatrixAnswer {
  try {
    return parsePositionSkillsMatrixStrict(answers[MATRIX_KEY]);
  } catch (err) {
    if (err instanceof InvalidPositionSkillsMatrix) {
      throw new BadRequestException(err.message);
    }
    throw err;
  }
}

async function loadSkillsByCode(
  repo: Repository<Skill>,
  codes: string[],
): Promise<Map<string, Skill>> {
  const unique = [...new Set(codes.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await repo.find({
    where: { code: In(unique) },
    relations: { group: true },
  });
  return new Map(rows.map((s) => [s.code, s]));
}

function skillEntityToExtraContext(skill: Skill): PositionSkillContext {
  return {
    skillId: skill.id,
    code: skill.code,
    labelUa: skill.name,
    group: skill.group?.code ?? '',
    targetLevel: null,
    required: false,
    weight: null,
    scaleKind: skill.scaleKind,
    scaleMin: skill.scaleMin,
    scaleMax: skill.scaleMax,
    source: 'questionnaire_extra',
  };
}
