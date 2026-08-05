import {
  Component,
  HostListener,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of, type Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type {
  QuestionnaireAssignmentListItem,
  QuestionnaireProfileProposalItem,
} from '@loom/contracts-questionnaires';
import { QuestionnairesApiService } from './core/questionnaires-api.service';
import { QuestionnaireSnapshotSummaryComponent } from './questionnaire-snapshot-summary.component';
import { buildQuestionnaireAssignmentLink } from './navigation/questionnaire-navigation';
import { QUESTIONNAIRE_INTRO_STEP } from './navigation/questionnaire-step-keys';
import {
  questionnaireStatusLabel,
  questionnaireTypeLabel,
} from './questionnaire-labels';
import { hasActiveReviewerRequest } from './core/questionnaire-active-change-request';

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  pending: 'Очікує',
  accepted: 'Прийнято',
  rejected: 'Відхилено',
};

@Component({
  selector: 'loom-employee-questionnaires-panel',
  standalone: true,
  imports: [QuestionnaireSnapshotSummaryComponent],
  template: `
    <div class="panel">
      <div class="toolbar">
        <h2>Анкети</h2>
        @if (canAssign()) {
          <button
            type="button"
            class="btn primary"
            [disabled]="assignBusy()"
            (click)="assign()"
          >
            {{ assignBusy() ? 'Призначення…' : 'Призначити анкету 360°' }}
          </button>
        }
      </div>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      @if (assignOk()) {
        <p class="ok">Анкету призначено</p>
      }

      @if (loading()) {
        <p class="muted">Завантаження…</p>
      } @else if (!items().length) {
        <p class="muted">Немає призначених анкет.</p>
      } @else {
        <ul class="list">
          @for (item of items(); track item.id) {
            <li class="card">
              <div class="card-row">
                <div class="card-main">
                  <strong>{{ item.templateTitle }}</strong>
                  @if (activeReviewerRequest(item)) {
                    <span
                      class="change-req-mark"
                      [attr.title]="
                        'Запрошено зміни: ' +
                        (item.latestSubmission?.reviewComment ?? '')
                      "
                      [attr.aria-label]="
                        'Запрошено зміни: ' +
                        (item.latestSubmission?.reviewComment ?? '')
                      "
                      >!</span
                    >
                  } @else if (item.status === 'changes_requested') {
                    <span
                      class="change-req-mark neutral"
                      title="Анкету відкрито для редагування"
                      aria-label="Анкету відкрито для редагування"
                      >!</span
                    >
                  }
                  <span class="badge type">{{ typeLabel(item.templateType) }}</span>
                  <span class="badge">{{ statusLabel(item.status) }}</span>
                  <span class="pct">{{ item.completionPercent }}%</span>
                </div>
                <div class="card-actions">
                  <button
                    type="button"
                    class="btn view"
                    (click)="openAssignment(item)"
                  >
                    {{
                      item.status === 'submitted' || item.status === 'reviewed'
                        ? 'Відкрити'
                        : item.status === 'changes_requested' ||
                            item.status === 'in_progress' ||
                            item.status === 'assigned'
                          ? 'Почати'
                          : 'Переглянути'
                    }}
                  </button>
                  <button
                    type="button"
                    class="btn view"
                    disabled
                    title="Незабаром"
                  >
                    Роздрукувати
                  </button>
                  @if (hasLifecycleMoreActions(item)) {
                    <div class="more-menu-wrap">
                      <button
                        type="button"
                        class="btn ghost more-btn"
                        title="Додаткові дії"
                        aria-label="Додаткові дії"
                        [attr.aria-expanded]="moreMenuAssignmentId() === item.id"
                        [attr.aria-haspopup]="'menu'"
                        [disabled]="busyAssignmentId() === item.id"
                        (click)="toggleMoreMenu(item.id, $event)"
                      >
                        <span class="more-icon" aria-hidden="true">⋮</span>
                      </button>
                      @if (moreMenuAssignmentId() === item.id) {
                        <div class="more-menu" role="menu">
                          @if (item.capabilities.canCancel) {
                            <button
                              type="button"
                              role="menuitem"
                              [disabled]="busyAssignmentId() === item.id"
                              (click)="cancelAssignmentFromMenu(item.id)"
                            >
                              Відкріпити
                            </button>
                          }
                          @if (item.capabilities.canClose) {
                            <button
                              type="button"
                              role="menuitem"
                              [disabled]="busyAssignmentId() === item.id"
                              (click)="closeAssignmentFromMenu(item.id)"
                            >
                              Закрити
                            </button>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>
              <div class="meta">
                @if (item.dueAt) {
                  <span>Термін: {{ formatDate(item.dueAt) }}</span>
                }
                <span>v{{ item.version }}</span>
              </div>

              <div class="subitems">
                @if (showProposedChanges(item)) {
                  <details class="fold">
                    <summary>
                      <span class="fold-title"
                        >Запропоновані зміни до профілю</span
                      >
                      @if (proposalsForAssignment(item.id).length; as count) {
                        <span class="fold-count">{{ count }}</span>
                      }
                    </summary>
                    <div class="fold-body">
                      @if (proposalsForAssignment(item.id); as props) {
                        @if (props.length) {
                          <ul class="prop-list">
                            @for (p of props; track p.id) {
                              <li class="prop-card">
                                <div class="card-main">
                                  <strong>{{ proposalLabel(p) }}</strong>
                                  <span class="badge">{{
                                    proposalStatusLabel(p.status)
                                  }}</span>
                                </div>
                                <div class="meta">
                                  <span>{{ formatChange(p) }}</span>
                                </div>
                                @if (canApply() && p.status === 'pending') {
                                  <div class="actions">
                                    <button
                                      type="button"
                                      class="btn primary"
                                      (click)="accept(p.id)"
                                    >
                                      Прийняти
                                    </button>
                                    <button
                                      type="button"
                                      class="btn ghost"
                                      (click)="reject(p.id)"
                                    >
                                      Відхилити
                                    </button>
                                  </div>
                                }
                              </li>
                            }
                          </ul>
                        } @else {
                          <p class="muted proposals-empty">
                            Немає запропонованих змін (відповіді збігаються з
                            профілем або поля профілю не змінювались).
                          </p>
                        }
                      }
                    </div>
                  </details>
                }

                <details
                  class="fold"
                  (toggle)="onSummaryToggle(item.id, $event)"
                >
                  <summary>
                    <span class="fold-title">Підсумок анкети</span>
                  </summary>
                  <div class="fold-body">
                    @if (summaryExpandedIds().has(item.id)) {
                      <loom-questionnaire-snapshot-summary
                        [employeeId]="employeeId"
                        [assignmentId]="item.id"
                      />
                    }
                  </div>
                </details>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      .panel {
        display: grid;
        gap: 1rem;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
      }
      h2,
      h3 {
        margin: 0;
      }
      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.85rem;
      }
      .card {
        border: 2px solid color-mix(in srgb, var(--pw-border) 85%, #64748b);
        border-radius: 12px;
        padding: 0.9rem 1rem;
        background: var(--pw-surface);
        display: grid;
        gap: 0.55rem;
        box-shadow: 0 1px 2px color-mix(in srgb, #0f172a 6%, transparent);
      }
      .card-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: center;
        justify-content: space-between;
      }
      .card-main {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
        min-width: 0;
        flex: 1 1 auto;
      }
      .card-main strong {
        font-size: 1.05rem;
      }
      .change-req-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.25rem;
        height: 1.25rem;
        border-radius: 999px;
        background: #f59e0b;
        color: #111827;
        font-weight: 800;
        font-size: 0.85rem;
        line-height: 1;
      }
      .change-req-mark.neutral {
        background: color-mix(in srgb, var(--pw-border) 70%, #94a3b8);
        color: var(--pw-text);
        font-weight: 600;
      }
      .badge {
        border: 1.5px solid var(--pw-border);
        border-radius: 999px;
        padding: 0.15rem 0.6rem;
        font-size: 0.8rem;
      }
      .badge.type {
        color: var(--pw-muted);
      }
      .pct {
        font-weight: 600;
        color: var(--pw-accent);
      }
      .card-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        align-items: center;
        justify-content: flex-end;
      }
      .btn.view {
        flex: 0 0 auto;
        white-space: nowrap;
      }
      .btn.danger {
        color: #b42318;
        border-color: color-mix(in srgb, #b42318 35%, var(--pw-border));
      }
      .more-menu-wrap {
        position: relative;
        display: inline-flex;
      }
      .more-btn {
        min-width: 2.4rem;
        padding: 0.35rem 0.45rem;
        line-height: 1;
      }
      .more-icon {
        display: block;
        font-size: 1.25rem;
        font-weight: 700;
        line-height: 1;
      }
      .more-menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        z-index: 30;
        min-width: 11rem;
        display: grid;
        padding: 0.3rem;
        background: var(--pw-surface, #fff);
        border: 1.5px solid var(--pw-border-strong, var(--pw-border));
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
      }
      .more-menu button {
        width: 100%;
        text-align: left;
        background: transparent;
        color: var(--pw-text);
        border: 0;
        border-radius: 6px;
        padding: 0.5rem 0.65rem;
        font-size: 0.9rem;
        cursor: pointer;
      }
      .more-menu button:hover:not(:disabled) {
        background: color-mix(in srgb, var(--pw-muted) 14%, transparent);
      }
      .more-menu button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        color: var(--pw-muted);
        font-size: 0.85rem;
      }
      .actions {
        display: flex;
        gap: 0.5rem;
      }
      .btn {
        border-radius: 8px;
        border: 1.5px solid var(--pw-border);
        padding: 0.4rem 0.75rem;
        background: var(--pw-surface);
        cursor: pointer;
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
        opacity: 0.6;
        cursor: not-allowed;
      }
      .muted {
        color: var(--pw-muted);
      }
      .error {
        color: #b42318;
      }
      .ok {
        color: #027a48;
      }
      .subitems {
        display: grid;
        gap: 0.5rem;
        margin-top: 0.25rem;
        padding: 0.65rem 0.7rem 0.7rem;
        border-radius: 10px;
        border: 2px solid color-mix(in srgb, var(--pw-border) 70%, #94a3b8);
        background: color-mix(in srgb, var(--pw-bg, #f6f8fb) 88%, #cbd5e1);
      }
      .fold {
        border-radius: 8px;
        border: 1.5px solid color-mix(in srgb, var(--pw-border) 75%, #64748b);
        background: var(--pw-surface);
        overflow: hidden;
      }
      .fold > summary {
        cursor: pointer;
        list-style: none;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        user-select: none;
        padding: 0.65rem 0.75rem;
        font-size: 0.95rem;
        font-weight: 600;
        color: inherit;
        background: color-mix(in srgb, var(--pw-surface) 92%, #e2e8f0);
      }
      .fold > summary:hover {
        background: color-mix(in srgb, var(--pw-accent) 8%, var(--pw-surface));
      }
      .fold > summary::-webkit-details-marker {
        display: none;
      }
      .fold > summary::before {
        content: '';
        width: 0.55rem;
        height: 0.55rem;
        flex: 0 0 auto;
        border-right: 2.5px solid var(--pw-muted);
        border-bottom: 2.5px solid var(--pw-muted);
        transform: rotate(-45deg);
        margin-top: -0.1rem;
        transition: transform 0.15s ease;
      }
      .fold[open] > summary::before {
        transform: rotate(45deg);
        margin-top: 0.05rem;
      }
      .fold-title {
        flex: 1 1 auto;
        min-width: 0;
      }
      .fold-count {
        flex: 0 0 auto;
        min-width: 1.4rem;
        text-align: center;
        border-radius: 999px;
        padding: 0.1rem 0.45rem;
        font-size: 0.78rem;
        font-weight: 700;
        color: #fff;
        background: var(--pw-accent);
      }
      .fold-body {
        padding: 0.65rem 0.75rem 0.75rem;
        border-top: 1.5px solid color-mix(in srgb, var(--pw-border) 80%, #94a3b8);
        display: grid;
        gap: 0.5rem;
      }
      .proposals-empty {
        margin: 0;
        font-size: 0.9rem;
      }
      .prop-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.5rem;
      }
      .prop-card {
        border: 1.5px solid var(--pw-border);
        border-radius: 8px;
        padding: 0.6rem 0.7rem;
        background: color-mix(in srgb, var(--pw-bg, #f6f8fb) 75%, transparent);
        display: grid;
        gap: 0.35rem;
      }
    `,
  ],
})
export class EmployeeQuestionnairesPanelComponent implements OnChanges {
  private readonly api = inject(QuestionnairesApiService);
  private readonly router = inject(Router);

