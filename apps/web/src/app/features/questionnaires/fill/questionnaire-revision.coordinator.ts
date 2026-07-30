import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { QuestionnairesApiService } from '../core/questionnaires-api.service';
import { QuestionnaireAutosaveCoordinator } from './questionnaire-autosave.coordinator';
import { QuestionnaireDraftStore } from './questionnaire-draft.store';

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

  async reopenSelf(): Promise<void> {
    const id = this.store.assignment()?.id;
    if (!id) throw new Error('Немає assignment');
    await firstValueFrom(this.api.reopenSelf(id));
    this.autosave.resetForAssignmentSwitch();
    await this.store.load(id, this.store.activeStepKey());
  }

  async saveDraft(): Promise<boolean> {
    return this.autosave.flush();
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
}
