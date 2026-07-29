import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { QuestionnairesApiService } from '../core/questionnaires-api.service';
import { QuestionnaireDraftStore } from './questionnaire-draft.store';
import { QuestionnaireAutosaveQueue } from './questionnaire-autosave.queue';

const DEBOUNCE_MS = 1300;

/**
 * Serializes draft PATCHes. Never cancels an in-flight accepted PATCH (no switchMap).
 */
@Injectable()
export class QuestionnaireAutosaveCoordinator {
  private readonly api = inject(QuestionnairesApiService);
  private readonly store = inject(QuestionnaireDraftStore);

  private readonly queue = new QuestionnaireAutosaveQueue({
    debounceMs: DEBOUNCE_MS,
    isBlocked: () => this.store.autosaveBlocked() || !this.store.editable(),
    getGeneration: () => this.store.getGeneration(),
    save: async (generation) => {
      const detail = this.store.assignment();
      if (!detail) {
        return { ok: false, conflict: false, message: 'Немає assignment' };
      }
      if (!this.store.markSaving(generation)) {
        return { ok: false, conflict: false, message: 'stale' };
      }

      try {
        const result = await firstValueFrom(
          this.api.patchDraft(detail.id, {
            answers: this.store.snapshotAnswers(),
            revision: this.store.revision(),
          }),
        );
        if (!this.store.applySaveSuccess(generation, result)) {
          return { ok: false, conflict: false, message: 'stale' };
        }
        return { ok: true, revision: result.revision };
      } catch (err: unknown) {
        if (generation !== this.store.getGeneration()) {
          return { ok: false, conflict: false, message: 'stale' };
        }
        if (isConflict(err)) {
          await this.handleConflict(generation, detail.id);
          return { ok: false, conflict: true };
        }
        const message =
          (err as HttpErrorResponse)?.error?.message ||
          'Не вдалося зберегти чернетку';
        this.store.applySaveError(generation, message);
        this.store.markDirtyIfNeeded();
        return { ok: false, conflict: false, message };
      }
    },
  });

  scheduleSave(): void {
    if (!this.store.editable() || this.store.autosaveBlocked()) return;
    this.store.markDirtyIfNeeded();
    this.queue.schedule();
  }

  async flush(): Promise<boolean> {
    if (this.store.autosaveBlocked()) return false;
    const dirty =
      this.queue.hasPending ||
      this.store.saveState() === 'dirty' ||
      this.store.saveState() === 'error';
    if (!dirty && !this.queue.isInFlight) {
      return true;
    }
    return this.queue.flush();
  }

  cancelDebounceOnly(): void {
    this.queue.cancelDebounceOnly();
  }

  resetForAssignmentSwitch(): void {
    this.queue.reset();
  }

  private async handleConflict(
    gen: number,
    assignmentId: string,
  ): Promise<void> {
    try {
      const detail = await firstValueFrom(this.api.getAssignment(assignmentId));
      if (gen !== this.store.getGeneration()) return;
      this.store.enterConflict(gen, {
        answers: { ...(detail.draft?.answers ?? {}) },
        revision: detail.draft?.revision ?? 0,
      });
    } catch {
      if (gen !== this.store.getGeneration()) return;
      this.store.enterConflict(gen, {
        answers: {},
        revision: this.store.revision(),
      });
    }
  }
}

function isConflict(err: unknown): boolean {
  return (err as HttpErrorResponse)?.status === 409;
}
