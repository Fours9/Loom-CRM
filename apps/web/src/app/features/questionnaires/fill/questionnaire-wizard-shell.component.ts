import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  QUESTIONNAIRE_INTRO_STEP,
  QUESTIONNAIRE_REVIEW_STEP,
} from '../navigation/questionnaire-step-keys';
import { resolveQuestionnaireNavigationMode } from '../navigation/questionnaire-navigation-mode';
import {
  reviewRowsForStep,
  visibleFieldsForStep,
} from './progress/questionnaire-progress';
import { QuestionnaireAutosaveCoordinator } from './questionnaire-autosave.coordinator';
import { QuestionnaireDraftStore } from './questionnaire-draft.store';
import { QuestionnaireFieldHostComponent } from './fields/questionnaire-field-host.component';
import { QuestionnaireContactsBundleFieldComponent } from './fields/questionnaire-contacts-bundle-field.component';
import { QuestionnaireSkillsMatrixFieldComponent } from './fields/questionnaire-skills-matrix-field.component';
import type { MatrixAvailableSkill } from './fields/questionnaire-skills-matrix-field.component';
import { QuestionnaireSaveStatusComponent } from './questionnaire-save-status.component';
import { QuestionnaireRevisionCoordinator } from './questionnaire-revision.coordinator';
import { shouldShowReviewSubmit } from './questionnaire-fill-session.policy';
import { isQuestionnairePostSubmitStatus } from '@loom/contracts-questionnaires';
import { validateFieldValue } from './validation/questionnaire-validation';
import { QuestionnairesApiService } from '../core/questionnaires-api.service';
import { resolveQuestionnaireFieldDisplay } from './display/questionnaire-display-value';
import type { QuestionnaireSchemaField } from '@loom/contracts-questionnaires';
import {
  fieldsByKey,
  listInactiveOwnAnswers,
  pruneUnratedMatrixRatings,
  type PositionSkillsMatrixAnswer,
} from '@loom/questionnaire-schema';
import {
  OrganizationCatalogApiService,
  type OrganizationCatalogSnapshot,
} from '../../../core/api/organization-catalog-api.service';

const ORG_SYNC_KEYS = [
  'company_work.direction_id',
  'company_work.department_id',
  'company_work.position_id',
] as const;

