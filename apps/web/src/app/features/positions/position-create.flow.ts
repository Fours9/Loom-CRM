import { firstValueFrom, type Observable } from 'rxjs';
import type { ManagementKind } from '../../shared/organization/labels';
import type { OrgPosition, OrgPositionSkillRequirement } from '../settings/settings-org-api.service';
import {
  classifyPositionCreateError,
  httpErrorMessage,
  isSaveLocked,
  type PositionDialogMode,
} from './position-dialog.models';
import type { PositionDraftSkillQueue } from './position-draft-skill-queue';

export type PositionDraftApi = {
  createPosition(body: {
    name: string;
    departmentId?: string | null;
    directionId?: string | null;
    description?: string | null;
    isDepartmentManagerTemplate?: boolean;
    managementKindTemplate?: ManagementKind;
    managedDepartmentIds?: string[];
  }): Observable<OrgPosition>;
  createPositionSkillRequirement(
    positionId: string,
    body: { skillId: string; targetLevel?: number; required?: boolean },
  ): Observable<OrgPositionSkillRequirement>;
  getPositionSkillRequirements(
    positionId: string,
  ): Observable<OrgPositionSkillRequirement[]>;
  updatePositionSkillRequirement(
    positionId: string,
    id: string,
    body: Partial<{ targetLevel: number; required: boolean }>,
  ): Observable<OrgPositionSkillRequirement>;
};

export type CreateFlowResult =
  | { kind: 'created'; position: OrgPosition; mode: PositionDialogMode }
  | { kind: 'known-rejection'; message: string }
  | { kind: 'unknown' }
  | { kind: 'locked' };

export type ApplyQueuedInput = {
  api: PositionDraftApi;
  positionId: string;
  queue: PositionDraftSkillQueue;
  setMode: (mode: PositionDialogMode) => void;
};

export type ApplyQueuedResult = {
  rows: OrgPositionSkillRequirement[];
  mode: PositionDialogMode;
};

export type PersistDraftInput = ApplyQueuedInput & {
  /** When true, switch PositionDialogMode through applying-drafts. */
  lockUi: boolean;
};

/** Sequential apply + reconcile. Does not own PositionDialogMode. */
export async function applyDraftRequirements(
  api: PositionDraftApi,
  positionId: string,
  queue: PositionDraftSkillQueue,
): Promise<OrgPositionSkillRequirement[]> {
  for (const row of queue.pendingInSequence()) {
    queue.markApplying(row.clientId);
    try {
      if (row.state === 'conflict' && row.persistedId) {
        await firstValueFrom(
          api.updatePositionSkillRequirement(positionId, row.persistedId, {
            targetLevel: row.targetLevel,
            required: row.required,
          }),
        );
      } else {
        await firstValueFrom(
          api.createPositionSkillRequirement(positionId, {
            skillId: row.skillId,
            targetLevel: row.targetLevel,
            required: row.required,
          }),
        );
      }
    } catch (err) {
      queue.markFailed(row.clientId, httpErrorMessage(err, 'Не вдалося додати вимогу'));
    }
  }

  try {
    const serverRows = await firstValueFrom(api.getPositionSkillRequirements(positionId));
    queue.reconcile(serverRows);
    return serverRows;
  } catch {
    for (const row of queue.snapshot()) {
      if (row.state === 'applying') {
        queue.markFailed(row.clientId, 'Не вдалося звірити вимоги з сервером');
      }
    }
    return [];
  }
}

/**
 * Single persist entry for draft skill requirements.
 * `lockUi: true` — create / retry (applying-drafts).
 * `lockUi: false` — edit picker (no applying-drafts; picker stays open).
 */
export async function persistDraftRequirements(
  input: PersistDraftInput,
): Promise<ApplyQueuedResult> {
  if (input.lockUi) {
    input.setMode('applying-drafts');
  }
  const rows = await applyDraftRequirements(input.api, input.positionId, input.queue);
  const mode: PositionDialogMode = input.queue.hasUnresolved()
    ? 'edit-with-failed-drafts'
    : 'edit';
  if (input.lockUi) {
    input.setMode(mode);
  } else if (mode === 'edit-with-failed-drafts') {
    input.setMode(mode);
  }
  return { rows, mode };
}

/** Lifecycle use-case: applying-drafts → sequential apply → edit | edit-with-failed-drafts. */
export async function applyQueuedRequirements(
  input: ApplyQueuedInput,
): Promise<ApplyQueuedResult> {
  return persistDraftRequirements({ ...input, lockUi: true });
}

/** UI-facing alias over applyQueuedRequirements. */
export async function retryFailedDrafts(
  input: ApplyQueuedInput,
): Promise<ApplyQueuedResult> {
  return applyQueuedRequirements(input);
}

export async function createPositionThenApplyDrafts(input: {
  api: PositionDraftApi;
  queue: PositionDraftSkillQueue;
  mode: PositionDialogMode;
  body: {
    name: string;
    departmentId?: string | null;
    directionId?: string | null;
    description?: string | null;
    isDepartmentManagerTemplate?: boolean;
    managementKindTemplate?: ManagementKind;
    managedDepartmentIds?: string[];
  };
  setMode: (mode: PositionDialogMode) => void;
}): Promise<CreateFlowResult> {
  if (isSaveLocked(input.mode)) return { kind: 'locked' };

  input.setMode('creating-position');
  let created: OrgPosition;
  try {
    created = await firstValueFrom(input.api.createPosition(input.body));
  } catch (err) {
    if (classifyPositionCreateError(err) === 'known-rejection') {
      input.setMode('create');
      return {
        kind: 'known-rejection',
        message: httpErrorMessage(err, 'Не вдалося додати посаду'),
      };
    }
    input.setMode('unresolved-create');
    return { kind: 'unknown' };
  }

  if (input.queue.isEmpty()) {
    input.setMode('edit');
    return { kind: 'created', position: created, mode: 'edit' };
  }

  const applied = await persistDraftRequirements({
    api: input.api,
    positionId: created.id,
    queue: input.queue,
    setMode: input.setMode,
    lockUi: true,
  });
  return { kind: 'created', position: created, mode: applied.mode };
}
