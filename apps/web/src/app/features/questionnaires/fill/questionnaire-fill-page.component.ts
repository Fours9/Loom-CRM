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
import { QuestionnaireAutosaveCoordinator } from './questionnaire-autosave.coordinator';
import { QuestionnaireDraftStore } from './questionnaire-draft.store';
import { QuestionnaireRevisionCoordinator } from './questionnaire-revision.coordinator';
import { QuestionnaireWizardShellComponent } from './questionnaire-wizard-shell.component';

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  pending: 'Очікує',
  accepted: 'Прийнято',
  rejected: 'Відхилено',
};

@Component({
  selector: 'loom-questionnaire-fill-page',
  standalone: true,
  imports: [RouterLink, QuestionnaireWizardShellComponent],
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
          <header class="page-chrome">
            <button
              type="button"
              class="icon-back"
              title="Назад"
              aria-label="Повернутися назад"
              (click)="goBack()"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
                />
              </svg>
            </button>
            <div class="chrome-titles">
              <h1>{{ store.assignment()?.templateTitle }}</h1>
              <p class="code-line">
                Код:
                <code>{{ store.assignment()?.templateCode }}</code>
              </p>
            </div>
            <div class="chrome-actions">
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
              @if (
                store.uiMode() === 'read_only' &&
                (store.assignmentStatus() === 'submitted' ||
                  store.assignmentStatus() === 'reviewed')
              ) {
                <div class="note muted">
                  @if (store.assignmentStatus() === 'submitted') {
                    Анкету надіслано. Перегляд відповідей.
                  } @else {
                    Анкету переглянуто. Перегляд відповідей.
                  }
                </div>
              }
              @if (actionError()) {
                <p class="error">{{ actionError() }}</p>
              }
              <loom-questionnaire-wizard-shell />

              @if (showProposalsSection()) {
                <section class="proposals" aria-label="Пропозиції до профілю">
                  <h2>Пропозиції до профілю</h2>
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
        max-width: 960px;
        margin: 0 auto;
        padding: 1rem 1rem 2rem;
        display: grid;
        gap: 0.85rem;
      }
      .page-chrome {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 0.75rem 1rem;
        align-items: start;
      }
      .icon-back {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.5rem;
        height: 2.5rem;
        margin-top: 0.1rem;
        border-radius: 10px;
        border: 1px solid var(--pw-border);
        background: var(--pw-surface);
        color: inherit;
        cursor: pointer;
      }
      .icon-back:hover {
        border-color: color-mix(in srgb, var(--pw-accent) 50%, var(--pw-border));
        color: var(--pw-accent);
      }
      .icon-back svg {
        width: 1.35rem;
        height: 1.35rem;
      }
      .chrome-titles {
        min-width: 0;
        display: grid;
        gap: 0.2rem;
      }
      .chrome-titles h1 {
        margin: 0;
        font-size: 1.35rem;
        line-height: 1.25;
      }
      .code-line {
        margin: 0;
        color: var(--pw-muted);
        font-size: 0.9rem;
      }
      .code-line code {
        font-size: 0.9rem;
        color: inherit;
      }
      .chrome-actions {
        justify-self: end;
        align-self: start;
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
        min-height: 44px;
        align-items: center;
        justify-content: center;
        padding: 0.45rem 0.8rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        background: var(--pw-surface);
        text-decoration: none;
        color: inherit;
        cursor: pointer;
      }
      .btn.primary {
        background: var(--pw-accent);
        border-color: var(--pw-accent);
        color: #fff;
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
        .page-chrome {
          grid-template-columns: auto 1fr;
        }
        .chrome-actions {
          grid-column: 1 / -1;
          justify-self: stretch;
        }
        .chrome-actions .btn {
          flex: 1;
        }
      }
    `,
  ],
})
export class QuestionnaireFillPageComponent implements OnInit, OnDestroy {
  readonly store = inject(QuestionnaireDraftStore);
  private readonly autosave = inject(QuestionnaireAutosaveCoordinator);
  private readonly revision = inject(QuestionnaireRevisionCoordinator);
  private readonly api = inject(QuestionnairesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private sub?: Subscription;

  readonly actionBusy = signal(false);
  readonly actionError = signal<string | null>(null);
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
