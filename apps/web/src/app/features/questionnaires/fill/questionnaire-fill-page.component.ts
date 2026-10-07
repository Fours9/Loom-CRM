import { Location } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import type { QuestionnaireProfileProposalItem } from '@loom/contracts-questionnaires';
import { isQuestionnairePostSubmitStatus } from '@loom/contracts-questionnaires';
import { QuestionnaireProfileMirrorService } from '../core/questionnaire-profile-mirror.service';
import { QuestionnairesApiService } from '../core/questionnaires-api.service';
import {
  buildQuestionnaireAssignmentLink,
  parseQuestionnaireStepQuery,
} from '../navigation/questionnaire-navigation';
import { QUESTIONNAIRE_INTRO_STEP } from '../navigation/questionnaire-step-keys';
import { canBrowseQuestionnaireStep } from '../navigation/questionnaire-step-browse';
import { QuestionnaireAutosaveCoordinator } from './questionnaire-autosave.coordinator';
import { QuestionnaireDraftStore } from './questionnaire-draft.store';
import { QuestionnaireFillChromeComponent } from './questionnaire-fill-chrome.component';
import { QuestionnaireRevisionCoordinator } from './questionnaire-revision.coordinator';
import { QuestionnaireWizardShellComponent } from './questionnaire-wizard-shell.component';
import {
  proposalCanAccept,
  proposalCanReject,
  proposalChangeSummary,
  proposalChangeTitle,
} from '../questionnaire-proposal-labels';

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
    QuestionnaireFillChromeComponent,
  ],
  providers: [
    QuestionnaireDraftStore,
    QuestionnaireAutosaveCoordinator,
    QuestionnaireRevisionCoordinator,
    QuestionnaireProfileMirrorService,
  ],
  template: `
    <div class="page" [class.pw-stage]="store.loadState() === 'ready'">
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
          <span class="pw-stage__glow" aria-hidden="true"></span>
          <loom-questionnaire-fill-chrome
            [actionBusy]="actionBusy()"
            (back)="goBack()"
            (edit)="onEditClick()"
            (requestChanges)="requestChanges($event)"
            (saveAndClose)="saveAndClose()"
            (deleteAssignment)="deleteAssignment()"
            (saveDraft)="saveChanges()"
            (stepSelect)="goToStep($event)"
            (sectionSelect)="goToSection($event)"
          />

          @switch (store.uiMode()) {
            @case ('owner_only') {
              <article class="state">
                <p>Анкета доступна лише працівнику</p>
              </article>
            }
            @case ('unavailable') {
              <article class="state">
                <p class="muted">Анкету закрито. Редагування неможливе.</p>
              </article>
            }
            @default {
              @if (store.assignmentStatus() === 'cancelled') {
                <div class="note" role="status">
                  Анкету відкріплено. Відповіді доступні лише для перегляду.
                </div>
              }
              @if (store.assignmentStatus() === 'closed') {
                <div class="note" role="status">
                  Анкету закрито. Відповіді доступні лише для перегляду.
                </div>
              }
              @if (actionError()) {
                <p class="error">{{ actionError() }}</p>
              }
              <loom-questionnaire-wizard-shell
                [resolveBusy]="actionBusy()"
                (navigationComplete)="focusRailHeading()"
                (resolveCompleted)="resolveChangesCompleted()"
                (resolveDeclined)="resolveChangesDeclined()"
              />

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
                          @if (
                            p.status === 'pending' &&
                            (canAcceptProposal(p) || canRejectProposal(p))
                          ) {
                            <div class="prop-actions">
                              @if (canAcceptProposal(p)) {
                                <button
                                  type="button"
                                  class="btn primary"
                                  [disabled]="actionBusy()"
                                  (click)="acceptProposal(p.id)"
                                >
                                  Прийняти
                                </button>
                              }
                              @if (canRejectProposal(p)) {
                                <button
                                  type="button"
                                  class="btn"
                                  [disabled]="actionBusy()"
                                  (click)="rejectProposal(p.id)"
                                >
                                  Відхилити
                                </button>
                              }
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
        padding: 0.55rem 0.75rem;
        border-radius: 8px;
        border: 1px solid #f04438;
        background: #fef3f2;
        color: #7a271a;
      }
      :host-context(html[data-theme='dark']) .error {
        background: color-mix(in srgb, #f04438 28%, #1a2438);
        border-color: #f97066;
        color: #fecaca;
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
        .prop-actions .btn {
          flex: 1;
        }
      }
      @media (min-width: 1100px) {
        .page {
          --page-pad-x: 2rem;
          max-width: 1200px;
          gap: 1rem;
        }
      }
    `,
  ],
})
export class QuestionnaireFillPageComponent implements OnInit, OnDestroy {
  readonly store = inject(QuestionnaireDraftStore);
  private readonly autosave = inject(QuestionnaireAutosaveCoordinator);
  readonly revision = inject(QuestionnaireRevisionCoordinator);
  private readonly api = inject(QuestionnairesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private sub?: Subscription;

  @ViewChild(QuestionnaireFillChromeComponent)
  private chrome?: QuestionnaireFillChromeComponent;

  readonly actionBusy = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly assignmentProposals = signal<QuestionnaireProfileProposalItem[]>([]);
  readonly proposalsLoading = signal(false);

  private readonly proposalsReload = effect(() => {
    const detail = this.store.assignment();
    const status = detail?.status;
    if (
      !detail ||
      !detail.employeeId ||
      !status ||
      !isQuestionnairePostSubmitStatus(status) ||
      this.store.loadState() !== 'ready'
    ) {
      this.assignmentProposals.set([]);
      return;
    }
    void this.reloadProposals(detail.employeeId, detail.id);
  });

  showProposalsSection(): boolean {
    const status = this.store.assignmentStatus();
    return !!status && isQuestionnairePostSubmitStatus(status);
  }

  goToSection(sectionId: string): void {
    const section = this.chrome?.sectionById(sectionId);
    if (!section) return;
    const active = this.store.activeStepKey();
    if (section.steps.some((s) => s.key === active)) return;
    const target =
      section.steps.find((s) =>
        canBrowseQuestionnaireStep(s.key, {
          editable: this.store.editable(),
          schemaSteps: this.store.schemaSteps(),
          completedStepKeys: this.store.completedSteps(),
        }),
      ) ?? section.steps[0];
    if (target) void this.goToStep(target.key);
  }

  async goToStep(stepKey: string): Promise<void> {
    if (
      !canBrowseQuestionnaireStep(stepKey, {
        editable: this.store.editable(),
        schemaSteps: this.store.schemaSteps(),
        completedStepKeys: this.store.completedSteps(),
      })
    ) {
      return;
    }
    if (this.store.activeStepKey() === stepKey) return;
    await this.autosave.flush();
    this.store.setActiveStep(stepKey);
    queueMicrotask(() => this.focusRailHeading());
  }

  focusRailHeading(): void {
    this.chrome?.focusHeading();
  }

  proposalStatusLabel(status: string): string {
    return PROPOSAL_STATUS_LABELS[status] ?? status;
  }

  proposalLabel(p: QuestionnaireProfileProposalItem): string {
    return proposalChangeTitle(p);
  }

  formatChange(p: QuestionnaireProfileProposalItem): string {
    return proposalChangeSummary(p);
  }

  canAcceptProposal(p: QuestionnaireProfileProposalItem): boolean {
    return proposalCanAccept(p);
  }

  canRejectProposal(p: QuestionnaireProfileProposalItem): boolean {
    return proposalCanReject(p);
  }

  async acceptProposal(id: string): Promise<void> {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    this.actionError.set(null);
    try {
      await firstValueFrom(this.api.acceptProposal(id));
      const detail = this.store.assignment();
      const employeeId = detail?.employeeId;
      if (detail && employeeId) await this.reloadProposals(employeeId, detail.id);
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
      const employeeId = detail?.employeeId;
      if (detail && employeeId) await this.reloadProposals(employeeId, detail.id);
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
      this.assignmentProposals.set(
        res.items.filter(
          (p) => p.assignmentId === assignmentId && p.status === 'pending',
        ),
      );
    } catch {
      this.assignmentProposals.set([]);
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
      this.revision.manualSaveBusy() ||
      !this.revision.canResubmit()
    ) {
      return;
    }
    this.actionError.set(null);
    try {
      await this.revision.resubmitAndClose();
    } catch (err: unknown) {
      this.actionError.set(
        (err as { error?: { message?: string } })?.error?.message ||
          this.store.submitError() ||
          'Не вдалося зберегти анкету',
      );
    }
  }

  async saveChanges(): Promise<void> {
    if (this.actionBusy() || this.revision.manualSaveBusy()) return;
    if (this.store.conflict()) return;
    this.actionError.set(null);
    const result = await this.revision.saveDraftWithFeedback();
    if (result === 'failed') {
      this.actionError.set(
        this.revision.manualSaveError() ?? 'Не вдалося зберегти зміни',
      );
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
        isQuestionnairePostSubmitStatus(detail.status) &&
        (caps?.canReopenSelf || caps?.canStartRevision);

      if (needsRevisionStart) {
        if (caps?.canStartRevision && !caps.canReopenSelf) {
          await this.revision.startRevision();
        } else {
          await this.revision.reopenSelf();
        }
      }
      this.store.beginEditSession();
      this.store.setActiveStep(QUESTIONNAIRE_INTRO_STEP);
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

  async requestChanges(reviewComment: string): Promise<void> {
    const detail = this.store.assignment();
    const submissionId = detail?.submissions?.[0]?.id;
    if (!detail || !submissionId || this.actionBusy()) return;
    this.actionBusy.set(true);
    this.actionError.set(null);
    try {
      await firstValueFrom(
        this.api.reviewSubmission(submissionId, {
          reviewStatus: 'changes_requested',
          reviewComment,
        }),
      );
      this.chrome?.markRequestChangesSuccess();
      this.autosave.resetForAssignmentSwitch();
      await this.store.load(detail.id, this.store.activeStepKey());
      this.syncStepQuery(this.store.activeStepKey());
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ||
        'Не вдалося запросити зміни';
      this.actionError.set(message);
      this.chrome?.markRequestChangesError(message);
    } finally {
      this.actionBusy.set(false);
    }
  }

  async resolveChangesCompleted(): Promise<void> {
    const detail = this.store.assignment();
    if (!detail || this.actionBusy()) return;
    this.actionBusy.set(true);
    this.actionError.set(null);
    try {
      await this.autosave.flush();
      await firstValueFrom(
        this.api.resolveChanges(detail.id, {
          outcome: 'completed',
          expectedDraftRevision: this.store.revision(),
        }),
      );
      this.autosave.resetForAssignmentSwitch();
      await this.store.load(detail.id, this.store.activeStepKey());
      this.store.endEditSession();
      this.syncStepQuery(this.store.activeStepKey());
    } catch (err: unknown) {
      const conflict = (err as { status?: number; error?: { message?: string } });
      this.actionError.set(
        conflict?.error?.message ||
          (conflict?.status === 409
            ? 'Чернетку змінено. Оновіть дані й спробуйте знову.'
            : 'Не вдалося підтвердити виконання правок'),
      );
    } finally {
      this.actionBusy.set(false);
    }
  }

  async resolveChangesDeclined(): Promise<void> {
    const detail = this.store.assignment();
    if (!detail || this.actionBusy()) return;
    if (!confirm('Відмовити в правках і повернути анкету на перевірку?')) {
      return;
    }
    this.actionBusy.set(true);
    this.actionError.set(null);
    try {
      await firstValueFrom(
        this.api.resolveChanges(detail.id, { outcome: 'declined' }),
      );
      this.autosave.resetForAssignmentSwitch();
      await this.store.load(detail.id, this.store.activeStepKey());
      this.store.endEditSession();
      this.syncStepQuery(this.store.activeStepKey());
    } catch (err: unknown) {
      this.actionError.set(
        (err as { error?: { message?: string } })?.error?.message ||
          'Не вдалося відмовити в правках',
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
