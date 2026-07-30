import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  QUESTIONNAIRE_INTRO_STEP,
  QUESTIONNAIRE_REVIEW_STEP,
} from '../navigation/questionnaire-step-keys';
import { isSchemaStepReachable } from '../navigation/resolve-active-step';
import {
  reviewRowsForStep,
  resolveStepUiState,
  visibleFieldsForStep,
} from './progress/questionnaire-progress';
import { QuestionnaireAutosaveCoordinator } from './questionnaire-autosave.coordinator';
import { QuestionnaireDraftStore } from './questionnaire-draft.store';
import { QuestionnaireFieldHostComponent } from './fields/questionnaire-field-host.component';
import { validateFieldValue } from './validation/questionnaire-validation';
import { QuestionnairesApiService } from '../core/questionnaires-api.service';
import { fieldsByKey, listInactiveOwnAnswers } from '@loom/questionnaire-schema';
import { resolveQuestionnaireFieldDisplay } from './display/questionnaire-display-value';
import type { QuestionnaireSchemaField } from '@loom/contracts-questionnaires';

@Component({
  selector: 'loom-questionnaire-wizard-shell',
  standalone: true,
  imports: [RouterLink, QuestionnaireFieldHostComponent],
  template: `
    <div class="wizard" [class.drawer-open]="drawerOpen()">
      <header class="top">
        <div class="top-main">
          <p class="eyebrow">Анкета</p>
          <h1 #stepHeading tabindex="-1">{{ heading() }}</h1>
          <p class="progress" aria-live="polite">
            Крок {{ stepIndexLabel() }} · {{ store.progress().percent }}%
          </p>
        </div>
        <div class="save" aria-live="polite">{{ saveStatusText() }}</div>
        <button
          type="button"
          class="btn ghost drawer-toggle"
          (click)="drawerOpen.set(!drawerOpen())"
        >
          Кроки
        </button>
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
        </div>
      }

      <div class="body">
        <nav class="stepper" [class.open]="drawerOpen()" aria-label="Кроки анкети">
          <ol>
            <li>
              <button
                type="button"
                class="step-btn"
                [attr.aria-current]="
                  store.activeStepKey() === introKey ? 'step' : null
                "
                (click)="go(introKey)"
              >
                Вступ
              </button>
            </li>
            @for (step of store.schemaSteps(); track step.key) {
              <li>
                <button
                  type="button"
                  class="step-btn"
                  [disabled]="!canOpenStep(step.key)"
                  [attr.aria-current]="
                    store.activeStepKey() === step.key ? 'step' : null
                  "
                  [attr.data-state]="stepState(step.key)"
                  (click)="go(step.key)"
                >
                  {{ step.label }}
                </button>
              </li>
            }
            <li>
              <button
                type="button"
                class="step-btn"
                [disabled]="!canOpenReview()"
                [attr.aria-current]="
                  store.activeStepKey() === reviewKey ? 'step' : null
                "
                (click)="go(reviewKey)"
              >
                Перегляд
              </button>
            </li>
          </ol>
        </nav>

        <section class="viewport">
          @if (store.activeStepKey() === introKey) {
            <div class="intro">
              <p>
                Заповніть анкету кроками. Чернетка зберігається автоматично.
                Після надсилання керівник зможе переглянути відповіді; зміни до
                профілю не застосуються автоматично.
              </p>
              <p class="muted">
                Рекомендовані поля не блокують перехід; обовʼязкові — блокують.
              </p>
            </div>
          } @else if (store.activeStepKey() === reviewKey) {
            <div class="review">
              <h2>Перевірте відповіді</h2>
              @if (recommendedWarnings().length) {
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
              @if (inactiveWarnings().length) {
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
                          <loom-questionnaire-field-host
                            [field]="field"
                            [value]="fieldValue(field.key)"
                            [disabled]="!store.editable() || !!store.conflict()"
                            [error]="fieldError(field.key)"
                            (valueChange)="onFieldChange(field.key, $event)"
                          />
                        }
                      </div>
                    </fieldset>
                  } @else {
                    <loom-questionnaire-field-host
                      [field]="block.field"
                      [value]="fieldValue(block.field.key)"
                      [disabled]="!store.editable() || !!store.conflict()"
                      [error]="fieldError(block.field.key)"
                      (valueChange)="onFieldChange(block.field.key, $event)"
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
          @if (store.editable() && !store.conflict()) {
            <button
              type="button"
              class="btn"
              [disabled]="store.saveState() === 'saving'"
              (click)="saveNow()"
            >
              Зберегти зараз
            </button>
          }
          @if (store.activeStepKey() !== reviewKey) {
            <button
              type="button"
              class="btn primary"
              [disabled]="!canNext()"
              (click)="next()"
            >
              Далі
            </button>
          } @else if (store.editable()) {
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

      @if (store.submitState() === 'success') {
        <div class="overlay success">
          <h2>Анкету надіслано</h2>
          <p>Дякуємо. Можна повернутися до профілю.</p>
          <a class="btn primary" routerLink="/people">До працівників</a>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .wizard {
        display: grid;
        grid-template-rows: auto auto 1fr auto;
        min-height: calc(100vh - 4rem);
        gap: 0.75rem;
        position: relative;
      }
      .top {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: flex-start;
        position: sticky;
        top: 0;
        z-index: 2;
        background: var(--pw-bg, #f6f8fb);
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--pw-border);
      }
      h1 {
        margin: 0;
        font-size: 1.35rem;
      }
      .eyebrow,
      .muted,
      .progress {
        margin: 0;
        color: var(--pw-muted);
      }
      .save {
        margin-left: auto;
        font-size: 0.9rem;
        color: var(--pw-muted);
      }
      .body {
        display: grid;
        grid-template-columns: minmax(12rem, 16rem) 1fr;
        gap: 1rem;
        align-items: start;
      }
      .stepper ol {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.35rem;
      }
      .step-btn {
        width: 100%;
        text-align: left;
        min-height: 44px;
        padding: 0.45rem 0.65rem;
        border-radius: 8px;
        border: 1px solid transparent;
        background: transparent;
        cursor: pointer;
        color: inherit;
      }
      .step-btn[aria-current='step'] {
        border-color: var(--pw-accent);
        background: var(--pw-accent-soft);
      }
      .step-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .viewport {
        display: grid;
        gap: 1rem;
        padding-bottom: 5.5rem;
      }
      .fields {
        display: grid;
        gap: 1rem;
      }
      .footer {
        position: sticky;
        bottom: 0;
        z-index: 2;
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.75rem 0 calc(0.75rem + env(safe-area-inset-bottom));
        background: var(--pw-bg, #f6f8fb);
        border-top: 1px solid var(--pw-border);
      }
      .footer-right {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .btn {
        min-height: 44px;
        min-width: 44px;
        padding: 0.45rem 0.9rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border);
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
        border: 1px solid var(--pw-border);
        display: grid;
        gap: 0.4rem;
      }
      .banner.conflict {
        border-color: #f04438;
        background: #fef3f2;
      }
      .banner.review {
        background: var(--pw-accent-soft);
      }
      .warn {
        margin: 0;
        color: #b42318;
        font-size: 0.9rem;
      }
      .review-block {
        border: 1px solid var(--pw-border);
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
        border: 1px solid var(--pw-border);
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
      .overlay.success {
        position: absolute;
        inset: 0;
        background: color-mix(in srgb, var(--pw-bg, #fff) 92%, transparent);
        display: grid;
        place-content: center;
        gap: 0.75rem;
        text-align: center;
      }
      .drawer-toggle {
        display: none;
      }
      @media (max-width: 800px) {
        .body {
          grid-template-columns: 1fr;
        }
        .drawer-toggle {
          display: inline-flex;
        }
        .stepper {
          display: none;
          position: fixed;
          inset: auto 0 4.5rem 0;
          max-height: 50vh;
          overflow: auto;
          background: var(--pw-surface);
          border-top: 1px solid var(--pw-border);
          padding: 0.75rem;
          z-index: 3;
        }
        .stepper.open {
          display: block;
        }
      }
    `,
  ],
})
export class QuestionnaireWizardShellComponent {
  readonly store = inject(QuestionnaireDraftStore);
  private readonly autosave = inject(QuestionnaireAutosaveCoordinator);
  private readonly api = inject(QuestionnairesApiService);

