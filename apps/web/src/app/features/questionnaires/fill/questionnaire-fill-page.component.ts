import { Location } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import type { QuestionnaireProfileProposalItem } from '@loom/contracts-questionnaires';
import { QuestionnaireProfileMirrorService } from '../core/questionnaire-profile-mirror.service';
import { QuestionnairesApiService } from '../core/questionnaires-api.service';
import {
  buildQuestionnaireAssignmentLink,
  parseQuestionnaireStepQuery,
} from '../navigation/questionnaire-navigation';
import { ThemeService } from '../../../core/theme/theme.service';
import { QuestionnaireAutosaveCoordinator } from './questionnaire-autosave.coordinator';
import { QuestionnaireDraftStore } from './questionnaire-draft.store';
import { QuestionnaireRevisionCoordinator } from './questionnaire-revision.coordinator';
import { QuestionnaireWizardShellComponent } from './questionnaire-wizard-shell.component';
import { QuestionnaireSectionRailComponent } from './progress/questionnaire-section-rail.component';
import { buildProgressSections } from './progress/questionnaire-section-map';
import {
  QUESTIONNAIRE_INTRO_STEP,
  QUESTIONNAIRE_REVIEW_STEP,
} from '../navigation/questionnaire-step-keys';
import { isSchemaStepReachable } from '../navigation/resolve-active-step';
import {
  isQuestionnaireStepBrowsable,
  resolveQuestionnaireNavigationMode,
} from '../navigation/questionnaire-navigation-mode';

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  pending: 'Очікує',
  accepted: 'Прийнято',
  rejected: 'Відхилено',
};

