import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { QuestionnairesApiService } from '../core/questionnaires-api.service';
import { QuestionnaireAutosaveCoordinator } from './questionnaire-autosave.coordinator';
import { QuestionnaireDraftStore } from './questionnaire-draft.store';

export type ManualSaveResult = 'saved' | 'already_saved' | 'failed';

/**
 * Route-scoped revision actions (reopen / draft flush / resubmit).
 * Provide on FillPage alongside DraftStore + AutosaveCoordinator.
 */
@Injectable()
export class QuestionnaireRevisionCoordinator {
  private readonly api = inject(QuestionnairesApiService);
  private readonly store = inject(QuestionnaireDraftStore);
  private readonly autosave = inject(QuestionnaireAutosaveCoordinator);
  private readonly router = inject(Router);

  readonly manualSaveBusy = signal(false);
  readonly manualSaveMessage = signal<string | null>(null);
  readonly manualSaveError = computed(() => this.store.saveError());

  private messageTimer: ReturnType<typeof setTimeout> | null = null;

  async reopenSelf(): Promise<void> {
    const id = this.store.assignment()?.id;
    if (!id) throw new Error('Немає assignment');
    await firstValueFrom(this.api.reopenSelf(id));
    this.autosave.resetForAssignmentSwitch();
    await this.store.load(id, this.store.activeStepKey());
  }

  async startRevision(): Promise<void> {
    const id = this.store.assignment()?.id;
    if (!id) throw new Error('Немає assignment');
    await firstValueFrom(this.api.startRevision(id));
    this.autosave.resetForAssignmentSwitch();
    await this.store.load(id, this.store.activeStepKey());
  }

  async saveDraft(): Promise<boolean> {
    this.store.materializeMirrorIntoProposalAnswers();
    return this.autosave.flush();
  }

  async saveDraftWithFeedback(): Promise<ManualSaveResult> {
    if (this.manualSaveBusy()) return 'failed';
    if (this.store.saveState() === 'saving') return 'failed';

    this.manualSaveBusy.set(true);
    try {
      const before = this.store.saveState();
      if (before === 'idle' || before === 'saved') {
        this.flashMessage('Уже збережено');
        return 'already_saved';
      }
      const ok = await this.saveDraft();
      if (!ok) {
        this.flashMessage(null);
        return 'failed';
      }
      this.flashMessage('Збережено');
      return 'saved';
    } finally {
      this.manualSaveBusy.set(false);
    }
  }

  /**
   * Flush draft, create a new immutable submission (and proposals), then leave.
   * UI label remains «Зберегти і закрити».
   */
  async resubmitAndClose(): Promise<void> {
    if (!this.canResubmit()) {
      throw new Error('Неможливо зберегти анкету');
    }
    if (!this.store.beginSubmit()) {
      throw new Error('Збереження вже виконується');
    }

    this.store.materializeMirrorIntoProposalAnswers();
    const flushed = await this.autosave.flush();
    if (!flushed) {
      this.store.finishSubmitError(
        this.store.saveError() ?? 'Не вдалося зберегти чернетку',
      );
      throw new Error(this.store.submitError() ?? 'flush failed');
    }

    const detail = this.store.assignment();
    const id = detail?.id;
    if (!id) {
      this.store.finishSubmitError('Немає assignment');
      throw new Error('Немає assignment');
    }

    if (detail.templateType === 'managing') {
      try {
        const extras =
          detail.context?.version === 2
            ? (detail.context.positionCatalog.skills ?? [])
                .filter((s) => s.source === 'questionnaire_extra')
                .map((s) => s.code)
            : [];
        const synced = await firstValueFrom(
          this.api.syncPositionContext(id, {
            expectedDraftRevision: this.store.revision(),
            desiredExtraSkillCodes: extras,
          }),
        );
        this.store.applyPositionContextSync(synced);
      } catch (err: unknown) {
        const message =
          (err as { error?: { message?: string } })?.error?.message ||
          'Не вдалося синхронізувати посаду перед надсиланням';
        this.store.finishSubmitError(message);
        throw err;
      }
    }

    try {
      await firstValueFrom(this.api.submit(id));
      this.store.clearSubmittingKeepAnswers();
      const employeeId = detail.employeeId;
      await this.router.navigateByUrl(
        employeeId ? `/people/${employeeId}` : '/people',
      );
    } catch (err: unknown) {
      this.store.finishSubmitError(
        (err as { error?: { message?: string } })?.error?.message ||
          'Не вдалося зберегти анкету',
      );
      throw err;
    }
  }

  canResubmit(): boolean {
    if (!this.store.editable()) return false;
    if (this.store.conflict()) return false;
    if (this.store.submitState() === 'submitting') return false;
    if (!this.store.assignment()?.capabilities?.canSubmit) return false;
    return this.store.allRequiredValid();
  }

  isRevisionEdit(): boolean {
    const detail = this.store.assignment();
    if (!detail || !this.store.editable()) return false;
    return detail.submissions.length > 0;
  }

  private flashMessage(message: string | null, ms = 2200): void {
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.manualSaveMessage.set(message);
    if (!message) {
      this.messageTimer = null;
      return;
    }
    this.messageTimer = setTimeout(() => {
      this.manualSaveMessage.set(null);
      this.messageTimer = null;
    }, ms);
  }
}
