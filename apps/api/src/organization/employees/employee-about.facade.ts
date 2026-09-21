import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  canonicalizeAboutMutation,
  extractAboutKeysFromSnapshot,
  validateAboutSyncSet,
} from '@loom/employee-about-catalog';

export type EmployeeAboutMergeSource =
  | {
      kind: 'questionnaire';
      submissionId: string;
      syncedAt: Date;
      actorUserId: string | null;
    }
  | {
      kind: 'manual';
      actorUserId: string;
    };

export type EmployeeAboutMergeInput = {
  set: Record<string, unknown>;
  clearKeys: string[];
  source: EmployeeAboutMergeSource;
};

/**
 * Sole mutation entry for employee_about.
 * Atomic JSONB merge: (answers || set) - clearKeys.
 */
@Injectable()
export class EmployeeAboutFacade {
  /**
   * No-op when set and clearKeys are both empty.
   * Preserves last_source_submission_id / last_synced_at on manual source.
   */
  async mergeAnswers(
    manager: EntityManager,
    employeeId: string,
    input: EmployeeAboutMergeInput,
  ): Promise<void> {
    const clearKeys = [...new Set(input.clearKeys)].filter(Boolean);
    const setKeys = Object.keys(input.set);
    if (!setKeys.length && !clearKeys.length) return;

    const setForWrite: Record<string, unknown> = { ...input.set };
    for (const key of clearKeys) {
      delete setForWrite[key];
    }

    const now = new Date();
    const source = input.source;
    const isQuestionnaire = source.kind === 'questionnaire';
    const actorUserId = source.actorUserId;
    const submissionId =
      source.kind === 'questionnaire' ? source.submissionId : null;
    const syncedAt = source.kind === 'questionnaire' ? source.syncedAt : null;

    await manager.query(
      `
      INSERT INTO employee_about (
        employee_id,
        answers,
        updated_at,
        updated_by_user_id,
        last_source_submission_id,
        last_synced_at
      )
      VALUES (
        $1,
        ($2::jsonb - COALESCE($3::text[], ARRAY[]::text[])),
        $4,
        $5,
        $6,
        $7
      )
      ON CONFLICT (employee_id) DO UPDATE SET
        answers = (employee_about.answers || EXCLUDED.answers)
          - COALESCE($3::text[], ARRAY[]::text[]),
        updated_at = EXCLUDED.updated_at,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        last_source_submission_id = CASE
          WHEN $8::boolean THEN EXCLUDED.last_source_submission_id
          ELSE employee_about.last_source_submission_id
        END,
        last_synced_at = CASE
          WHEN $8::boolean THEN EXCLUDED.last_synced_at
          ELSE employee_about.last_synced_at
        END
      `,
      [
        employeeId,
        JSON.stringify(setForWrite),
        clearKeys.length ? clearKeys : null,
        now,
        actorUserId,
        submissionId,
        syncedAt,
        isQuestionnaire,
      ],
    );
  }

  /**
   * Present-only sync from questionnaire snapshot + conditional clearKeys.
   */
  async syncFromSubmissionSnapshot(
    manager: EntityManager,
    input: {
      employeeId: string;
      snapshotJson: Record<string, unknown>;
      submissionId: string;
      actorUserId: string | null;
      syncedAt?: Date;
    },
  ): Promise<void> {
    const extracted = extractAboutKeysFromSnapshot(input.snapshotJson);
    const validated = validateAboutSyncSet(extracted);
    const { set, clearKeys } = canonicalizeAboutMutation(validated);
    await this.mergeAnswers(manager, input.employeeId, {
      set,
      clearKeys,
      source: {
        kind: 'questionnaire',
        submissionId: input.submissionId,
        syncedAt: input.syncedAt ?? new Date(),
        actorUserId: input.actorUserId,
      },
    });
  }
}