@Component({
  selector: 'loom-questionnaire-fill-page',
  standalone: true,
  imports: [
    RouterLink,
    QuestionnaireWizardShellComponent,
    QuestionnaireSectionRailComponent,
  ],
  providers: [
    QuestionnaireDraftStore,
    QuestionnaireAutosaveCoordinator,
    QuestionnaireRevisionCoordinator,
    QuestionnaireProfileMirrorService,
  ],
  template: `
    <div class="page">
      @switch (store.loadState()) {
        @case ('loading') {
          <p class="muted">Завантаження анкети…</p>
        }
        @case ('not_found') {
          <article class="state">
            <h1>Анкету не знайдено</h1>
            <p class="muted">{{ store.loadError() }}</p>
            <a class="btn" routerLink="/questionnaires">До списку анкет</a>
          </article>
        }
        @case ('error') {
          <article class="state">
            <h1>Помилка</h1>
            <p class="error">{{ store.loadError() }}</p>
            <a class="btn" routerLink="/questionnaires">До списку анкет</a>
          </article>
        }
        @case ('ready') {
          <header class="step-topbar">
            <button
              type="button"
              class="icon-back"
              title="Назад"
              aria-label="Повернутися назад"
              (click)="goBack()"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
                />
              </svg>
              <span class="back-label">Назад</span>
            </button>
            <div class="chrome-titles">
              <h2>{{ store.pageTitle() }}</h2>
              <p class="code-line">
                Код:
                <code>{{ store.assignment()?.templateCode }}</code>
              </p>
            </div>
            <div class="step-topbar-actions">
              <button
                type="button"
                class="theme-toggle"
                (click)="theme.toggle()"
                [attr.aria-label]="
                  theme.mode() === 'dark' ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'
                "
                [title]="theme.mode() === 'dark' ? 'Темна тема' : 'Світла тема'"
              >
                @if (theme.mode() === 'dark') {
                  <span aria-hidden="true">☾</span>
                  <span class="theme-label">Темна</span>
                } @else {
                  <span aria-hidden="true">☀</span>
                  <span class="theme-label">Світла</span>
                }
              </button>
              @if (store.canShowRequestChangesButton()) {
                <button
                  type="button"
                  class="btn"
                  [disabled]="actionBusy()"
                  (click)="requestChanges()"
                >
                  {{ actionBusy() ? 'Запит…' : 'Запросити зміни' }}
                </button>
              }
              @if (store.canShowEditButton()) {
                <button
                  type="button"
                  class="btn primary"
                  [disabled]="actionBusy()"
                  (click)="onEditClick()"
                >
                  {{ actionBusy() ? 'Відкриття…' : 'Редагувати' }}
                </button>
              }
              @if (store.editable() && revision.isRevisionEdit()) {
                <button
                  type="button"
                  class="btn primary"
                  [disabled]="actionBusy() || saveChangesBusy() || !revision.canResubmit()"
                  [attr.aria-busy]="saveChangesBusy()"
                  (click)="saveAndClose()"
                >
                  {{
                    saveChangesBusy()
                      ? 'Збереження…'
                      : 'Зберегти і закрити'
                  }}
                </button>
              }
              @if (store.canShowDeleteButton()) {
                <button
                  type="button"
                  class="btn danger"
                  [disabled]="actionBusy() || saveChangesBusy()"
                  (click)="deleteAssignment()"
                >
                  {{ actionBusy() ? 'Видалення…' : 'Видалити анкету' }}
                </button>
              }
            </div>
          </header>
          <header class="page-chrome">
            <div class="step-main">
              <loom-questionnaire-section-rail
                [schemaSteps]="store.schemaSteps()"
                [activeStepKey]="store.activeStepKey()"
                [completedStepKeys]="store.completedSteps()"
                [canOpenStep]="canOpenRailStep"
                [canOpenSection]="canOpenRailSection"
                (stepSelect)="goToStep($event)"
                (sectionSelect)="goToSection($event)"
              />
            </div>
            <div class="chrome-actions">
              @if (store.editable() && !revision.isRevisionEdit()) {
                <button
                  type="button"
                  class="btn primary"
                  [disabled]="actionBusy() || saveChangesBusy() || store.saveState() === 'saving'"
                  [attr.aria-busy]="saveChangesBusy() || store.saveState() === 'saving'"
                  (click)="saveChanges()"
                >
                  {{
                    saveChangesBusy() || store.saveState() === 'saving'
                      ? 'Збереження…'
                      : 'Зберегти зміни'
                  }}
                </button>
              }
            </div>
          </header>

          @switch (store.uiMode()) {
            @case ('owner_only') {
              <article class="state">
                <p>Анкета доступна лише працівнику</p>
              </article>
            }
            @case ('unavailable') {
              <article class="state">
                <p class="muted">
                  @if (store.assignmentStatus() === 'closed') {
                    Анкету закрито. Редагування неможливе.
                  } @else {
                    Призначення відкріплено.
                  }
                </p>
              </article>
            }
            @default {
              @if (store.isAdminDetachedEdit()) {
                <div class="note" role="status">
                  Відкріплено — редагує адміністратор. Після «Зберегти і закрити»
                  анкета лишається відкріпленою, доки її не відновлять.
                </div>
              }
              @if (actionError()) {
                <p class="error">{{ actionError() }}</p>
              }
              <loom-questionnaire-wizard-shell />

              @if (showProposalsSection()) {
                <section class="proposals" aria-label="Пропозиції до профілю">
                  <h2>Запропоновані зміни до профілю</h2>
                  @if (proposalsLoading()) {
                    <p class="muted">Завантаження пропозицій…</p>
                  } @else if (!assignmentProposals().length) {
                    <p class="muted">
                      Немає пропозицій: у відповідях немає змін до полів профілю
                      (або вони збігаються з поточним профілем).
                    </p>
                  } @else {
                    <ul class="prop-list">
                      @for (p of assignmentProposals(); track p.id) {
                        <li class="prop-card">
                          <div class="prop-main">
                            <strong>{{ proposalLabel(p) }}</strong>
                            <span class="badge">{{
                              proposalStatusLabel(p.status)
                            }}</span>
                          </div>
                          <p class="meta">{{ formatChange(p) }}</p>
                          @if (canApplyProposals() && p.status === 'pending') {
                            <div class="prop-actions">
                              <button
                                type="button"
                                class="btn primary"
                                [disabled]="actionBusy()"
                                (click)="acceptProposal(p.id)"
                              >
                                Прийняти
                              </button>
                              <button
                                type="button"
                                class="btn"
                                [disabled]="actionBusy()"
                                (click)="rejectProposal(p.id)"
                              >
                                Відхилити
                              </button>
                            </div>
                          }
                        </li>
                      }
                    </ul>
                  }
                </section>
              }
            }
          }
        }
      }
    </div>
  `,
  styles: [
    `
      .page {
        --page-pad-x: clamp(0.75rem, 2.5vw, 2rem);
        box-sizing: border-box;
        width: 100%;
        max-width: 1120px;
        margin: 0 auto;
        padding: 0 var(--page-pad-x) calc(1.5rem + env(safe-area-inset-bottom, 0px));
        display: grid;
        gap: 0.85rem;
        overflow-x: clip;
      }
      .step-topbar {
        position: sticky;
        top: 0;
        z-index: 5;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 0.65rem 1rem;
        align-items: center;
        margin-inline: calc(-1 * var(--page-pad-x));
        padding: max(0.65rem, env(safe-area-inset-top, 0px)) var(--page-pad-x) 0.75rem;
        border-bottom: 2px solid color-mix(in srgb, var(--pw-border) 80%, #64748b);
        background: var(--pw-bg, #f6f8fb);
      }
      .step-topbar-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: flex-end;
        align-items: center;
      }
      .theme-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        font-weight: 600;
        width: 2.75rem;
        min-width: 2.75rem;
        height: 2.75rem;
        min-height: 2.75rem;
        padding: 0;
        border: 1px solid var(--pw-border-strong);
        background: var(--pw-surface);
        color: var(--pw-text);
        border-radius: 8px;
        cursor: pointer;
      }
      .theme-label {
        display: none;
      }
      .page-chrome {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 0.75rem 1rem;
        align-items: center;
        padding: 0.35rem 0 0.15rem;
      }
      .step-main {
        min-width: 0;
      }
      .icon-back {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        min-width: 2.75rem;
        height: 2.75rem;
        min-height: 2.75rem;
        padding: 0 0.75rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border-strong);
        background: var(--pw-surface);
        color: var(--pw-text);
        font-weight: 600;
        cursor: pointer;
      }
      .icon-back:hover {
        border-color: var(--pw-accent);
        color: var(--pw-accent);
        background: color-mix(in srgb, var(--pw-accent) 12%, var(--pw-surface));
      }
      .icon-back svg {
        display: block;
        flex-shrink: 0;
      }
      .back-label {
        line-height: 1;
      }
      .chrome-titles {
        min-width: 0;
        display: grid;
        gap: 0.15rem;
      }
      .chrome-titles h2 {
        margin: 0;
        font-size: clamp(1rem, 1.2vw + 0.75rem, 1.2rem);
        line-height: 1.3;
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .code-line {
        margin: 0;
        color: var(--pw-muted);
        font-size: 0.9rem;
      }
      .code-line code {
        font-size: 0.9rem;
        color: inherit;
        overflow-wrap: anywhere;
      }
      .chrome-actions {
        justify-self: end;
        align-self: center;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: flex-end;
      }
      .state {
        display: grid;
        gap: 0.75rem;
        padding: 1rem;
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        background: var(--pw-surface);
      }
      .note {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem;
        padding: 0.65rem 0;
        border-bottom: 1px solid var(--pw-border);
        font-size: 0.95rem;
      }
      .muted {
        margin: 0;
        color: var(--pw-muted);
      }
      .error {
        margin: 0;
        color: #b42318;
      }
      .btn {
        display: inline-flex;
        width: fit-content;
        min-height: 2.75rem;
        align-items: center;
        justify-content: center;
        padding: 0.45rem 0.8rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        background: var(--pw-surface);
        text-decoration: none;
        color: inherit;
        cursor: pointer;
        text-align: center;
      }
      .btn.primary {
        background: var(--pw-accent);
        border-color: var(--pw-accent);
        color: #fff;
      }
      .btn.danger {
        color: #b42318;
        border-color: color-mix(in srgb, #b42318 40%, var(--pw-border));
        background: color-mix(in srgb, #b42318 8%, var(--pw-surface));
      }
      .btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .proposals {
        display: grid;
        gap: 0.65rem;
        padding-top: 0.5rem;
        border-top: 1px solid var(--pw-border);
      }
      .proposals h2 {
        margin: 0;
        font-size: 1.1rem;
      }
      .prop-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.5rem;
      }
      .prop-card {
        display: grid;
        gap: 0.35rem;
        padding: 0.7rem 0.8rem;
        border: 1px solid var(--pw-border);
        border-radius: 10px;
        background: var(--pw-surface);
      }
      .prop-main {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      }
      .badge {
        border: 1px solid var(--pw-border);
        border-radius: 999px;
        padding: 0.1rem 0.55rem;
        font-size: 0.8rem;
      }
      .meta {
        margin: 0;
        color: var(--pw-muted);
        font-size: 0.9rem;
        word-break: break-word;
      }
      .prop-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
      }
      @media (max-width: 640px) {
        .page {
          --page-pad-x: 0.75rem;
          gap: 0.7rem;
        }
        .step-topbar {
          grid-template-columns: auto minmax(0, 1fr);
          align-items: start;
        }
        .step-topbar-actions {
          grid-column: 1 / -1;
          width: 100%;
          justify-content: stretch;
        }
        .step-topbar-actions .btn {
          flex: 1 1 calc(50% - 0.25rem);
          min-width: 0;
        }
        .step-topbar-actions .theme-toggle {
          flex: 0 0 auto;
        }
        .page-chrome {
          grid-template-columns: 1fr;
          gap: 0.65rem;
        }
        .chrome-actions {
          justify-self: stretch;
        }
        .chrome-actions .btn {
          flex: 1;
          width: 100%;
        }
        .icon-back {
          padding: 0 0.65rem;
        }
        .prop-actions .btn {
          flex: 1;
        }
      }
      @media (min-width: 641px) {
        .theme-label {
          display: inline;
        }
        .theme-toggle {
          width: auto;
          min-width: auto;
          height: auto;
          padding: 0.4rem 0.75rem;
        }
      }
      @media (min-width: 1100px) {
        .page {
          --page-pad-x: 2rem;
          max-width: 1200px;
          gap: 1rem;
        }
        .chrome-titles h2 {
          font-size: 1.2rem;
        }
      }
    `,
  ],
})
export class QuestionnaireFillPageComponent implements OnInit, OnDestroy {
  readonly store = inject(QuestionnaireDraftStore);
  private readonly autosave = inject(QuestionnaireAutosaveCoordinator);
  readonly revision = inject(QuestionnaireRevisionCoordinator);
  readonly theme = inject(ThemeService);
  private readonly api = inject(QuestionnairesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private sub?: Subscription;

  readonly actionBusy = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly saveChangesBusy = signal(false);
  readonly assignmentProposals = signal<QuestionnaireProfileProposalItem[]>([]);
  readonly canApplyProposals = signal(false);
  readonly proposalsLoading = signal(false);

  private readonly proposalsReload = effect(() => {
    const detail = this.store.assignment();
    const status = detail?.status;
    if (
      !detail ||
      (status !== 'submitted' && status !== 'reviewed') ||
      this.store.loadState() !== 'ready'
    ) {
      this.assignmentProposals.set([]);
      return;
    }
    void this.reloadProposals(detail.employeeId, detail.id);
  });

  showProposalsSection(): boolean {
    const status = this.store.assignmentStatus();
    return status === 'submitted' || status === 'reviewed';
  }

  readonly canOpenRailStep = (stepKey: string): boolean =>
    this.canBrowseStepKey(stepKey);

  readonly canOpenRailSection = (sectionId: string): boolean => {
    const section = buildProgressSections(this.store.schemaSteps()).find(
      (s) => s.id === sectionId,
    );
    if (!section) return false;
    return section.steps.some((s) => this.canBrowseStepKey(s.key));
  };

  goToSection(sectionId: string): void {
    const section = buildProgressSections(this.store.schemaSteps()).find(
      (s) => s.id === sectionId,
    );
    if (!section) return;
    const active = this.store.activeStepKey();
    if (section.steps.some((s) => s.key === active)) return;
    const target =
      section.steps.find((s) => this.canBrowseStepKey(s.key)) ?? section.steps[0];
    if (target) void this.goToStep(target.key);
  }

  async goToStep(stepKey: string): Promise<void> {
    if (!this.canBrowseStepKey(stepKey)) return;
    if (this.store.activeStepKey() === stepKey) return;
    await this.autosave.flush();
    this.store.setActiveStep(stepKey);
    queueMicrotask(() => {
      document
        .querySelector<HTMLElement>('.step-main h1, .rail h1')
        ?.focus({ preventScroll: true });
    });
  }

  private canBrowseStepKey(stepKey: string): boolean {
    const mode = resolveQuestionnaireNavigationMode({
      editable: this.store.editable(),
    });
    if (stepKey === QUESTIONNAIRE_INTRO_STEP) {
      return isQuestionnaireStepBrowsable({ mode, linearReachable: true });
    }
    if (stepKey === QUESTIONNAIRE_REVIEW_STEP) {
      const steps = this.store.schemaSteps();
      const reachable =
        !steps.length ||
        steps.every((s) => this.store.completedSteps().has(s.key));
      return isQuestionnaireStepBrowsable({
        mode,
        linearReachable: reachable,
      });
    }
    return isQuestionnaireStepBrowsable({
      mode,
      linearReachable: isSchemaStepReachable(
        stepKey,
        this.store.schemaSteps(),
        this.store.completedSteps(),
      ),
    });
  }

  proposalStatusLabel(status: string): string {
    return PROPOSAL_STATUS_LABELS[status] ?? status;
  }

  proposalLabel(p: QuestionnaireProfileProposalItem): string {
    const c = p.proposedChanges as { answerKey?: string; field?: string };
    return c.answerKey || c.field || p.targetSection;
  }

  formatChange(p: QuestionnaireProfileProposalItem): string {
    const c = p.proposedChanges as { from?: unknown; to?: unknown };
    return `${JSON.stringify(c.from ?? null)} → ${JSON.stringify(c.to ?? null)}`;
  }

  async acceptProposal(id: string): Promise<void> {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    this.actionError.set(null);
    try {
      await firstValueFrom(this.api.acceptProposal(id));
      const detail = this.store.assignment();
      if (detail) await this.reloadProposals(detail.employeeId, detail.id);
    } catch (err: unknown) {
      this.actionError.set(
        (err as { error?: { message?: string } })?.error?.message ||
          'Не вдалося прийняти пропозицію',
      );
    } finally {
      this.actionBusy.set(false);
    }
  }

  async rejectProposal(id: string): Promise<void> {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    this.actionError.set(null);
    try {
      await firstValueFrom(this.api.rejectProposal(id));
      const detail = this.store.assignment();
      if (detail) await this.reloadProposals(detail.employeeId, detail.id);
    } catch (err: unknown) {
      this.actionError.set(
        (err as { error?: { message?: string } })?.error?.message ||
          'Не вдалося відхилити пропозицію',
      );
    } finally {
      this.actionBusy.set(false);
    }
  }

  private async reloadProposals(
    employeeId: string,
    assignmentId: string,
  ): Promise<void> {
    this.proposalsLoading.set(true);
    try {
      const res = await firstValueFrom(this.api.listProposals(employeeId));
      this.canApplyProposals.set(res.capabilities.canApply);
      this.assignmentProposals.set(
        res.items.filter(
          (p) => p.assignmentId === assignmentId && p.status === 'pending',
        ),
      );
    } catch {
      this.assignmentProposals.set([]);
      this.canApplyProposals.set(false);
    } finally {
      this.proposalsLoading.set(false);
    }
  }

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id')?.trim() ?? '';
      const step = parseQuestionnaireStepQuery(this.route.snapshot.queryParamMap);
      void this.loadAssignment(id, step);
    });

    this.route.queryParamMap.subscribe((q) => {
      if (this.store.loadState() !== 'ready') return;
      const step = parseQuestionnaireStepQuery(q);
      this.store.applyRequestedStep(step);
      this.syncStepQuery(this.store.activeStepKey());
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.autosave.resetForAssignmentSwitch();
    this.store.clear();
  }

  goBack(): void {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
      return;
    }
    void this.router.navigateByUrl('/questionnaires');
  }

  async saveAndClose(): Promise<void> {
    if (
      this.actionBusy() ||
      this.saveChangesBusy() ||
      !this.revision.canResubmit()
    ) {
      return;
    }
    this.saveChangesBusy.set(true);
    this.actionError.set(null);
    try {
      await this.revision.resubmitAndClose();
    } catch (err: unknown) {
      this.actionError.set(
        (err as { error?: { message?: string } })?.error?.message ||
          this.store.submitError() ||
          'Не вдалося зберегти анкету',
      );
    } finally {
      this.saveChangesBusy.set(false);
    }
  }

  async saveChanges(): Promise<void> {
    if (this.actionBusy() || this.saveChangesBusy()) return;
    if (this.store.saveState() === 'saving' || this.store.conflict()) return;
    this.saveChangesBusy.set(true);
    this.actionError.set(null);
    try {
      this.store.materializeMirrorIntoProposalAnswers();
      const ok = await this.autosave.flush();
      if (!ok) {
        this.actionError.set(
          this.store.saveError() ?? 'Не вдалося зберегти зміни',
        );
      }
    } catch (err: unknown) {
      this.actionError.set(
        (err as { error?: { message?: string } })?.error?.message ||
          'Не вдалося зберегти зміни',
      );
    } finally {
      this.saveChangesBusy.set(false);
    }
  }

  async deleteAssignment(): Promise<void> {
    const detail = this.store.assignment();
    if (!detail || this.actionBusy()) return;
    if (
      !window.confirm(
        'Видалити анкету без можливості відновлення? Буде видалено чернетку, усі подання та пропозиції. Уже застосовані до профілю зміни не скасовуються.',
      )
    ) {
      return;
    }
    this.actionBusy.set(true);
    this.actionError.set(null);
    try {
      await firstValueFrom(this.api.deleteAssignment(detail.id));
      const employeeId = detail.employeeId;
      await this.router.navigateByUrl(
        employeeId ? `/people/${employeeId}` : '/questionnaires',
      );
    } catch (err: unknown) {
      this.actionError.set(
        (err as { error?: { message?: string } })?.error?.message ||
          'Не вдалося видалити анкету',
      );
    } finally {
      this.actionBusy.set(false);
    }
  }

  async onEditClick(): Promise<void> {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    this.actionError.set(null);
    try {
      const detail = this.store.assignment();
      const caps = detail?.capabilities;
      const needsRevisionStart =
        detail &&
        (detail.status === 'submitted' || detail.status === 'reviewed') &&
        (caps?.canReopenSelf || caps?.canStartRevision);

      if (needsRevisionStart) {
        if (caps?.canStartRevision && !caps.canReopenSelf) {
          await this.revision.startRevision();
        } else {
          await this.revision.reopenSelf();
        }
      }
      this.store.beginEditSession();
      this.syncStepQuery(this.store.activeStepKey());
    } catch (err: unknown) {
      this.actionError.set(
        (err as { error?: { message?: string } })?.error?.message ||
          'Не вдалося відкрити анкету для редагування',
      );
    } finally {
      this.actionBusy.set(false);
    }
  }

  async requestChanges(): Promise<void> {
    const id = this.store.assignment()?.id;
    if (!id || this.actionBusy()) return;
    this.actionBusy.set(true);
    this.actionError.set(null);
    try {
      await firstValueFrom(
        this.api.requestChanges(id, {
          reviewComment: 'Потрібні зміни',
        }),
      );
      this.autosave.resetForAssignmentSwitch();
      await this.store.load(id, this.store.activeStepKey());
      this.store.beginEditSession();
      this.syncStepQuery(this.store.activeStepKey());
    } catch (err: unknown) {
      this.actionError.set(
        (err as { error?: { message?: string } })?.error?.message ||
          'Не вдалося запросити зміни',
      );
    } finally {
      this.actionBusy.set(false);
    }
  }

  private async loadAssignment(
    id: string,
    step: string | null,
  ): Promise<void> {
    this.autosave.resetForAssignmentSwitch();
    await this.store.load(id, step);
    if (this.store.loadState() === 'ready') {
      this.syncStepQuery(this.store.activeStepKey());
    }
  }

  private syncStepQuery(stepKey: string): void {
    const id = this.store.assignment()?.id;
    if (!id) return;
    const link = buildQuestionnaireAssignmentLink({
      assignmentId: id,
      stepKey,
    });
    void this.router.navigate([link.routerLink], {
      queryParams: link.queryParams,
      queryParamsHandling: '',
      replaceUrl: true,
    });
  }
}
