import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  QuestionnaireAssignmentDetail,
  QuestionnaireAssignmentStatus,
  QuestionnaireSchemaStep,
} from '@loom/contracts-questionnaires';
import { QuestionnairesApiService } from '../core/questionnaires-api.service';
import { QuestionnaireProfileMirrorService } from '../core/questionnaire-profile-mirror.service';
import {
  QUESTIONNAIRE_INTRO_STEP,
  QUESTIONNAIRE_REVIEW_STEP,
  type QuestionnaireWizardStepKey,
} from '../navigation/questionnaire-step-keys';
import { resolveQuestionnaireActiveStep } from '../navigation/resolve-active-step';
import { normalizeQuestionnaireSchemaSteps } from './validation/normalize-schema';
import {
  completedSchemaStepKeys,
  computeQuestionnaireProgress,
} from './progress/questionnaire-progress';
import {
  areStepRequiredFieldsValid,
  collectStepIssues,
  displayFieldValue,
  type FieldValidationIssue,
} from './validation/questionnaire-validation';

export type LoadState = 'idle' | 'loading' | 'ready' | 'not_found' | 'error';
export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
export type SubmitState = 'idle' | 'submitting' | 'success' | 'error';
export type UiMode =
  | 'editable'
  | 'read_only'
  | 'unavailable'
  | 'owner_only'
  | 'not_found';

export type ConflictState = {
  serverAnswers: Record<string, unknown>;
  serverRevision: number;
} | null;

/**
 * Route-scoped draft state. Provide on FillPage — never providedIn: 'root'.
 */
@Injectable()
export class QuestionnaireDraftStore {
  private readonly api = inject(QuestionnairesApiService);
  private readonly mirrorApi = inject(QuestionnaireProfileMirrorService);

  /** Bumps on assignment switch / clear — guards stale HTTP. */
  private generation = 0;

  readonly loadState = signal<LoadState>('idle');
  readonly loadError = signal<string | null>(null);
  readonly assignment = signal<QuestionnaireAssignmentDetail | null>(null);
  readonly schemaSteps = signal<QuestionnaireSchemaStep[]>([]);
  readonly answers = signal<Record<string, unknown>>({});
  readonly profileMirror = signal<Record<string, unknown>>({});
  readonly revision = signal(0);
  readonly activeStepKey = signal<QuestionnaireWizardStepKey>(
    QUESTIONNAIRE_INTRO_STEP,
  );
  readonly saveState = signal<SaveState>('idle');
  readonly lastSavedAt = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly autosaveBlocked = signal(false);
  readonly conflict = signal<ConflictState>(null);
  readonly submitState = signal<SubmitState>('idle');
  readonly submitError = signal<string | null>(null);
  readonly schemaError = signal<string | null>(null);

  readonly uiMode = computed<UiMode>(() => {
    const state = this.loadState();
    if (state === 'not_found') return 'not_found';
    if (state !== 'ready') return 'not_found';
    const detail = this.assignment();
    if (!detail) return 'not_found';
    const status = detail.status;
    if (status === 'cancelled') return 'unavailable';
    if (!detail.capabilities.canEditDraft && !detail.capabilities.canSubmit) {
      if (status === 'submitted' || status === 'reviewed') return 'read_only';
      return 'owner_only';
    }
    if (status === 'submitted' || status === 'reviewed') return 'read_only';
    return 'editable';
  });

  readonly editable = computed(() => this.uiMode() === 'editable');

  readonly progress = computed(() =>
    computeQuestionnaireProgress(
      this.schemaSteps(),
      this.answers(),
      this.profileMirror(),
    ),
  );

  readonly completedSteps = computed(() =>
    completedSchemaStepKeys(
      this.schemaSteps(),
      this.answers(),
      this.profileMirror(),
    ),
  );

  readonly reviewerMessage = computed(() => {
    const detail = this.assignment();
    if (!detail || detail.status !== 'changes_requested') return null;
    const latest = detail.submissions[0];
    return latest?.reviewComment ?? null;
  });

  getGeneration(): number {
    return this.generation;
  }

  clear(): void {
    this.generation += 1;
    this.loadState.set('idle');
    this.loadError.set(null);
    this.assignment.set(null);
    this.schemaSteps.set([]);
    this.answers.set({});
    this.profileMirror.set({});
    this.revision.set(0);
    this.activeStepKey.set(QUESTIONNAIRE_INTRO_STEP);
    this.saveState.set('idle');
    this.lastSavedAt.set(null);
    this.saveError.set(null);
    this.autosaveBlocked.set(false);
    this.conflict.set(null);
    this.submitState.set('idle');
    this.submitError.set(null);
    this.schemaError.set(null);
  }

  async load(assignmentId: string, requestedStepKey?: string | null): Promise<void> {
    this.clear();
    const gen = this.generation;
    this.loadState.set('loading');

    try {
      const detail = await firstValueFrom(this.api.getAssignment(assignmentId));
      if (gen !== this.generation) return;

      const normalized = normalizeQuestionnaireSchemaSteps(detail.schema);
      if (!normalized.ok) {
        this.schemaError.set(normalized.error);
        this.loadState.set('error');
        this.loadError.set(normalized.error);
        return;
      }

      const mirror = await firstValueFrom(
        this.mirrorApi.resolve(detail.employeeId, detail.profileMirror),
      );
      if (gen !== this.generation) return;

      this.assignment.set(detail);
      this.schemaSteps.set(normalized.steps);
      this.answers.set({ ...(detail.draft?.answers ?? {}) });
      this.revision.set(detail.draft?.revision ?? 0);
      this.profileMirror.set(mirror);
      this.loadState.set('ready');

      this.applyRequestedStep(requestedStepKey ?? null);
    } catch (err: unknown) {
      if (gen !== this.generation) return;
      const status = (err as { status?: number })?.status;
      if (status === 404) {
        this.loadState.set('not_found');
        this.loadError.set('Анкету не знайдено');
        return;
      }
      this.loadState.set('error');
      this.loadError.set(
        (err as { error?: { message?: string } })?.error?.message ||
          'Не вдалося завантажити анкету',
      );
    }
  }

