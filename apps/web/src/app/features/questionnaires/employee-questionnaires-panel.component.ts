import {
  Component,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  inject,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of, type Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type {
  QuestionnaireAssignmentListItem,
  QuestionnaireProfileProposalItem,
} from '@loom/contracts-questionnaires';
import { isQuestionnairePostSubmitStatus } from '@loom/contracts-questionnaires';
import type { EmployeeListItem } from '@loom/contracts-employees';
import { QuestionnairesApiService } from './core/questionnaires-api.service';
import { downloadBlob } from './core/download-blob';
import { QuestionnaireSnapshotSummaryComponent } from './questionnaire-snapshot-summary.component';
import { buildQuestionnaireAssignmentLink } from './navigation/questionnaire-navigation';
import { questionnaireListOpenLabel } from './fill/questionnaire-fill-session.policy';
import { QUESTIONNAIRE_INTRO_STEP } from './navigation/questionnaire-step-keys';
import {
  QUESTIONNAIRE_STATUS_LABELS,
  QUESTIONNAIRE_TYPE_LABELS,
  questionnaireStatusLabel,
  questionnaireTypeLabel,
} from './questionnaire-labels';
import { hasActiveReviewerRequest } from './core/questionnaire-active-change-request';
import {
  claimPwOverlay,
  releasePwOverlay,
  type PwOverlayHandle,
} from '../../shared/ui/pw-overlay-session';
import { QuestionnaireCreateDialogComponent } from './shared/questionnaire-create-dialog.component';
import {
  QuestionnaireFilterToolbarComponent,
  type QuestionnaireFilterToolbarValue,
} from './shared/questionnaire-filter-toolbar.component';
import {
  proposalCanAccept,
  proposalCanReject,
  proposalChangeSummary,
  proposalChangeTitle,
} from './questionnaire-proposal-labels';
import {
  HelpCalloutComponent,
} from '../../core/help';
import {
  QUESTIONNAIRE_LIFECYCLE_CALLOUT,
  QUESTIONNAIRE_PROPOSALS_HINT,
} from './help/questionnaire-help.definition';

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  pending: 'Очікує',
  accepted: 'Прийнято',
  rejected: 'Відхилено',
};

