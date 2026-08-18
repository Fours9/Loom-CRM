import { firstValueFrom, type Observable } from 'rxjs';
import type { OrgPosition, OrgPositionSkillRequirement } from '../settings-org-api.service';
import {
  classifyPositionCreateError,
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

function apiMessage(err: unknown, fallback: string): string {
  const msg = (err as { error?: { message?: string | string[] } })?.error?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string' && msg.trim()) return msg;
  return fallback;
}

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
      queue.markFailed(row.clientId, apiMessage(err, 'Не вдалося додати вимогу'));
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

export async function createPositionThenApplyDrafts(input: {
  api: PositionDraftApi;
  queue: PositionDraftSkillQueue;
  mode: PositionDialogMode;
  body: {
    name: string;
    departmentId?: string | null;
    directionId?: string | null;
    description?: string | null;
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
        message: apiMessage(err, 'Не вдалося додати посаду'),
      };
    }
    input.setMode('unresolved-create');
    return { kind: 'unknown' };
  }

  if (input.queue.isEmpty()) {
    input.setMode('edit');
    return { kind: 'created', position: created, mode: 'edit' };
  }

  input.setMode('applying-drafts');
  const serverRows = await applyDraftRequirements(
    input.api,
    created.id,
    input.queue,
  );
  void serverRows;
  const nextMode: PositionDialogMode = input.queue.hasUnresolved()
    ? 'edit-with-failed-drafts'
    : 'edit';
  input.setMode(nextMode);
  return { kind: 'created', position: created, mode: nextMode };
}

export async function retryFailedDrafts(
  api: PositionDraftApi,
  positionId: string,
  queue: PositionDraftSkillQueue,
): Promise<OrgPositionSkillRequirement[]> {
  return applyDraftRequirements(api, positionId, queue);
}