  readonly introKey = QUESTIONNAIRE_INTRO_STEP;
  readonly reviewKey = QUESTIONNAIRE_REVIEW_STEP;
  readonly drawerOpen = signal(false);

  @ViewChild('stepHeading') stepHeading?: ElementRef<HTMLElement>;
  @ViewChild('submitErrorEl') submitErrorEl?: ElementRef<HTMLElement>;

  readonly activeSchemaStep = computed(() => {
    const key = this.store.activeStepKey();
    return this.store.schemaSteps().find((s) => s.key === key) ?? null;
  });

  readonly heading = computed(() => {
    const key = this.store.activeStepKey();
    if (key === QUESTIONNAIRE_INTRO_STEP) return 'Вступ';
    if (key === QUESTIONNAIRE_REVIEW_STEP) return 'Перегляд і надсилання';
    return this.activeSchemaStep()?.label ?? this.store.assignment()?.templateTitle ?? 'Анкета';
  });

  readonly stepIndexLabel = computed(() => {
    const key = this.store.activeStepKey();
    const steps = this.store.schemaSteps();
    const total = steps.length + 2;
    if (key === QUESTIONNAIRE_INTRO_STEP) return `1 з ${total}`;
    if (key === QUESTIONNAIRE_REVIEW_STEP) return `${total} з ${total}`;
    const idx = steps.findIndex((s) => s.key === key);
    return `${idx + 2} з ${total}`;
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

  saveStatusText(): string {
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
    this.autosave.scheduleSave();
  }

  stepState(stepKey: string): string {
    return resolveStepUiState({
      stepKey,
      currentStepKey: this.store.activeStepKey(),
      schemaSteps: this.store.schemaSteps(),
      answers: this.store.answers(),
      profileMirror: this.store.profileMirror(),
    });
  }

  canOpenStep(stepKey: string): boolean {
    return isSchemaStepReachable(
      stepKey,
      this.store.schemaSteps(),
      this.store.completedSteps(),
    );
  }

  canOpenReview(): boolean {
    const steps = this.store.schemaSteps();
    if (!steps.length) return true;
    return steps.every((s) => this.store.completedSteps().has(s.key));
  }

  reviewRows(stepKey: string) {
    const step = this.store.schemaSteps().find((s) => s.key === stepKey);
    if (!step) return [];
    return reviewRowsForStep(
      step,
      this.store.answers(),
      this.store.profileMirror(),
      this.store.schemaSteps(),
    );
  }

  go(stepKey: string): void {
    this.drawerOpen.set(false);
    void this.navigateTo(stepKey);
  }

  canBack(): boolean {
    return this.store.activeStepKey() !== QUESTIONNAIRE_INTRO_STEP;
  }

  canNext(): boolean {
    const key = this.store.activeStepKey();
    if (key === QUESTIONNAIRE_REVIEW_STEP) return false;
    if (key === QUESTIONNAIRE_INTRO_STEP) return true;
    return this.store.isCurrentStepRequiredValid();
  }

  canSubmit(): boolean {
    if (!this.store.editable()) return false;
    if (this.store.conflict()) return false;
    if (this.store.submitState() === 'submitting') return false;
    if (!this.store.assignment()?.capabilities.canSubmit) return false;
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

  async saveNow(): Promise<void> {
    await this.autosave.flush();
  }

  acceptServer(): void {
    this.store.acceptServerConflict();
  }

  focusField(fieldKey: string): void {
    const el = document.querySelector(
      `[data-field-key="${CSS.escape(fieldKey)}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const focusable = el?.querySelector(
      'input, textarea, button, select',
    ) as HTMLElement | null;
    focusable?.focus();
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    if (!this.store.beginSubmit()) return;

    const flushed = await this.autosave.flush();
    if (!flushed) {
      this.store.finishSubmitError(
        this.store.saveError() ?? 'Не вдалося зберегти чернетку перед надсиланням',
      );
      queueMicrotask(() => this.submitErrorEl?.nativeElement.focus());
      return;
    }

    const id = this.store.assignment()?.id;
    if (!id) {
      this.store.finishSubmitError('Немає assignment');
      return;
    }

    try {
      await firstValueFrom(this.api.submit(id));
      this.store.finishSubmitSuccess();
    } catch (err: unknown) {
      this.store.finishSubmitError(
        (err as { error?: { message?: string } })?.error?.message ||
          'Не вдалося надіслати анкету',
      );
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

  private async navigateTo(stepKey: string): Promise<void> {
    await this.autosave.flush();
    this.store.setActiveStep(stepKey);
    queueMicrotask(() => this.stepHeading?.nativeElement.focus());
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