@Component({
  selector: 'loom-questionnaire-wizard-shell',
  standalone: true,
  imports: [
    QuestionnaireFieldHostComponent,
    QuestionnaireContactsBundleFieldComponent,
    QuestionnaireSkillsMatrixFieldComponent,
    QuestionnaireSaveStatusComponent,
  ],
  template: `
    <div
      class="wizard"
      [class.read-only]="!store.editable()"
    >
      <header class="top">
        @if (store.editable()) {
          <loom-questionnaire-save-status
            class="save-slot"
            [text]="saveStatusText()"
            [visual]="saveStatusVisual()"
          />
        } @else {
          <div class="read-only-row save-slot">
            <loom-questionnaire-save-status
              text="Лише перегляд"
              visual="saved"
            />
            @if (isPostSubmitLocked()) {
              <span class="read-only-hint"
                >Анкету закрито. Перегляд відповідей.</span
              >
            }
          </div>
        }
      </header>

      @if (store.conflict(); as conflict) {
        <div class="banner conflict" role="alert">
          <p>Чернетку змінено в іншій вкладці</p>
          <p class="warn">
            Локальні незбережені зміни буде втрачено, якщо завантажити серверну
            версію.
          </p>
          <button type="button" class="btn primary" (click)="acceptServer()">
            Завантажити серверну версію
          </button>
        </div>
      }

      @if (store.reviewerMessage(); as msg) {
        <div class="banner review">
          <strong>Потрібні зміни</strong>
          <p>{{ msg }}</p>
          @if (store.canResolveChangeRequest()) {
            <div class="resolve-actions">
              <button
                type="button"
                class="btn primary"
                [disabled]="resolveBusy()"
                (click)="resolveCompleted.emit()"
              >
                Правки виконано
              </button>
              <button
                type="button"
                class="btn danger"
                [disabled]="resolveBusy()"
                (click)="resolveDeclined.emit()"
              >
                В правках відмовлено
              </button>
            </div>
          }
        </div>
      }

      <div class="body">
        <section class="viewport">
          @if (store.activeStepKey() === introKey) {
            <div class="intro">
              @if (store.editable() && isRevisionEdit()) {
                <p>
                  Внесіть зміни. Кнопка «Зберегти» лише пише чернетку; щоб
                  оновити пропозиції до профілю, натисніть «Зберегти і закрити».
                </p>
              } @else if (store.editable()) {
                <p>
                  Заповніть анкету кроками. Чернетка зберігається автоматично.
                  Після надсилання керівник зможе переглянути відповіді; зміни до
                  профілю не застосуються автоматично.
                </p>
                <p class="muted">
                  Рекомендовані поля не блокують перехід; обовʼязкові — блокують.
                </p>
              } @else {
                <p>
                  Режим перегляду. Щоб змінити відповіді, натисніть «Редагувати»
                  зверху справа.
                </p>
              }
            </div>
          } @else if (store.activeStepKey() === reviewKey) {
            <div class="review">
              <h2>{{
                store.editable()
                  ? isRevisionEdit()
                    ? 'Перевірте зміни'
                    : 'Перевірте відповіді'
                  : 'Надіслані відповіді'
              }}</h2>
              @if (store.editable() && recommendedWarnings().length) {
                <div class="warnings">
                  <p>Рекомендовані поля без відповіді:</p>
                  <ul>
                    @for (w of recommendedWarnings(); track w.fieldKey) {
                      <li>
                        <button
                          type="button"
                          class="linkish"
                          (click)="focusField(w.fieldKey)"
                        >
                          {{ w.message }}
                        </button>
                      </li>
                    }
                  </ul>
                </div>
              }
              @if (store.editable() && inactiveWarnings().length) {
                <div class="warnings" role="status">
                  <p>Збережені неактивні відповіді — не будуть надіслані:</p>
                  <ul>
                    @for (w of inactiveWarnings(); track w) {
                      <li>{{ w }}</li>
                    }
                  </ul>
                </div>
              }
              @for (step of store.schemaSteps(); track step.key) {
                <article class="review-block">
                  <h3>{{ step.label }}</h3>
                  <dl>
                    @for (
                      row of reviewRows(step.key);
                      track row.fieldKey
                    ) {
                      <div class="dl-row" [class.inactive]="row.inactive">
                        <dt>{{ row.label }}</dt>
                        <dd>
                          {{ row.display }}
                          @if (row.sourceLabel) {
                            <span class="src">{{ row.sourceLabel }}</span>
                          }
                          @if (row.inactive) {
                            <span class="src warn-src"
                              >не буде надіслано</span
                            >
                          }
                        </dd>
                      </div>
                    }
                  </dl>
                </article>
              }
              @if (store.submitError(); as err) {
                <div
                  #submitErrorEl
                  class="banner conflict"
                  tabindex="-1"
                  role="alert"
                >
                  {{ err }}
                </div>
              }
            </div>
          } @else {
            @if (activeSchemaStep(); as step) {
              <div class="fields">
                @for (block of fieldBlocks(); track block.track) {
                  @if (block.kind === 'group') {
                    <fieldset class="field-group">
                      @if (block.label) {
                        <legend>{{ block.label }}</legend>
                      }
                      <div
                        class="group-body"
                        [class.row]="block.layout === 'row'"
                      >
                        @for (field of block.fields; track field.key) {
                          @if (field.valueType === 'contacts_bundle') {
                            <loom-questionnaire-contacts-bundle-field
                              [answers]="store.answers()"
                              [profileMirror]="store.profileMirror()"
                              [employeeId]="store.assignment()?.employeeId ?? null"
                              [editable]="store.editable() && !store.conflict()"
                              (bundleChange)="onContactsBundleChange($event)"
                            />
                          } @else if (field.valueType === 'position_skills_matrix') {
                            <loom-questionnaire-skills-matrix-field
                              [value]="fieldValue(field.key)"
                              [availableSkills]="contextSkills()"
                              [desiredExtraCodes]="desiredExtraSkillCodes()"
                              [contextVersion]="
                                store.assignment()?.context?.version ?? null
                              "
                              [disabled]="!store.editable() || !!store.conflict()"
                              (matrixChange)="onSkillsMatrixChange(field.key, $event)"
                              (desiredExtraCodesChange)="onDesiredExtrasChange($event)"
                            />
                          } @else {
                            <loom-questionnaire-field-host
                              [field]="field"
                              [value]="fieldValue(field.key)"
                              [answers]="store.answers()"
                              [profileMirror]="store.profileMirror()"
                              [disabled]="!store.editable() || !!store.conflict()"
                              [error]="fieldError(field.key)"
                              (valueChange)="onFieldChange(field.key, $event)"
                              (answersPatch)="onAnswersPatch($event)"
                            />
                          }
                        }
                      </div>
                    </fieldset>
                  } @else if (block.field.valueType === 'contacts_bundle') {
                    <loom-questionnaire-contacts-bundle-field
                      [answers]="store.answers()"
                      [profileMirror]="store.profileMirror()"
                      [employeeId]="store.assignment()?.employeeId ?? null"
                      [editable]="store.editable() && !store.conflict()"
                      (bundleChange)="onContactsBundleChange($event)"
                    />
                  } @else if (block.field.valueType === 'position_skills_matrix') {
                    <loom-questionnaire-skills-matrix-field
                      [value]="fieldValue(block.field.key)"
                      [availableSkills]="contextSkills()"
                      [desiredExtraCodes]="desiredExtraSkillCodes()"
                      [contextVersion]="
                        store.assignment()?.context?.version ?? null
                      "
                      [disabled]="!store.editable() || !!store.conflict()"
                      (matrixChange)="onSkillsMatrixChange(block.field.key, $event)"
                      (desiredExtraCodesChange)="onDesiredExtrasChange($event)"
                    />
                  } @else {
                    <loom-questionnaire-field-host
                      [field]="block.field"
                      [value]="fieldValue(block.field.key)"
                      [answers]="store.answers()"
                      [profileMirror]="store.profileMirror()"
                      [disabled]="!store.editable() || !!store.conflict()"
                      [error]="fieldError(block.field.key)"
                      (valueChange)="onFieldChange(block.field.key, $event)"
                      (answersPatch)="onAnswersPatch($event)"
                    />
                  }
                }
                @if (blockingErrors().length) {
                  <div class="errors" role="alert">
                    <p>Виправте обовʼязкові поля:</p>
                    <ul>
                      @for (e of blockingErrors(); track e.fieldKey) {
                        <li>
                          <button
                            type="button"
                            class="linkish"
                            (click)="focusField(e.fieldKey)"
                          >
                            {{ e.message }}
                          </button>
                        </li>
                      }
                    </ul>
                  </div>
                }
              </div>
            }
          }
        </section>
      </div>

      <footer class="footer">
        <button
          type="button"
          class="btn"
          [disabled]="!canBack()"
          (click)="back()"
        >
          Назад
        </button>
        <div class="footer-right">
          @if (store.activeStepKey() !== reviewKey) {
            <button
              type="button"
              class="btn primary"
              [disabled]="!canNext()"
              (click)="next()"
            >
              Далі
            </button>
          } @else if (showReviewSubmit()) {
            <button
              type="button"
              class="btn primary"
              [disabled]="!canSubmit()"
              (click)="submit()"
            >
              {{
                store.submitState() === 'submitting'
                  ? 'Надсилання…'
                  : 'Надіслати'
              }}
            </button>
          }
        </div>
      </footer>
    </div>
  `,
  styles: [
    `
      .wizard {
        --q-panel-border: 1.5px solid var(--pw-border-strong);
        --q-panel-bg: var(--pw-surface);
        --q-panel-bg-alt: var(--pw-surface-2);
        --q-input-border: 1.5px solid var(--pw-border-strong);
        --q-input-bg: var(--pw-input-bg, var(--pw-surface));
        --q-divider: 1.5px solid var(--pw-border-strong);
        --q-row-border: 1.5px dashed var(--pw-border-strong);
        display: flex;
        flex-direction: column;
        min-height: calc(100dvh - 5.5rem);
        min-height: calc(100vh - 5.5rem);
        gap: 0.75rem;
        position: relative;
      }
      html[data-theme='dark'] .wizard {
        --q-panel-border: 1.5px solid #64748b;
        --q-panel-bg: #1a2438;
        --q-panel-bg-alt: #121c2e;
        --q-input-border: 1.5px solid #64748b;
        --q-input-bg: #0a101c;
        --q-divider: 1.5px solid #64748b;
        --q-row-border: 1.5px dashed #64748b;
      }
      .wizard .viewport {
        padding-bottom: 5.5rem;
      }
      .top {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: center;
        padding: 0.35rem 0 0.5rem;
        border-bottom: var(--q-divider);
        flex: 0 0 auto;
      }
      .muted {
        margin: 0;
        color: var(--pw-muted);
      }
      .save-slot {
        margin-left: auto;
      }
      .read-only-row {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 0.35rem 0.75rem;
      }
      .read-only-hint {
        margin: 0;
        color: var(--pw-muted);
        font-size: 0.9rem;
      }
      .body {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1rem;
        align-items: start;
        flex: 1 1 auto;
        min-height: 0;
      }
      .viewport {
        display: grid;
        gap: 1rem;
        min-width: 0;
      }
      .fields {
        display: grid;
        gap: 1rem;
      }
      .footer {
        position: sticky;
        bottom: 0;
        z-index: 2;
        flex: 0 0 auto;
        margin-top: auto;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.75rem 0 calc(0.75rem + env(safe-area-inset-bottom));
        background: var(--pw-bg, #f6f8fb);
        border-top: var(--q-divider);
      }
      .footer-right {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        margin-left: auto;
      }
      .btn {
        min-height: 44px;
        min-width: 44px;
        padding: 0.45rem 0.9rem;
        border-radius: 8px;
        border: var(--q-panel-border);
        background: var(--q-panel-bg);
        background: var(--pw-surface);
        cursor: pointer;
        color: inherit;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .btn.primary {
        background: var(--pw-accent);
        border-color: var(--pw-accent);
        color: #fff;
      }
      .btn.ghost {
        background: transparent;
      }
      .btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .banner {
        border-radius: 10px;
        padding: 0.75rem;
        border: var(--q-panel-border);
        background: var(--q-panel-bg);
        color: var(--pw-text, inherit);
        display: grid;
        gap: 0.4rem;
        flex: 0 0 auto;
      }
      .banner.conflict {
        border-color: #f04438;
        background: #fef3f2;
        color: #7a271a;
      }
      html[data-theme='dark'] .wizard .banner.conflict {
        background: color-mix(in srgb, #f04438 28%, #1a2438);
        border-color: #f97066;
        color: #fecaca;
      }
      .banner.review {
        background: color-mix(in srgb, #b45309 12%, var(--pw-surface));
        border-color: color-mix(in srgb, #b45309 45%, var(--pw-border));
        color: var(--pw-text, inherit);
      }
      html[data-theme='dark'] .wizard .banner.review {
        background: color-mix(in srgb, #b45309 22%, #1a2438);
        border-color: #f59e0b;
        color: #fde68a;
      }
      .errors,
      .warnings {
        border-radius: 10px;
        padding: 0.75rem;
        border: 1px solid #f04438;
        background: #fef3f2;
        color: #7a271a;
        display: grid;
        gap: 0.35rem;
      }
      .warnings {
        border-color: #f59e0b;
        background: #fffbeb;
        color: #92400e;
      }
      html[data-theme='dark'] .wizard .errors {
        background: color-mix(in srgb, #f04438 28%, #1a2438);
        border-color: #f97066;
        color: #fecaca;
      }
      html[data-theme='dark'] .wizard .warnings {
        background: color-mix(in srgb, #f59e0b 22%, #1a2438);
        border-color: #fbbf24;
        color: #fde68a;
      }
      .errors p,
      .warnings p,
      .errors ul,
      .warnings ul {
        margin: 0;
      }
      .errors .linkish,
      .warnings .linkish {
        color: inherit;
        text-decoration: underline;
      }
      .resolve-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.25rem;
      }
      .btn.danger {
        background: transparent;
        border-color: color-mix(in srgb, #b42318 55%, var(--pw-border));
        color: #b42318;
      }
      .warn {
        margin: 0;
        color: inherit;
        font-size: 0.9rem;
        opacity: 0.95;
      }
      .review-block {
        border: var(--q-panel-border);
        background: var(--q-panel-bg);
        border-radius: 10px;
        padding: 0.75rem;
      }
      .review-block h3 {
        margin: 0 0 0.5rem;
      }
      dl {
        margin: 0;
        display: grid;
        gap: 0.35rem;
      }
      .dl-row {
        display: grid;
        grid-template-columns: minmax(8rem, 40%) 1fr;
        gap: 0.5rem;
        padding: 0.45rem 0.55rem;
        border: var(--q-panel-border);
        border-radius: 8px;
        background: var(--q-panel-bg-alt);
      }
      .dl-row.inactive {
        opacity: 0.75;
      }
      .src {
        display: block;
        color: var(--pw-muted);
        font-size: 0.8rem;
      }
      .warn-src {
        color: #b42318;
      }
      .field-group {
        border: var(--q-panel-border);
        background: var(--q-panel-bg);
        border-radius: 10px;
        padding: 0.75rem;
        margin: 0;
        display: grid;
        gap: 0.75rem;
      }
      .group-body {
        display: grid;
        gap: 0.75rem;
      }
      .group-body.row {
        grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      }
      dt {
        color: var(--pw-muted);
      }
      dd {
        margin: 0;
      }
      .linkish {
        background: none;
        border: none;
        color: var(--pw-accent);
        cursor: pointer;
        text-align: left;
        padding: 0;
        text-decoration: underline;
      }
      @media (max-width: 800px) {
        .dl-row {
          grid-template-columns: 1fr;
          gap: 0.15rem 0.5rem;
        }
        .footer .btn {
          flex: 1 1 auto;
          min-width: 0;
        }
      }
      @media (max-width: 480px) {
        .top {
          gap: 0.5rem;
        }
        .save-slot {
          margin-left: 0;
        }
        .group-body.row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class QuestionnaireWizardShellComponent {
  readonly store = inject(QuestionnaireDraftStore);
  private readonly autosave = inject(QuestionnaireAutosaveCoordinator);
  readonly revision = inject(QuestionnaireRevisionCoordinator);
  private readonly api = inject(QuestionnairesApiService);
  private readonly orgCatalogApi = inject(OrganizationCatalogApiService);
  private readonly router = inject(Router);

  readonly resolveBusy = input(false);
  readonly navigationComplete = output<void>();
  readonly resolveCompleted = output<void>();
  readonly resolveDeclined = output<void>();

  readonly introKey = QUESTIONNAIRE_INTRO_STEP;
  readonly reviewKey = QUESTIONNAIRE_REVIEW_STEP;

  isPostSubmitLocked(): boolean {
    const status = this.store.assignmentStatus();
    return !!status && isQuestionnairePostSubmitStatus(status);
  }

  /** Pending questionnaire extras synced via sync-position-context (not null ratings). */
  readonly desiredExtraSkillCodes = signal<string[]>([]);
  readonly orgCatalog = signal<OrganizationCatalogSnapshot | null>(null);
  private orgCatalogRequested = false;

  private readonly loadOrgCatalog = effect(() => {
    if (this.orgCatalogRequested) return;
    this.orgCatalogRequested = true;
    this.orgCatalogApi.getSnapshot().subscribe({
      next: (snap) => this.orgCatalog.set(snap),
      error: () => this.orgCatalog.set(null),
    });
  });

  /** Reset desired extras whenever assignment/context is loaded or synced. */
  private readonly syncDesiredExtrasFromAssignment = effect(() => {
    const skills =
      this.store.assignment()?.context?.positionCatalog?.skills ?? [];
    this.desiredExtraSkillCodes.set(
      skills
        .filter((s) => s.source === 'questionnaire_extra')
        .map((s) => s.code),
    );
  });

  @ViewChild('submitErrorEl') submitErrorEl?: ElementRef<HTMLElement>;

  readonly activeSchemaStep = computed(() => {
    const key = this.store.activeStepKey();
    return this.store.schemaSteps().find((s) => s.key === key) ?? null;
  });

  readonly recommendedWarnings = computed(() =>
    this.store.allIssues().filter((i) => i.severity === 'warning'),
  );

  readonly inactiveWarnings = computed(() => {
    const schema = {
      code: 'x',
      version: 1,
      title: '',
      steps: this.store.schemaSteps(),
    };
    const keys = listInactiveOwnAnswers(schema, this.store.answers());
    const byKey = fieldsByKey(schema);
    return keys.map((k) => byKey.get(k)?.label ?? k);
  });

  readonly blockingErrors = computed(() =>
    this.store.currentStepIssues().filter((i) => i.severity === 'error'),
  );

  readonly fieldBlocks = computed(() => {
    const step = this.activeSchemaStep();
    if (!step) return [] as FieldBlock[];
    const visible = visibleFieldsForStep(step, this.store.answers());
    return buildFieldBlocks(visible);
  });

  /** Frozen position skills for matrix rows; `null` → full registry (legacy). */
  readonly contextSkills = computed((): MatrixAvailableSkill[] | null => {
    const context = this.store.assignment()?.context ?? null;
    if (context == null) return null;
    return context.positionCatalog.skills.map((s) => ({
      code: s.code,
      labelUa: s.labelUa,
      group: s.group,
      skillId: s.skillId,
      targetLevel: s.targetLevel,
      scaleKind: s.scaleKind,
      scaleMin: s.scaleMin,
      scaleMax: s.scaleMax,
      source: s.source,
    }));
  });

  saveStatusText(): string {
    const flash = this.revision.manualSaveMessage();
    if (flash) return flash;
    if (this.revision.manualSaveBusy()) return 'Збереження…';
    if (this.store.autosaveBlocked()) return 'Збереження призупинено (конфлікт)';
    switch (this.store.saveState()) {
      case 'dirty':
        return 'Є незбережені зміни';
      case 'saving':
        return 'Збереження…';
      case 'saved':
        return 'Збережено';
      case 'error':
        return this.store.saveError() ?? 'Помилка збереження';
      default:
        return 'Чернетка';
    }
  }

  saveStatusVisual():
    | 'idle'
    | 'dirty'
    | 'saving'
    | 'saved'
    | 'error'
    | 'blocked' {
    const flash = this.revision.manualSaveMessage();
    if (flash === 'Збережено' || flash === 'Уже збережено') {
      return 'saved';
    }
    if (this.revision.manualSaveBusy()) return 'saving';
    if (this.store.autosaveBlocked()) return 'blocked';
    if (this.store.submitState() === 'submitting') return 'saving';
    if (this.store.submitState() === 'error') return 'error';
    switch (this.store.saveState()) {
      case 'dirty':
        return 'dirty';
      case 'saving':
        return 'saving';
      case 'saved':
        return 'saved';
      case 'error':
        return 'error';
      default:
        return 'idle';
    }
  }

  isRevisionEdit(): boolean {
    return this.revision.isRevisionEdit();
  }

  showReviewSubmit(): boolean {
    return shouldShowReviewSubmit({
      stepKey: this.store.activeStepKey(),
      editable: this.store.editable(),
    });
  }

  fieldValue(fieldKey: string): unknown {
    const byKey = fieldsByKey({
      code: 'x',
      version: 1,
      title: '',
      steps: this.store.schemaSteps(),
    });
    const field = byKey.get(fieldKey);
    if (!field) return undefined;
    return resolveQuestionnaireFieldDisplay(field, {
      answers: this.store.answers(),
      profileMirror: this.store.profileMirror(),
      fieldsByKey: byKey,
    }).value;
  }

  fieldError(fieldKey: string): string | null {
    const byKey = fieldsByKey({
      code: 'x',
      version: 1,
      title: '',
      steps: this.store.schemaSteps(),
    });
    const field = byKey.get(fieldKey);
    if (!field) return null;
    const value = resolveQuestionnaireFieldDisplay(field, {
      answers: this.store.answers(),
      profileMirror: this.store.profileMirror(),
      fieldsByKey: byKey,
    }).value;
    const issue = validateFieldValue(field, value);
    return issue?.severity === 'error' ? issue.message : null;
  }

  onFieldChange(fieldKey: string, value: unknown): void {
    this.store.setAnswer(fieldKey, value);
    if ((ORG_SYNC_KEYS as readonly string[]).includes(fieldKey)) {
      void this.patchThenSyncPositionContext();
      return;
    }
    this.autosave.scheduleSave();
  }

  onAnswersPatch(patch: Record<string, string | null>): void {
    this.store.setAnswersPatch(patch);
    if (
      (ORG_SYNC_KEYS as readonly string[]).some((key) =>
        Object.prototype.hasOwnProperty.call(patch, key),
      )
    ) {
      void this.patchThenSyncPositionContext();
      return;
    }
    this.autosave.scheduleSave();
  }

  onContactsBundleChange(value: unknown): void {
    this.store.setAnswer('contacts.bundle', value);
    this.autosave.scheduleSave();
  }

  onDesiredExtrasChange(codes: string[]): void {
    this.desiredExtraSkillCodes.set(codes);
    void this.patchThenSyncPositionContext();
  }

  onSkillsMatrixChange(
    fieldKey: string,
    value: PositionSkillsMatrixAnswer,
  ): void {
    this.store.setAnswer(fieldKey, pruneUnratedMatrixRatings(value));
    this.autosave.scheduleSave();
  }

  /**
   * Flush draft PATCH, then POST sync-position-context and apply detail.
   */
  private async patchThenSyncPositionContext(): Promise<void> {
    if (!this.store.editable() || this.store.conflict()) return;

    // Draft org empty but freeze has org → seed first. Otherwise sync would
    // replace a captured skill matrix with an empty catalog.
    this.seedDraftOrgFromContextIfEmpty();

    const flushed = await this.autosave.flush();
    if (!flushed) return;

    const detail = this.store.assignment();
    if (!detail) return;
    if (detail.templateType !== 'managing') return;

    try {
      const synced = await firstValueFrom(
        this.api.syncPositionContext(detail.id, {
          expectedDraftRevision: this.store.revision(),
          desiredExtraSkillCodes: this.desiredExtraSkillCodes(),
        }),
      );
      this.store.applyPositionContextSync(synced);
      this.syncDesiredExtrasFromContext(synced);
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ||
        'Не вдалося синхронізувати контекст посади';
      this.store.applySaveError(this.store.getGeneration(), message);
      this.store.markDirtyIfNeeded();
    }
  }

  private seedDraftOrgFromContextIfEmpty(): void {
    const detail = this.store.assignment();
    const catalog = detail?.context?.positionCatalog;
    if (!catalog) return;
    const answers = this.store.answers();
    const draftEmpty = ORG_SYNC_KEYS.every((key) => {
      const v = answers[key];
      return v == null || v === '';
    });
    const contextHasOrg =
      catalog.directionId != null ||
      catalog.departmentId != null ||
      catalog.positionId != null;
    if (!draftEmpty || !contextHasOrg) return;
    this.store.setAnswersPatch({
      'company_work.direction_id': catalog.directionId,
      'company_work.department_id': catalog.departmentId,
      'company_work.position_id': catalog.positionId,
    });
  }

  private syncDesiredExtrasFromContext(detail: {
    context?: {
      positionCatalog?: {
        skills?: Array<{ code: string; source?: string }>;
      };
    } | null;
  }): void {
    const skills = detail.context?.positionCatalog?.skills ?? [];
    this.desiredExtraSkillCodes.set(
      skills
        .filter((s) => s.source === 'questionnaire_extra')
        .map((s) => s.code),
    );
  }

  reviewRows(stepKey: string) {
    const step = this.store.schemaSteps().find((s) => s.key === stepKey);
    if (!step) return [];
    const labelByCode = this.skillLabelByCode();
    const reviewContext = this.reviewContext();
    const historical =
      !this.store.editable() &&
      (this.store.assignment()?.submissions.length ?? 0) > 0;
    return reviewRowsForStep(
      step,
      this.store.answers(),
      this.store.profileMirror(),
      this.store.schemaSteps(),
      {
        skillLabelByCode: labelByCode
          ? (code) => labelByCode.get(code) ?? code
          : undefined,
        contextVersion: reviewContext?.version ?? null,
        contextSkills: reviewContext?.positionCatalog.skills ?? null,
        historicalContext: historical ? reviewContext : null,
        liveCatalog: this.orgCatalog(),
        reviewMode: historical ? 'historical' : 'draft',
      },
    );
  }

  private reviewContext() {
    const detail = this.store.assignment();
    if (!detail) return null;
    if (!this.store.editable() && detail.submissions.length > 0) {
      return detail.submissions[0]?.context ?? null;
    }
    return detail.context ?? null;
  }

  /**
   * Draft / editable Review → assignment.context.
   * Read-only historical (has submissions, not editable) → latest submission.context when set.
   */
  private skillLabelByCode(): Map<string, string> | null {
    const detail = this.store.assignment();
    if (!detail) return null;
    if (!this.store.editable() && detail.submissions.length > 0) {
      const skills = detail.submissions[0]?.context?.positionCatalog?.skills ?? null;
      if (skills == null) return null;
      return new Map(skills.map((s) => [s.code, s.labelUa]));
    }
    const skills = detail.context?.positionCatalog?.skills ?? null;
    if (skills == null) return null;
    return new Map(skills.map((s) => [s.code, s.labelUa]));
  }

  canBack(): boolean {
    return this.store.activeStepKey() !== QUESTIONNAIRE_INTRO_STEP;
  }

  canNext(): boolean {
    const key = this.store.activeStepKey();
    if (key === QUESTIONNAIRE_REVIEW_STEP) return false;
    const mode = resolveQuestionnaireNavigationMode({
      editable: this.store.editable(),
    });
    if (mode === 'free_read_only') return true;
    if (key === QUESTIONNAIRE_INTRO_STEP) return true;
    return this.store.isCurrentStepRequiredValid();
  }

  canSubmit(): boolean {
    if (this.isRevisionEdit()) return this.revision.canResubmit();
    if (!this.store.editable()) return false;
    if (this.store.conflict()) return false;
    if (this.store.submitState() === 'submitting') return false;
    if (!this.store.assignment()?.capabilities?.canSubmit) return false;
    return this.store.allRequiredValid();
  }

  async back(): Promise<void> {
    const order = this.stepOrder();
    const idx = order.indexOf(this.store.activeStepKey());
    if (idx <= 0) return;
    await this.navigateTo(order[idx - 1]!);
  }

  async next(): Promise<void> {
    if (!this.canNext()) return;
    const order = this.stepOrder();
    const idx = order.indexOf(this.store.activeStepKey());
    if (idx < 0 || idx >= order.length - 1) return;
    await this.navigateTo(order[idx + 1]!);
  }

  acceptServer(): void {
    this.store.acceptServerConflict();
  }

  focusField(fieldKey: string): void {
    const topLevelKey = fieldKey.replace(/\[.*$/, '');
    const step = this.store
      .schemaSteps()
      .find((s) => s.fields.some((f) => f.key === topLevelKey));
    if (!step) return;

    const focusInDom = (): void => {
      const el = document.querySelector(
        `[data-field-key="${CSS.escape(topLevelKey)}"]`,
      ) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusable = el?.querySelector(
        'input, textarea, button, select',
      ) as HTMLElement | null;
      focusable?.focus();
    };

    if (this.store.activeStepKey() === step.key) {
      focusInDom();
      return;
    }

    void this.navigateTo(step.key, { emitNavigationComplete: false }).then(
      () => {
        // Wait for step template to render field hosts.
        requestAnimationFrame(() => {
          requestAnimationFrame(focusInDom);
        });
      },
    );
  }

  async submit(): Promise<void> {
    if (this.isRevisionEdit()) {
      await this.resubmitAndClose();
      return;
    }
    if (!this.canSubmit()) return;
    if (!this.store.beginSubmit()) return;

    this.store.materializeMirrorIntoProposalAnswers();
    const flushed = await this.autosave.flush();
    if (!flushed) {
      this.store.finishSubmitError(
        this.store.saveError() ?? 'Не вдалося зберегти чернетку перед надсиланням',
      );
      queueMicrotask(() => this.submitErrorEl?.nativeElement.focus());
      return;
    }

    // Managing: freeze context ≡ draft org (canonical parents) before submit.
    if (this.store.assignment()?.templateType === 'managing') {
      await this.patchThenSyncPositionContext();
      if (this.store.saveState() === 'error') {
        this.store.finishSubmitError(
          this.store.saveError() ??
            'Не вдалося синхронізувати посаду перед надсиланням',
        );
        queueMicrotask(() => this.submitErrorEl?.nativeElement.focus());
        return;
      }
    }

    const id = this.store.assignment()?.id;
    if (!id) {
      this.store.finishSubmitError('Немає assignment');
      return;
    }

    try {
      await firstValueFrom(this.api.submit(id));
      this.store.clearSubmittingKeepAnswers();
      const employeeId = this.store.assignment()?.employeeId;
      if (employeeId) {
        await this.router.navigate(['/people', employeeId], {
          queryParams: { tab: 'questionnaires' },
        });
      } else {
        await this.router.navigateByUrl('/people');
      }
    } catch (err: unknown) {
      this.store.finishSubmitError(
        (err as { error?: { message?: string } })?.error?.message ||
          'Не вдалося надіслати анкету',
      );
      queueMicrotask(() => this.submitErrorEl?.nativeElement.focus());
    }
  }

  async resubmitAndClose(): Promise<void> {
    try {
      await this.revision.resubmitAndClose();
    } catch {
      queueMicrotask(() => this.submitErrorEl?.nativeElement.focus());
    }
  }

  private stepOrder(): string[] {
    return [
      QUESTIONNAIRE_INTRO_STEP,
      ...this.store.schemaSteps().map((s) => s.key),
      QUESTIONNAIRE_REVIEW_STEP,
    ];
  }

  private async navigateTo(
    stepKey: string,
    opts?: { emitNavigationComplete?: boolean },
  ): Promise<void> {
    await this.autosave.flush();
    this.store.setActiveStep(stepKey);
    if (opts?.emitNavigationComplete === false) return;
    queueMicrotask(() => this.navigationComplete.emit());
  }
}

type FieldBlock =
  | {
      kind: 'group';
      track: string;
      label?: string;
      layout?: 'row' | 'stack';
      fields: QuestionnaireSchemaField[];
    }
  | {
      kind: 'single';
      track: string;
      field: QuestionnaireSchemaField;
    };

function buildFieldBlocks(fields: QuestionnaireSchemaField[]): FieldBlock[] {
  const blocks: FieldBlock[] = [];
  let i = 0;
  while (i < fields.length) {
    const field = fields[i]!;
    if (!field.uiGroup) {
      blocks.push({ kind: 'single', track: field.key, field });
      i += 1;
      continue;
    }
    const groupKey = field.uiGroup;
    const groupFields: QuestionnaireSchemaField[] = [];
    while (i < fields.length && fields[i]!.uiGroup === groupKey) {
      groupFields.push(fields[i]!);
      i += 1;
    }
    blocks.push({
      kind: 'group',
      track: `g:${groupKey}`,
      label: groupFields[0]?.uiGroupLabel,
      layout: groupFields[0]?.uiLayout,
      fields: groupFields,
    });
  }
  return blocks;
}
