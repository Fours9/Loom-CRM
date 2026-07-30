import {
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, type Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type {
  QuestionnaireAttachmentState,
  QuestionnaireDirectoryItem,
  QuestionnaireDirectorySortBy,
} from '@loom/contracts-questionnaires';
import { QuestionnairesApiService } from '../core/questionnaires-api.service';
import { buildQuestionnaireAssignmentLink } from '../navigation/questionnaire-navigation';

type Dept = { id: string; name: string };
type Pos = { id: string; name: string };

const ATTACHMENT_LABELS: Record<QuestionnaireAttachmentState, string> = {
  attached: 'Прикріплено',
  detached: 'Відкріплено',
  closed: 'Закрито',
};

@Component({
  selector: 'loom-questionnaire-directory-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page">
      <header class="header">
        <h1>Анкети</h1>
        <p class="muted">Усі призначення анкет у вашому доступі</p>
      </header>

      <div class="filters">
        <label>
          Відділ
          <select
            [value]="departmentId()"
            (change)="setFilter('departmentId', $any($event.target).value)"
          >
            <option value="">Усі</option>
            @for (d of departments(); track d.id) {
              <option [value]="d.id">{{ d.name }}</option>
            }
          </select>
        </label>
        <label>
          Посада
          <select
            [value]="positionId()"
            (change)="setFilter('positionId', $any($event.target).value)"
          >
            <option value="">Усі</option>
            @for (p of positions(); track p.id) {
              <option [value]="p.id">{{ p.name }}</option>
            }
          </select>
        </label>
        <label>
          Стан
          <select
            [value]="attachmentState()"
            (change)="setFilter('attachmentState', $any($event.target).value)"
          >
            <option value="">Усі</option>
            <option value="attached">Прикріплено</option>
            <option value="detached">Відкріплено</option>
            <option value="closed">Закрито</option>
          </select>
        </label>
        <label>
          Від
          <input
            type="date"
            [value]="createdFrom()"
            (change)="setFilter('createdFrom', $any($event.target).value)"
          />
        </label>
        <label>
          До
          <input
            type="date"
            [value]="createdTo()"
            (change)="setFilter('createdTo', $any($event.target).value)"
          />
        </label>
      </div>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      @if (loading()) {
        <p class="muted">Завантаження…</p>
      } @else if (!items().length) {
        <p class="muted">Анкет не знайдено.</p>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    class="th-sort"
                    [class.active]="sortBy() === 'templateCode'"
                    (click)="toggleSort('templateCode')"
                  >
                    Код
                    <span class="sort-mark" aria-hidden="true">{{
                      sortMark('templateCode')
                    }}</span>
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    class="th-sort"
                    [class.active]="sortBy() === 'employeeName'"
                    (click)="toggleSort('employeeName')"
                  >
                    Працівник
                    <span class="sort-mark" aria-hidden="true">{{
                      sortMark('employeeName')
                    }}</span>
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    class="th-sort"
                    [class.active]="sortBy() === 'departmentName'"
                    (click)="toggleSort('departmentName')"
                  >
                    Відділ
                    <span class="sort-mark" aria-hidden="true">{{
                      sortMark('departmentName')
                    }}</span>
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    class="th-sort"
                    [class.active]="sortBy() === 'positionName'"
                    (click)="toggleSort('positionName')"
                  >
                    Посада
                    <span class="sort-mark" aria-hidden="true">{{
                      sortMark('positionName')
                    }}</span>
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    class="th-sort"
                    [class.active]="sortBy() === 'createdAt'"
                    (click)="toggleSort('createdAt')"
                  >
                    Створено
                    <span class="sort-mark" aria-hidden="true">{{
                      sortMark('createdAt')
                    }}</span>
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    class="th-sort"
                    [class.active]="sortBy() === 'updatedAt'"
                    (click)="toggleSort('updatedAt')"
                  >
                    Змінено
                    <span class="sort-mark" aria-hidden="true">{{
                      sortMark('updatedAt')
                    }}</span>
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    class="th-sort"
                    [class.active]="sortBy() === 'status'"
                    (click)="toggleSort('status')"
                  >
                    Стан
                    <span class="sort-mark" aria-hidden="true">{{
                      sortMark('status')
                    }}</span>
                  </button>
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (item of items(); track item.id) {
                <tr>
                  <td>
                    <code>{{ item.templateCode }}</code>
                    <span class="ver">v{{ item.version }}</span>
                  </td>
                  <td>
                    <a [routerLink]="['/people', item.employeeId]">{{
                      item.employeeDisplayName
                    }}</a>
                  </td>
                  <td>{{ item.departmentName || '—' }}</td>
                  <td>{{ item.positionName || '—' }}</td>
                  <td>{{ formatDate(item.createdAt) }}</td>
                  <td>{{ formatDate(item.updatedAt) }}</td>
                  <td>
                    <span class="badge">{{
                      attachmentLabel(item.attachmentState)
                    }}</span>
                  </td>
                  <td class="actions">
                    <button
                      type="button"
                      class="icon-btn"
                      title="Відкрити"
                      aria-label="Відкрити анкету"
                      (click)="open(item.id)"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM5 5h6v2H7v10h10v-4h2v6H5V5z"
                        />
                      </svg>
                    </button>
                    @if (item.capabilities.canDelete) {
                      <button
                        type="button"
                        class="icon-btn danger"
                        title="Видалити"
                        aria-label="Видалити анкету"
                        [disabled]="busyId() === item.id"
                        (click)="remove(item)"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="currentColor"
                            d="M9 3h6l1 2h5v2H3V5h5l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9zm-1 12h12a1 1 0 0 0 1-1V8H5v12a1 1 0 0 0 1 1z"
                          />
                        </svg>
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="pager">
          <button
            type="button"
            class="btn"
            [disabled]="offset() <= 0 || loading()"
            (click)="prevPage()"
          >
            Назад
          </button>
          <span class="muted"
            >{{ offset() + 1 }}–{{
              Math.min(offset() + limit(), total())
            }}
            з {{ total() }}</span
          >
          <button
            type="button"
            class="btn"
            [disabled]="offset() + limit() >= total() || loading()"
            (click)="nextPage()"
          >
            Далі
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .page {
        display: grid;
        gap: 1rem;
        padding: 1rem 1.25rem 2rem;
        max-width: 1200px;
        margin: 0 auto;
      }
      .header h1 {
        margin: 0;
        font-size: 1.4rem;
      }
      .muted {
        color: var(--pw-muted);
        margin: 0.25rem 0 0;
      }
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem 1rem;
        align-items: end;
      }
      label {
        display: grid;
        gap: 0.25rem;
        font-size: 0.8rem;
        color: var(--pw-muted);
      }
      select,
      input {
        border: 1px solid var(--pw-border);
        border-radius: 8px;
        padding: 0.35rem 0.5rem;
        background: var(--pw-surface);
        min-width: 8rem;
      }
      .table-wrap {
        overflow-x: auto;
        border: 1px solid var(--pw-border);
        border-radius: 10px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }
      th,
      td {
        text-align: left;
        padding: 0.55rem 0.65rem;
        border-bottom: 1px solid var(--pw-border);
        vertical-align: middle;
      }
      th {
        background: color-mix(in srgb, var(--pw-bg, #f6f8fb) 80%, transparent);
        font-weight: 600;
        white-space: nowrap;
      }
      .th-sort {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        border: 0;
        padding: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .th-sort:hover {
        color: var(--pw-accent, #3b82f6);
      }
      .th-sort.active {
        color: var(--pw-accent, #3b82f6);
      }
      .sort-mark {
        font-size: 0.75rem;
        opacity: 0.45;
        min-width: 0.75rem;
      }
      .th-sort.active .sort-mark {
        opacity: 1;
      }
      code {
        font-size: 0.85rem;
      }
      .ver {
        margin-left: 0.35rem;
        color: var(--pw-muted);
        font-size: 0.8rem;
      }
      .badge {
        border: 1px solid var(--pw-border);
        border-radius: 999px;
        padding: 0.1rem 0.5rem;
        font-size: 0.8rem;
        white-space: nowrap;
      }
      .actions {
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        align-items: center;
        justify-content: flex-end;
        gap: 0.45rem;
        min-width: 5.5rem;
      }
      .icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--pw-accent) 40%, var(--pw-border));
        padding: 0;
        background: color-mix(in srgb, var(--pw-accent) 14%, var(--pw-surface));
        color: var(--pw-accent, #5b8def);
        cursor: pointer;
        box-shadow: 0 1px 2px color-mix(in srgb, #000 18%, transparent);
      }
      .icon-btn:hover {
        background: color-mix(in srgb, var(--pw-accent) 22%, var(--pw-surface));
        border-color: color-mix(in srgb, var(--pw-accent) 55%, var(--pw-border));
        color: var(--pw-accent);
      }
      .icon-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
        box-shadow: none;
      }
      .icon-btn.danger {
        color: #f97066;
        border-color: color-mix(in srgb, #f97066 45%, var(--pw-border));
        background: color-mix(in srgb, #f97066 12%, var(--pw-surface));
      }
      .icon-btn.danger:hover {
        color: #fff;
        background: #b42318;
        border-color: #b42318;
      }
      .icon-btn svg {
        width: 1.35rem;
        height: 1.35rem;
      }
      .btn {
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        padding: 0.3rem 0.55rem;
        background: var(--pw-surface);
        cursor: pointer;
        font-size: 0.85rem;
      }
      .btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .pager {
        display: flex;
        gap: 0.75rem;
        align-items: center;
      }
      .error {
        color: #b42318;
      }
    `,
  ],
})
export class QuestionnaireDirectoryPageComponent implements OnInit {
  private readonly api = inject(QuestionnairesApiService);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly Math = Math;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<QuestionnaireDirectoryItem[]>([]);
  readonly total = signal(0);
  readonly busyId = signal<string | null>(null);

  readonly departments = signal<Dept[]>([]);
  readonly positions = signal<Pos[]>([]);

  readonly departmentId = signal('');
  readonly positionId = signal('');
  readonly attachmentState = signal('');
  readonly createdFrom = signal('');
  readonly createdTo = signal('');
  readonly sortBy = signal<QuestionnaireDirectorySortBy>('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly limit = signal(50);
  readonly offset = signal(0);

  ngOnInit(): void {
    this.http
      .get<Dept[]>('/api/v1/departments')
      .pipe(catchError(() => of([])))
      .subscribe((d) => this.departments.set(d));
    this.http
      .get<Pos[]>('/api/v1/positions')
      .pipe(catchError(() => of([])))
      .subscribe((p) => this.positions.set(p));

    this.route.queryParamMap.subscribe((q) => {
      this.departmentId.set(q.get('departmentId') ?? '');
      this.positionId.set(q.get('positionId') ?? '');
      this.attachmentState.set(q.get('attachmentState') ?? '');
      this.createdFrom.set(q.get('createdFrom') ?? '');
      this.createdTo.set(q.get('createdTo') ?? '');
      this.sortBy.set(
        (q.get('sortBy') as QuestionnaireDirectorySortBy) || 'createdAt',
      );
      this.sortDir.set((q.get('sortDir') as 'asc' | 'desc') || 'desc');
      this.offset.set(Number(q.get('offset') || 0));
      this.reload();
    });
  }

  attachmentLabel(state: QuestionnaireAttachmentState): string {
    return ATTACHMENT_LABELS[state] ?? state;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('uk-UA');
  }

  setFilter(key: string, value: string): void {
    const next = { ...this.currentQuery(), [key]: value || null, offset: '0' };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: next,
      queryParamsHandling: 'merge',
    });
  }

  toggleSort(column: QuestionnaireDirectorySortBy): void {
    const same = this.sortBy() === column;
    const nextDir = same && this.sortDir() === 'desc' ? 'asc' : 'desc';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...this.currentQuery(),
        sortBy: column,
        sortDir: same ? nextDir : 'desc',
        offset: '0',
      },
      queryParamsHandling: 'merge',
    });
  }

  sortMark(column: QuestionnaireDirectorySortBy): string {
    if (this.sortBy() !== column) return '';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  prevPage(): void {
    this.setFilter('offset', String(Math.max(0, this.offset() - this.limit())));
  }

  nextPage(): void {
    this.setFilter('offset', String(this.offset() + this.limit()));
  }

  open(id: string): void {
    const link = buildQuestionnaireAssignmentLink({ assignmentId: id });
    void this.router.navigateByUrl(link.routerLink);
  }

  remove(item: QuestionnaireDirectoryItem): void {
    if (
      !window.confirm(
        'Видалити анкету без можливості відновлення? Буде видалено чернетку, усі подання та пропозиції. Уже застосовані до профілю зміни не скасовуються.',
      )
    ) {
      return;
    }
    this.run(item.id, this.api.deleteAssignment(item.id), 'Не вдалося видалити');
  }

  private run(
    id: string,
    request: Observable<unknown>,
    fallback: string,
  ): void {
    if (this.busyId()) return;
    this.busyId.set(id);
    this.error.set(null);
    request.subscribe({
      next: () => {
        this.busyId.set(null);
        this.reload();
      },
      error: (err) => {
        this.busyId.set(null);
        this.error.set(err?.error?.message || fallback);
        this.reload();
      },
    });
  }

  private currentQuery(): Record<string, string | null> {
    return {
      departmentId: this.departmentId() || null,
      positionId: this.positionId() || null,
      attachmentState: this.attachmentState() || null,
      createdFrom: this.createdFrom() || null,
      createdTo: this.createdTo() || null,
      sortBy: this.sortBy(),
      sortDir: this.sortDir(),
      offset: String(this.offset()),
    };
  }

  private reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listDirectory({
        departmentId: this.departmentId() || undefined,
        positionId: this.positionId() || undefined,
        attachmentState: this.attachmentState() || undefined,
        createdFrom: this.createdFrom() || undefined,
        createdTo: this.createdTo() || undefined,
        sortBy: this.sortBy(),
        sortDir: this.sortDir(),
        limit: this.limit(),
        offset: this.offset(),
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.total.set(res.total);
          this.limit.set(res.limit);
          this.offset.set(res.offset);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Не вдалося завантажити список анкет');
        },
      });
  }
}