@Component({
  selector: 'loom-employee-questionnaires-panel',
  standalone: true,
  imports: [
    QuestionnaireSnapshotSummaryComponent,
    QuestionnaireCreateDialogComponent,
    QuestionnaireFilterToolbarComponent,
    HelpCalloutComponent,
  ],
  template: `
    <div class="panel">
      <div class="toolbar">
        <div class="title-row">
          <h2>Анкети</h2>
        </div>
        @if (canAssign()) {
          <button
            type="button"
            class="btn pw-btn"
            (click)="showCreate.set(true)"
          >
            Призначити анкету
          </button>
        }
      </div>

      <loom-help-callout
        [calloutId]="lifecycleCallout.id"
        [version]="lifecycleCallout.version"
        [body]="lifecycleCallout.body"
      />

      <loom-questionnaire-filter-toolbar
        [value]="filterValue()"
        [availableFilters]="profileFilterFields"
        [typeOptions]="typeOptions"
        [statusOptions]="statusOptions"
        (filterChange)="onFilters($event)"
      />

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      @if (assignOk()) {
        <p class="ok">Анкету призначено</p>
      }

      @if (loading()) {
        <p class="muted">Завантаження…</p>
      } @else if (!items().length) {
        <div class="empty">
          <p class="muted">Немає призначених анкет.</p>
          @if (canAssign()) {
            <button
              type="button"
              class="btn pw-btn"
              (click)="showCreate.set(true)"
            >
              Призначити анкету
            </button>
          }
        </div>
      } @else {
        <ul class="list list-host">
          @for (item of items(); track item.id) {
            <li class="card">
              <div class="card-row">
                <div class="card-main">
                  <strong>{{ item.templateTitle }}</strong>
                  <code class="code-pill">{{ item.code }}</code>
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
                    class="pw-btn pw-btn--ghost view"
                    data-help-id="q.open"
                    (click)="openAssignment(item)"
                  >
                    {{ openLabel(item) }}
                  </button>
                  <div class="more-menu-wrap">
                    <button
                      type="button"
                      class="more-btn"
                      title="Додаткові дії"
                      aria-label="Додаткові дії"
                      data-help-id="q.more"
                      [attr.aria-expanded]="moreMenuAssignmentId() === item.id"
                      [attr.aria-haspopup]="'menu'"
                      [disabled]="busyAssignmentId() === item.id"
                      (click)="toggleMoreMenu(item.id, $event)"
                    >
                      <span class="more-icon" aria-hidden="true">⋮</span>
                    </button>
                    @if (moreMenuAssignmentId() === item.id) {
                      <div
                        class="more-menu pw-menu"
                        role="menu"
                        (click)="$event.stopPropagation()"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          class="menu-row"
                          [disabled]="busyAssignmentId() === item.id"
                          (click)="printAssignmentFromMenu(item.id)"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            aria-hidden="true"
                          >
                            <path
                              fill="currentColor"
                              d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"
                            />
                          </svg>
                          <span>Роздрукувати</span>
                        </button>
                        @if (item.capabilities.canCancel) {
                          <button
                            type="button"
                            role="menuitem"
                            class="menu-row"
                            [disabled]="busyAssignmentId() === item.id"
                            (click)="cancelAssignmentFromMenu(item.id)"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              width="18"
                              height="18"
                              aria-hidden="true"
                            >
                              <path
                                fill="currentColor"
                                d="M17 7h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1 0 1.43-.99 2.63-2.32 2.98l1.46 1.46C20.88 15.61 22 13.95 22 12c0-2.76-2.24-5-5-5zM16 11h-2.19l2 2H16v-2zM2 4.27l3.11 3.11C3.29 8.12 2 9.91 2 12c0 2.76 2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1 0-1.59 1.21-2.9 2.76-3.07L8.73 11H8v2h2.73L13 15.27V17h1.73l4.01 4L20 19.73 3.27 3 2 4.27z"
                              />
                            </svg>
                            <span>Відкріпити</span>
                          </button>
                        }
                        @if (item.capabilities.canClose) {
                          <button
                            type="button"
                            role="menuitem"
                            class="menu-row"
                            [disabled]="busyAssignmentId() === item.id"
                            (click)="closeAssignmentFromMenu(item.id)"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              width="18"
                              height="18"
                              aria-hidden="true"
                            >
                              <path
                                fill="currentColor"
                                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"
                              />
                            </svg>
                            <span>Закрити</span>
                          </button>
                        }
                        @if (item.capabilities.canDelete) {
                          <button
                            type="button"
                            role="menuitem"
                            class="menu-row danger-item"
                            [disabled]="busyAssignmentId() === item.id"
                            (click)="deleteAssignmentFromMenu(item.id)"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              width="18"
                              height="18"
                              aria-hidden="true"
                            >
                              <path
                                fill="currentColor"
                                d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h1v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h1a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9zm2 2h2v1h-2V5zm-2 4a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1zm6 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1z"
                              />
                            </svg>
                            <span>Видалити</span>
                          </button>
                        }
                      </div>
                    }
                  </div>
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
                  <details
                    class="fold"
                    [open]="proposalsExpandedIds().has(item.id)"
                    (toggle)="onProposalsToggle(item.id, $event)"
                  >
                    <summary>
                      <span class="fold-title"
                        >Запропоновані зміни до профілю</span
                      >
                      @if (proposalsForAssignment(item.id).length; as count) {
                        <span class="fold-count">{{ count }}</span>
                      }
                    </summary>
                    <p class="hint">{{ proposalsHint }}</p>
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
                                @if (
                                  p.status === 'pending' &&
                                  (canAcceptProposal(p) || canRejectProposal(p))
                                ) {
                                  <div class="actions">
                                    @if (canAcceptProposal(p)) {
                                      <button
                                        type="button"
                                        class="btn pw-btn"
                                        (click)="accept(item.id, p.id)"
                                      >
                                        Прийняти
                                      </button>
                                    }
                                    @if (canRejectProposal(p)) {
                                      <button
                                        type="button"
                                        class="btn pw-btn pw-btn--ghost"
                                        (click)="reject(item.id, p.id)"
                                      >
                                        Відхилити
                                      </button>
                                    }
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

      @if (showCreate()) {
        <loom-questionnaire-create-dialog
          dialogTitle="Призначити анкету"
          [prefillEmployee]="prefillEmployee()"
          (close)="showCreate.set(false)"
          (created)="onCreated($event)"
        />
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
      .title-row {
        display: flex;
        align-items: center;
        gap: 0.45rem;
      }
      .empty {
        display: grid;
        gap: 0.65rem;
        justify-items: start;
      }
      .hint {
        margin: 0.35rem 0 0.5rem;
        font-size: 0.85rem;
        color: var(--pw-muted);
        line-height: 1.4;
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
      .list-host {
        position: relative;
        z-index: 0;
        isolation: isolate;
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
      .code-pill {
        font-size: 0.8rem;
        padding: 0.05rem 0.35rem;
        border-radius: 4px;
        border: 1px solid var(--pw-border);
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
      .view {
        flex: 0 0 auto;
        white-space: nowrap;
      }
      .more-menu-wrap {
        position: relative;
        display: inline-flex;
      }
      .more-btn {
        min-width: 2.4rem;
        min-height: 2.4rem;
        padding: 0.35rem 0.45rem;
        line-height: 1;
        border: 1px solid var(--pw-border);
        border-radius: 10px;
        background: transparent;
        color: var(--pw-text);
        cursor: pointer;
      }
      .more-btn:hover:not(:disabled) {
        border-color: var(--pw-accent);
        color: var(--pw-accent);
      }
      .more-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
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
        /* .pw-menu supplies panel chrome (border/radius/background/shadow/scrollbar). */
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
      .more-menu .menu-row {
        display: flex;
        align-items: center;
        gap: 0.55rem;
      }
      .more-menu .menu-row svg {
        flex: none;
      }
      .more-menu button:hover:not(:disabled) {
        background: color-mix(in srgb, var(--pw-muted) 14%, transparent);
      }
      .more-menu button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .more-menu .danger-item {
        color: #fff;
        background: #b91c1c;
      }
      .more-menu .danger-item:hover:not(:disabled) {
        background: #991b1b;
        color: #fff;
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
export class EmployeeQuestionnairesPanelComponent
  implements OnChanges, OnDestroy, PwOverlayHandle
{
  readonly lifecycleCallout = QUESTIONNAIRE_LIFECYCLE_CALLOUT;
  readonly proposalsHint = QUESTIONNAIRE_PROPOSALS_HINT;
  private readonly api = inject(QuestionnairesApiService);
  private readonly router = inject(Router);

  @Input({ required: true }) employeeId!: string;
  /** Optional display name for create dialog prefill. */
  @Input() employeeFullName: string | null = null;
  /** Fired after a proposal is accepted so People can refresh profile SoT. */
  readonly profileAffected = output<void>();

  readonly loading = signal(false);
  readonly busyAssignmentId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly assignOk = signal(false);
  readonly showCreate = signal(false);
  readonly items = signal<QuestionnaireAssignmentListItem[]>([]);
  readonly proposals = signal<QuestionnaireProfileProposalItem[]>([]);
  readonly canAssign = signal(false);
  readonly summaryExpandedIds = signal<ReadonlySet<string>>(new Set());
  readonly proposalsExpandedIds = signal<ReadonlySet<string>>(new Set());
  readonly moreMenuAssignmentId = signal<string | null>(null);

  readonly filterCode = signal('');
  readonly filterTemplateTypes = signal<string[]>([]);
  readonly filterStatuses = signal<string[]>([]);
  readonly filterCreatedFrom = signal('');
  readonly filterCreatedTo = signal('');

  readonly profileFilterFields: Array<
    'code' | 'templateTypes' | 'statuses' | 'createdFrom' | 'createdTo'
  > = ['code', 'templateTypes', 'statuses', 'createdFrom', 'createdTo'];

  readonly typeOptions = Object.entries(QUESTIONNAIRE_TYPE_LABELS).map(
    ([value, label]) => ({ value, label }),
  );
  readonly statusOptions = Object.entries(QUESTIONNAIRE_STATUS_LABELS).map(
    ([value, label]) => ({ value, label }),
  );

  filterValue(): QuestionnaireFilterToolbarValue {
    return {
      code: this.filterCode() || undefined,
      templateTypes: this.filterTemplateTypes().length
        ? this.filterTemplateTypes()
        : undefined,
      statuses: this.filterStatuses().length ? this.filterStatuses() : undefined,
      createdFrom: this.filterCreatedFrom() || undefined,
      createdTo: this.filterCreatedTo() || undefined,
    };
  }

  prefillEmployee(): Pick<EmployeeListItem, 'id' | 'fullName'> | null {
    if (!this.employeeId) return null;
    const name = this.employeeFullName?.trim() || 'Працівник';
    return { id: this.employeeId, fullName: name };
  }

  onFilters(next: QuestionnaireFilterToolbarValue): void {
    this.filterCode.set(next.code ?? '');
    this.filterTemplateTypes.set(next.templateTypes ?? []);
    this.filterStatuses.set(next.statuses ?? []);
    this.filterCreatedFrom.set(next.createdFrom ?? '');
    this.filterCreatedTo.set(next.createdTo ?? '');
    this.reload();
  }

  onCreated(_event: { id: string }): void {
    this.showCreate.set(false);
    this.assignOk.set(true);
    this.reload();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['employeeId'] && this.employeeId) {
      this.summaryExpandedIds.set(new Set());
      this.closeMoreMenu();
      this.reload();
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMoreMenu();
  }

  ngOnDestroy(): void {
    releasePwOverlay(this);
  }

  closeFromOverlaySession(): void {
    this.moreMenuAssignmentId.set(null);
  }

  toggleMoreMenu(assignmentId: string, event: Event): void {
    event.stopPropagation();
    if (this.moreMenuAssignmentId() === assignmentId) {
      this.closeMoreMenu();
      return;
    }
    claimPwOverlay(this);
    this.moreMenuAssignmentId.set(assignmentId);
  }

  printAssignmentFromMenu(id: string): void {
    this.closeMoreMenu();
    this.printAssignment(id);
  }

  cancelAssignmentFromMenu(id: string): void {
    this.closeMoreMenu();
    this.cancelAssignment(id);
  }

  closeAssignmentFromMenu(id: string): void {
    this.closeMoreMenu();
    this.closeAssignment(id);
  }

  deleteAssignmentFromMenu(id: string): void {
    this.closeMoreMenu();
    this.deleteAssignment(id);
  }

  private closeMoreMenu(): void {
    this.moreMenuAssignmentId.set(null);
    releasePwOverlay(this);
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
    return isQuestionnairePostSubmitStatus(item.status);
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

  onProposalsToggle(assignmentId: string, event: Event): void {
    const details = event.currentTarget as HTMLDetailsElement;
    const open = !!details.open;
    this.proposalsExpandedIds.update((prev) => {
      const next = new Set(prev);
      if (open) next.add(assignmentId);
      else next.delete(assignmentId);
      return next;
    });
  }

  private keepProposalsExpanded(assignmentId: string): void {
    this.proposalsExpandedIds.update((prev) => {
      if (prev.has(assignmentId)) return prev;
      const next = new Set(prev);
      next.add(assignmentId);
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

  openLabel(item: QuestionnaireAssignmentListItem): string {
    return questionnaireListOpenLabel({
      canStartFill: item.capabilities.canStartFill,
      status: item.status,
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

  assign(): void {
    this.showCreate.set(true);
  }

  accept(assignmentId: string, proposalId: string): void {
    this.keepProposalsExpanded(assignmentId);
    this.api.acceptProposal(proposalId).subscribe({
      next: () => {
        this.reload({ soft: true });
        this.profileAffected.emit();
      },
      error: () => this.error.set('Не вдалося прийняти пропозицію'),
    });
  }

  reject(assignmentId: string, proposalId: string): void {
    this.keepProposalsExpanded(assignmentId);
    this.api.rejectProposal(proposalId).subscribe({
      next: () => this.reload({ soft: true }),
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
        'Закрити анкету? Якщо є збережена чернетка, її буде подано і створено пропозиції до профілю; після закриття редагування буде недоступне.',
      )
    ) {
      return;
    }
    this.runLifecycle(id, this.api.closeAssignment(id), 'Не вдалося закрити анкету');
  }

  deleteAssignment(id: string): void {
    if (
      !window.confirm(
        'Видалити анкету без можливості відновлення? Буде видалено чернетку, усі подання та пропозиції. Уже застосовані до профілю зміни не скасовуються.',
      )
    ) {
      return;
    }
    this.runLifecycle(id, this.api.deleteAssignment(id), 'Не вдалося видалити анкету');
  }

  printAssignment(id: string): void {
    if (this.busyAssignmentId()) return;
    this.busyAssignmentId.set(id);
    this.error.set(null);
    this.api.exportAssignmentPdf(id).subscribe({
      next: ({ blob, filename }) => {
        this.busyAssignmentId.set(null);
        downloadBlob(blob, filename);
      },
      error: () => {
        this.busyAssignmentId.set(null);
        this.error.set('Не вдалося сформувати PDF');
      },
    });
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

  private reload(opts?: { soft?: boolean }): void {
    const soft = opts?.soft === true;
    if (!soft) {
      this.loading.set(true);
    }
    this.error.set(null);
    forkJoin({
      list: this.api
        .listAssignments(this.employeeId, {
          code: this.filterCode() || undefined,
          templateTypes: this.filterTemplateTypes().length
            ? this.filterTemplateTypes()
            : undefined,
          statuses: this.filterStatuses().length
            ? this.filterStatuses()
            : undefined,
          createdFrom: this.filterCreatedFrom() || undefined,
          createdTo: this.filterCreatedTo() || undefined,
        })
        .pipe(
          catchError(() =>
            of({ items: [], capabilities: { canAssign: false } }),
          ),
        ),
      proposals: this.api.listProposals(this.employeeId).pipe(
        catchError(() => of({ items: [] })),
      ),
    }).subscribe({
      next: ({ list, proposals }) => {
        this.items.set(list.items);
        this.canAssign.set(list.capabilities.canAssign);
        this.proposals.set(proposals.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Не вдалося завантажити анкети');
      },
    });
  }
}