  @Input({ required: true }) employeeId!: string;

  readonly loading = signal(false);
  readonly assignBusy = signal(false);
  readonly busyAssignmentId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly assignOk = signal(false);
  readonly items = signal<QuestionnaireAssignmentListItem[]>([]);
  readonly proposals = signal<QuestionnaireProfileProposalItem[]>([]);
  readonly canAssign = signal(false);
  readonly canApply = signal(false);
  readonly summaryExpandedIds = signal<ReadonlySet<string>>(new Set());
  readonly moreMenuAssignmentId = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['employeeId'] && this.employeeId) {
      this.summaryExpandedIds.set(new Set());
      this.moreMenuAssignmentId.set(null);
      this.reload();
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.moreMenuAssignmentId.set(null);
  }

  hasLifecycleMoreActions(item: QuestionnaireAssignmentListItem): boolean {
    return item.capabilities.canCancel || item.capabilities.canClose;
  }

  toggleMoreMenu(assignmentId: string, event: Event): void {
    event.stopPropagation();
    this.moreMenuAssignmentId.update((openId) =>
      openId === assignmentId ? null : assignmentId,
    );
  }

  cancelAssignmentFromMenu(id: string): void {
    this.moreMenuAssignmentId.set(null);
    this.cancelAssignment(id);
  }

  closeAssignmentFromMenu(id: string): void {
    this.moreMenuAssignmentId.set(null);
    this.closeAssignment(id);
  }

  statusLabel(status: string): string {
    return questionnaireStatusLabel(status);
  }

  typeLabel(type: string): string {
    return questionnaireTypeLabel(type);
  }

  activeReviewerRequest(item: QuestionnaireAssignmentListItem): boolean {
    return hasActiveReviewerRequest({
      assignmentStatus: item.status,
      latest: item.latestSubmission,
    });
  }

  proposalStatusLabel(status: string): string {
    return PROPOSAL_STATUS_LABELS[status] ?? status;
  }

  showProposedChanges(item: QuestionnaireAssignmentListItem): boolean {
    if (this.proposalsForAssignment(item.id).length > 0) return true;
    return (
      item.status === 'submitted' ||
      item.status === 'reviewed' ||
      item.status === 'closed'
    );
  }

  onSummaryToggle(assignmentId: string, event: Event): void {
    const details = event.currentTarget as HTMLDetailsElement;
    const open = !!details.open;
    this.summaryExpandedIds.update((prev) => {
      const next = new Set(prev);
      if (open) next.add(assignmentId);
      else next.delete(assignmentId);
      return next;
    });
  }

  /** Pending proposals for this questionnaire (primary: assignmentId). */
  proposalsForAssignment(
    assignmentId: string,
  ): QuestionnaireProfileProposalItem[] {
    const latestSubmissionId =
      this.items().find((i) => i.id === assignmentId)?.latestSubmission?.id ??
      null;
    return this.proposals().filter((p) => {
      if (p.status !== 'pending') return false;
      if (p.assignmentId === assignmentId) return true;
      // Legacy rolling-deploy fallback only (submissionId ≠ assignmentId).
      return (
        !!latestSubmissionId && p.submissionId === latestSubmissionId
      );
    });
  }

  openAssignment(item: QuestionnaireAssignmentListItem): void {
    const startAtIntro =
      item.status === 'assigned' ||
      item.status === 'in_progress' ||
      item.status === 'changes_requested';
    const link = buildQuestionnaireAssignmentLink({
      assignmentId: item.id,
      ...(startAtIntro ? { stepKey: QUESTIONNAIRE_INTRO_STEP } : {}),
    });
    void this.router.navigate([link.routerLink], {
      queryParams: link.queryParams,
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('uk-UA');
  }

  proposalLabel(p: QuestionnaireProfileProposalItem): string {
    const c = p.proposedChanges as { answerKey?: string; field?: string };
    return c.answerKey || c.field || p.targetSection;
  }

  formatChange(p: QuestionnaireProfileProposalItem): string {
    const c = p.proposedChanges as { from?: unknown; to?: unknown };
    return `${JSON.stringify(c.from ?? null)} → ${JSON.stringify(c.to ?? null)}`;
  }

  assign(): void {
    this.assignBusy.set(true);
    this.assignOk.set(false);
    this.error.set(null);
    this.api.createAssignment({ employeeId: this.employeeId }).subscribe({
      next: () => {
        this.assignBusy.set(false);
        this.assignOk.set(true);
        this.reload();
      },
      error: (err) => {
        this.assignBusy.set(false);
        this.error.set(
          err?.error?.message || 'Не вдалося призначити анкету',
        );
      },
    });
  }

  accept(id: string): void {
    this.api.acceptProposal(id).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('Не вдалося прийняти пропозицію'),
    });
  }

  reject(id: string): void {
    this.api.rejectProposal(id).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('Не вдалося відхилити пропозицію'),
    });
  }

  cancelAssignment(id: string): void {
    if (
      !window.confirm(
        'Скасувати призначення анкети? Чернетка та попередні подання збережуться, але працівник не зможе продовжити заповнення, доки анкету не буде відновлено.',
      )
    ) {
      return;
    }
    this.runLifecycle(id, this.api.cancelAssignment(id), 'Не вдалося відкріпити анкету');
  }

  closeAssignment(id: string): void {
    if (
      !window.confirm(
        'Закрити анкету без можливості відновлення доступу до редагування? Відкріплення можна скасувати пізніше; закриття — ні.',
      )
    ) {
      return;
    }
    this.runLifecycle(id, this.api.closeAssignment(id), 'Не вдалося закрити анкету');
  }

  private runLifecycle(
    id: string,
    request: Observable<unknown>,
    fallbackError: string,
  ): void {
    if (this.busyAssignmentId()) return;
    this.busyAssignmentId.set(id);
    this.error.set(null);
    request.subscribe({
      next: () => {
        this.busyAssignmentId.set(null);
        this.reload();
      },
      error: (err) => {
        this.busyAssignmentId.set(null);
        const status = err?.status as number | undefined;
        const msg =
          err?.error?.message ||
          (status === 404
            ? 'Анкету не знайдено'
            : status === 409
              ? 'Дію неможливо виконати для поточного статусу'
              : fallbackError);
        this.error.set(typeof msg === 'string' ? msg : fallbackError);
        this.reload();
      },
    });
  }

  private reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      list: this.api.listAssignments(this.employeeId).pipe(
        catchError(() => of({ items: [], capabilities: { canAssign: false } })),
      ),
      proposals: this.api.listProposals(this.employeeId).pipe(
        catchError(() => of({ items: [], capabilities: { canApply: false } })),
      ),
    }).subscribe({
      next: ({ list, proposals }) => {
        this.items.set(list.items);
        this.canAssign.set(list.capabilities.canAssign);
        this.proposals.set(proposals.items);
        this.canApply.set(proposals.capabilities.canApply);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Не вдалося завантажити анкети');
      },
    });
  }
}