  applyRequestedStep(requestedStepKey: string | null): void {
    const completed = this.completedSteps();
    const resolved = resolveQuestionnaireActiveStep({
      requestedStepKey,
      schemaSteps: this.schemaSteps(),
      completedStepKeys: completed,
    });
    this.activeStepKey.set(resolved);
  }

  setActiveStep(stepKey: QuestionnaireWizardStepKey): void {
    const resolved = resolveQuestionnaireActiveStep({
      requestedStepKey: stepKey,
      schemaSteps: this.schemaSteps(),
      completedStepKeys: this.completedSteps(),
    });
    this.activeStepKey.set(resolved);
  }

  setAnswer(fieldKey: string, value: unknown): void {
    if (!this.editable() || this.conflict()) return;
    this.answers.update((prev) => ({ ...prev, [fieldKey]: value }));
    if (this.saveState() !== 'saving') {
      this.saveState.set('dirty');
    }
    this.saveError.set(null);
  }

  markSaving(gen: number): boolean {
    if (gen !== this.generation) return false;
    this.saveState.set('saving');
    this.saveError.set(null);
    return true;
  }

  applySaveSuccess(
    gen: number,
    result: { answers: Record<string, unknown>; revision: number; updatedAt: string },
  ): boolean {
    if (gen !== this.generation) return false;
    this.revision.set(result.revision);
    this.lastSavedAt.set(result.updatedAt);
    this.saveState.set('saved');
    this.saveError.set(null);
    // Keep local answers (may be newer than saved snapshot).
    return true;
  }

  applySaveError(gen: number, message: string): boolean {
    if (gen !== this.generation) return false;
    this.saveState.set('error');
    this.saveError.set(message);
    return true;
  }

  enterConflict(
    gen: number,
    server: { answers: Record<string, unknown>; revision: number },
  ): boolean {
    if (gen !== this.generation) return false;
    this.autosaveBlocked.set(true);
    this.conflict.set({
      serverAnswers: { ...server.answers },
      serverRevision: server.revision,
    });
    this.saveState.set('error');
    this.saveError.set('Чернетку змінено в іншій вкладці');
    return true;
  }

  /** User chose to discard local answers and take server draft. */
  acceptServerConflict(): void {
    const c = this.conflict();
    if (!c) return;
    this.answers.set({ ...c.serverAnswers });
    this.revision.set(c.serverRevision);
    this.conflict.set(null);
    this.autosaveBlocked.set(false);
    this.saveState.set('saved');
    this.saveError.set(null);
  }

  markDirtyIfNeeded(): void {
    if (this.saveState() === 'saving') return;
    this.saveState.set('dirty');
  }

  isCurrentStepRequiredValid(): boolean {
    const key = this.activeStepKey();
    if (key === QUESTIONNAIRE_INTRO_STEP || key === QUESTIONNAIRE_REVIEW_STEP) {
      return true;
    }
    const step = this.schemaSteps().find((s) => s.key === key);
    if (!step) return true;
    return areStepRequiredFieldsValid(
      step.fields,
      this.answers(),
      this.profileMirror(),
    );
  }

  currentStepIssues(): FieldValidationIssue[] {
    const key = this.activeStepKey();
    const step = this.schemaSteps().find((s) => s.key === key);
    if (!step) return [];
    return collectStepIssues(
      step.fields,
      this.answers(),
      this.profileMirror(),
    );
  }

  allRequiredValid(): boolean {
    return this.schemaSteps().every((step) =>
      areStepRequiredFieldsValid(
        step.fields,
        this.answers(),
        this.profileMirror(),
      ),
    );
  }

  allIssues(): FieldValidationIssue[] {
    return this.schemaSteps().flatMap((step) =>
      collectStepIssues(step.fields, this.answers(), this.profileMirror()),
    );
  }

  displayValue(fieldKey: string): unknown {
    const steps = this.schemaSteps();
    for (const step of steps) {
      const field = step.fields.find((f) => f.key === fieldKey);
      if (field) {
        return displayFieldValue(this.answers(), this.profileMirror(), field);
      }
    }
    return hasOwn(this.answers(), fieldKey)
      ? this.answers()[fieldKey]
      : undefined;
  }

  snapshotAnswers(): Record<string, unknown> {
    return { ...this.answers() };
  }

  assignmentStatus(): QuestionnaireAssignmentStatus | null {
    return this.assignment()?.status ?? null;
  }

  beginSubmit(): boolean {
    if (this.submitState() === 'submitting') return false;
    this.submitState.set('submitting');
    this.submitError.set(null);
    return true;
  }

  finishSubmitSuccess(): void {
    this.submitState.set('success');
    this.submitError.set(null);
  }

  finishSubmitError(message: string): void {
    this.submitState.set('error');
    this.submitError.set(message);
  }

  clearSubmittingKeepAnswers(): void {
    this.submitState.set('idle');
  }
}

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
