import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  QuestionnaireAssignmentDetail,
  QuestionnaireAssignmentStatus,
  QuestionnaireSchemaStep,
} from '@loom/contracts-questionnaires';
import { QuestionnairesApiService } from '../core/questionnaires-api.service';
import { QuestionnaireProfileMirrorService } from '../core/questionnaire-profile-mirror.service';
import { hasActiveReviewerRequest } from '../core/questionnaire-active-change-request';
import {
  QUESTIONNAIRE_INTRO_STEP,
  QUESTIONNAIRE_REVIEW_STEP,
  type QuestionnaireWizardStepKey,
} from '../navigation/questionnaire-step-keys';
import { resolveBrowsableQuestionnaireStep } from '../navigation/questionnaire-step-browse';
import { normalizeQuestionnaireSchemaSteps } from './validation/normalize-schema';
import {
  completedSchemaStepKeys,
  computeQuestionnaireProgress,
} from './progress/questionnaire-progress';
import {
  collectStepIssues,
  isRequiredFieldValid,
  type FieldValidationIssue,
} from './validation/questionnaire-validation';
import { resolveQuestionnaireFieldDisplay } from './display/questionnaire-display-value';
import { mergeLegacyContactsIntoDraft } from '../../../shared/employee-contacts/public-api';
import { shouldAutoBeginEditSession } from './questionnaire-fill-session.policy';
import {
  areStepVisibleRequiredValid,
  fieldsByKey,
  isQuestionnaireFieldVisible,
} from '@loom/questionnaire-schema';

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
  /** Steps opened in this fill session — drives progress-rail filled dots. */
  readonly visitedStepKeys = signal<ReadonlySet<string>>(new Set());
  readonly saveState = signal<SaveState>('idle');
  readonly lastSavedAt = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly autosaveBlocked = signal(false);
  readonly conflict = signal<ConflictState>(null);
  readonly submitState = signal<SubmitState>('idle');
  readonly submitError = signal<string | null>(null);
  readonly schemaError = signal<string | null>(null);
  /** First-fill auto-starts from load policy; otherwise explicit «Редагувати». */
  readonly editSessionActive = signal(false);

  readonly uiMode = computed<UiMode>(() => {
    const state = this.loadState();
    if (state === 'not_found') return 'not_found';
    if (state !== 'ready') return 'not_found';
    const detail = this.assignment();
    if (!detail) return 'not_found';
    const status = detail.status;
    const canMutateDraft =
      detail.capabilities.canEditDraft || detail.capabilities.canSubmit;

    if (canMutateDraft) {
      if (status === 'submitted' || status === 'reviewed') return 'read_only';
      return this.editSessionActive() ? 'editable' : 'read_only';
    }
    if (status === 'closed') return 'read_only';
    /** Detached (cancelled) is read-only — draft/submissions stay visible until reattached. */
    if (status === 'cancelled') return 'read_only';
    if (status === 'assigned' || status === 'in_progress') return 'owner_only';
    return 'read_only';
  });

  /** Show top-right «Редагувати» when viewing and edit is allowed / startable. */
  readonly canShowEditButton = computed(() => {
    if (this.loadState() !== 'ready') return false;
    if (this.editSessionActive()) return false;
    const detail = this.assignment();
    if (!detail) return false;
    if (detail.status === 'closed') return false;
    return (
      detail.capabilities.canEditDraft ||
      detail.capabilities.canReopenSelf ||
      detail.capabilities.canStartRevision
    );
  });

  readonly canShowRequestChangesButton = computed(() => {
    if (this.loadState() !== 'ready') return false;
    if (this.editSessionActive()) return false;
    const detail = this.assignment();
    if (!detail) return false;
    if (detail.status !== 'submitted' && detail.status !== 'reviewed') {
      return false;
    }
    return !!detail.capabilities.canRequestChanges;
  });

  /** Hard-delete only in edit session (or closed view — edit is blocked). */
  readonly canShowDeleteButton = computed(() => {
    if (this.loadState() !== 'ready') return false;
    const detail = this.assignment();
    if (!detail?.capabilities?.canDelete) return false;
    if (detail.status === 'closed') return true;
    return this.editSessionActive() && this.uiMode() === 'editable';
  });

  readonly editable = computed(() => this.uiMode() === 'editable');

  /** Fill chrome title: replace «співробітника» with LastName FirstName. */
  readonly pageTitle = computed(() => {
    const detail = this.assignment();
    const title = detail?.templateTitle?.trim() || 'Анкета';
    const last =
      detail?.employeeLastName?.trim() ||
      (typeof this.profileMirror()['lastName'] === 'string'
        ? String(this.profileMirror()['lastName']).trim()
        : '');
    const first =
      detail?.employeeFirstName?.trim() ||
      (typeof this.profileMirror()['firstName'] === 'string'
        ? String(this.profileMirror()['firstName']).trim()
        : '');
    const name = [last, first].filter(Boolean).join(' ');
    if (!name) return title;
    if (/співробітника/i.test(title)) {
      return title.replace(/співробітника/gi, name);
    }
    return `${title} — ${name}`;
  });

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
    if (!detail) return null;
    const latest = detail.submissions[0];
    if (
      !hasActiveReviewerRequest({
        assignmentStatus: detail.status,
        latest,
      })
    ) {
      return null;
    }
    return latest!.reviewComment?.trim() || null;
  });

  readonly canResolveChangeRequest = computed(() => {
    const detail = this.assignment();
    return !!detail?.capabilities.canResolveChangeRequest;
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
    this.visitedStepKeys.set(new Set());
    this.saveState.set('idle');
    this.lastSavedAt.set(null);
    this.saveError.set(null);
    this.autosaveBlocked.set(false);
    this.conflict.set(null);
    this.submitState.set('idle');
    this.submitError.set(null);
    this.schemaError.set(null);
    this.editSessionActive.set(false);
  }

  beginEditSession(): void {
    this.editSessionActive.set(true);
    this.materializeMirrorIntoProposalAnswers();
  }

  endEditSession(): void {
    this.editSessionActive.set(false);
  }

  /**
   * Copy currently displayed mirror defaults into draft for proposal-mapped fields
   * that the user has not edited yet — so submit snapshot includes confirmed values
   * and diffs vs profile are computed correctly.
   */
  materializeMirrorIntoProposalAnswers(): void {
    if (!this.editSessionActive() || this.conflict()) return;

    const schema = {
      code: 'x',
      version: 1,
      title: '',
      steps: this.schemaSteps(),
    };
    const byKey = fieldsByKey(schema);
    const mirror = this.profileMirror();
    const prev = this.answers();
    const next = { ...prev };
    let changed = false;

    for (const field of byKey.values()) {
      if (field.valueType === 'contacts_bundle') {
        if (Object.prototype.hasOwnProperty.call(next, field.key)) continue;
        if (
          !Object.prototype.hasOwnProperty.call(mirror, 'contactsBundle')
        ) {
          continue;
        }
        next[field.key] = mirror['contactsBundle'];
        changed = true;
        continue;
      }
      if (!field.createsProfileProposal || !field.proposalMapping) continue;
      if (Object.prototype.hasOwnProperty.call(next, field.key)) continue;

      const display = resolveQuestionnaireFieldDisplay(field, {
        answers: next,
        profileMirror: mirror,
        fieldsByKey: byKey,
      });
      if (display.source !== 'profile_mirror') continue;
      const value = display.value;
      if (value === null || value === undefined || value === '') continue;
      if (Array.isArray(value) && value.length === 0) continue;

      next[field.key] = value;
      changed = true;
    }

    if (!changed) return;
    this.answers.set(next);
    if (this.saveState() !== 'saving') {
      this.saveState.set('dirty');
    }
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

      const mirror = detail.employeeId
        ? await firstValueFrom(
            this.mirrorApi.resolve(detail.employeeId, detail.profileMirror),
          )
        : (detail.profileMirror ?? {});
      if (gen !== this.generation) return;

      this.assignment.set(detail);
      this.schemaSteps.set(normalized.steps);
      const loadedAnswers = mergeLegacyContactsIntoDraft(
        { ...(detail.draft?.answers ?? {}) },
        mirror,
      );
      this.answers.set(loadedAnswers);
      this.revision.set(detail.draft?.revision ?? 0);
      this.profileMirror.set(mirror);
      this.loadState.set('ready');

      if (
        shouldAutoBeginEditSession({
          status: detail.status,
          canEditDraft: detail.capabilities.canEditDraft,
          hasSubmissions: detail.submissions.length > 0,
        })
      ) {
        this.beginEditSession();
      }

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
    const resolved = resolveBrowsableQuestionnaireStep({
      requestedStepKey,
      editable: this.editable(),
      schemaSteps: this.schemaSteps(),
      completedStepKeys: this.completedSteps(),
    });
    this.activeStepKey.set(resolved);
    this.markStepVisited(resolved);
  }

  setActiveStep(stepKey: QuestionnaireWizardStepKey): void {
    const resolved = resolveBrowsableQuestionnaireStep({
      requestedStepKey: stepKey,
      editable: this.editable(),
      schemaSteps: this.schemaSteps(),
      completedStepKeys: this.completedSteps(),
    });
    this.activeStepKey.set(resolved);
    this.markStepVisited(resolved);
  }

  private markStepVisited(stepKey: string): void {
    this.visitedStepKeys.update((prev) => {
      if (prev.has(stepKey)) return prev;
      const next = new Set(prev);
      next.add(stepKey);
      return next;
    });
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
    return areStepVisibleRequiredValid(step, this.answers(), (f, v) =>
      isRequiredFieldValid(f, v),
    );
  }

  currentStepIssues(): FieldValidationIssue[] {
    const key = this.activeStepKey();
    const step = this.schemaSteps().find((s) => s.key === key);
    if (!step) return [];
    return collectStepIssues(
      step.fields.filter((f) =>
        isQuestionnaireFieldVisible(f, this.answers()),
      ),
      this.answers(),
      this.profileMirror(),
    );
  }

  allRequiredValid(): boolean {
    return this.schemaSteps().every((step) =>
      areStepVisibleRequiredValid(step, this.answers(), (f, v) =>
        isRequiredFieldValid(f, v),
      ),
    );
  }

  allIssues(): FieldValidationIssue[] {
    return this.schemaSteps().flatMap((step) =>
      collectStepIssues(step.fields, this.answers(), this.profileMirror()),
    );
  }

  displayValue(fieldKey: string): unknown {
    const byKey = fieldsByKey({
      code: 'x',
      version: 1,
      title: '',
      steps: this.schemaSteps(),
    });
    const field = byKey.get(fieldKey);
    if (!field) {
      return hasOwn(this.answers(), fieldKey)
        ? this.answers()[fieldKey]
        : undefined;
    }
    return resolveQuestionnaireFieldDisplay(field, {
      answers: this.answers(),
      profileMirror: this.profileMirror(),
      fieldsByKey: byKey,
    }).value;
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
