import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type {
  QuestionnaireAssignmentListItem,
  QuestionnaireProfileProposalItem,
} from '@loom/contracts-questionnaires';
import { QuestionnairesApiService } from './core/questionnaires-api.service';
import { QuestionnaireSnapshotSummaryComponent } from './questionnaire-snapshot-summary.component';
import { buildQuestionnaireAssignmentLink } from './navigation/questionnaire-navigation';

const STATUS_LABELS: Record<string, string> = {
  assigned: 'Призначено',
  in_progress: 'В процесі',
  submitted: 'Надіслано',
  changes_requested: 'Потрібні зміни',
  reviewed: 'Переглянуто',
  cancelled: 'Скасовано',
};

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
                  <span class="badge">{{ statusLabel(item.status) }}</span>
                  <span class="pct">{{ item.completionPercent }}%</span>
                </div>
                <button
                  type="button"
                  class="btn view"
                  (click)="openAssignment(item.id)"
                >
                  {{
                    item.status === 'submitted' || item.status === 'reviewed'
                      ? 'Відкрити'
                      : item.status === 'changes_requested' ||
                          item.status === 'in_progress' ||
                          item.status === 'assigned'
                        ? 'Продовжити'
                        : 'Переглянути'
                  }}
                </button>
              </div>
              <div class="meta">
                @if (item.dueAt) {
                  <span>Термін: {{ formatDate(item.dueAt) }}</span>
                }
                <span>v{{ item.version }}</span>
              </div>
              @if (proposalsForAssignment(item.id); as props) {
                @if (props.length) {
                  <div class="assignment-proposals">
                    <h4>Пропозиції до профілю</h4>
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
                  </div>
                }
              }
            </li>
          }
        </ul>
      }

      <loom-questionnaire-snapshot-summary [employeeId]="employeeId" />
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
        gap: 0.6rem;
      }
      .card {
        border: 1px solid var(--pw-border);
        border-radius: 10px;
        padding: 0.75rem;
        background: var(--pw-surface);
        display: grid;
        gap: 0.4rem;
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
      .badge {
        border: 1px solid var(--pw-border);
        border-radius: 999px;
        padding: 0.1rem 0.55rem;
        font-size: 0.8rem;
      }
      .pct {
        font-weight: 600;
        color: var(--pw-accent);
      }
      .btn.view {
        flex: 0 0 auto;
        white-space: nowrap;
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
        border: 1px solid var(--pw-border);
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
      .proposals {
        display: grid;
        gap: 0.6rem;
      }
      .assignment-proposals {
        display: grid;
        gap: 0.45rem;
        margin-top: 0.35rem;
        padding-top: 0.55rem;
        border-top: 1px solid var(--pw-border);
      }
      .assignment-proposals h4 {
        margin: 0;
        font-size: 0.9rem;
        font-weight: 600;
      }
      .prop-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.45rem;
      }
      .prop-card {
        border: 1px solid var(--pw-border);
        border-radius: 8px;
        padding: 0.55rem 0.65rem;
        background: color-mix(in srgb, var(--pw-bg, #f6f8fb) 70%, transparent);
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
  readonly error = signal<string | null>(null);
  readonly assignOk = signal(false);
  readonly items = signal<QuestionnaireAssignmentListItem[]>([]);
  readonly proposals = signal<QuestionnaireProfileProposalItem[]>([]);
  readonly canAssign = signal(false);
  readonly canApply = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['employeeId'] && this.employeeId) {
      this.reload();
    }
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  proposalStatusLabel(status: string): string {
    return PROPOSAL_STATUS_LABELS[status] ?? status;
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

  openAssignment(assignmentId: string): void {
    const link = buildQuestionnaireAssignmentLink({ assignmentId });
    void this.router.navigateByUrl(link.routerLink);
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
