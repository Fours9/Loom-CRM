import {
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type {
  QuestionnaireAttachmentState,
  QuestionnaireDirectoryItem,
  QuestionnaireDirectorySortBy,
  QuestionnaireType,
} from '@loom/contracts-questionnaires';
import { QuestionnairesApiService } from '../core/questionnaires-api.service';
import { buildQuestionnaireAssignmentLink } from '../navigation/questionnaire-navigation';
import {
  QUESTIONNAIRE_TYPE_LABELS,
  questionnaireAttachmentLabel,
  questionnaireTypeLabel,
} from '../questionnaire-labels';
import { QuestionnaireAttachPickerComponent } from './questionnaire-attach-picker.component';

type Dept = { id: string; name: string };
type Pos = { id: string; name: string };

@Component({
  selector: 'loom-questionnaire-directory-page',
  standalone: true,
  imports: [RouterLink, QuestionnaireAttachPickerComponent],
  template: `
    <div class="page">
      <header class="header">
        <div class="header-titles">
          <h1>Анкети</h1>
          <p class="muted">Усі призначення анкет у вашому доступі</p>
        </div>
        <div class="header-actions">
          <button
            type="button"
            class="btn"
            disabled
            title="Незабаром"
          >
            Роздрукувати заготовку
          </button>
          @if (canCreate()) {
            <button
              type="button"
              class="btn primary"
              [disabled]="createBusy()"
              (click)="createBlank()"
            >
              {{ createBusy() ? 'Створення…' : 'Створити анкету' }}
            </button>
          }
        </div>
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
          Тип
          <select
            [value]="templateType()"
            (change)="setFilter('templateType', $any($event.target).value)"
          >
            <option value="">Усі</option>
            @for (t of typeOptions; track t.value) {
              <option [value]="t.value">{{ t.label }}</option>
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
            <option value="new">Нова</option>
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
                <th>Тип</th>
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
                  <td>{{ typeLabel(item.templateType) }}</td>
                  <td>
                    @if (item.employeeId) {
                      <a [routerLink]="['/people', item.employeeId]">{{
                        item.employeeDisplayName
                      }}</a>
                    } @else {
                      <span class="muted">Не прикріплено</span>
                    }
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
                    @if (item.capabilities.canAttach) {
                      <button
                        type="button"
                        class="icon-btn"
                        title="Прикріпити"
                        aria-label="Прикріпити анкету до працівника"
                        (click)="openAttachPicker(item)"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="currentColor"
                            d="M16.5 6.5l-7.6 7.6a2.5 2.5 0 003.54 3.54l7.6-7.6a4.5 4.5 0 10-6.36-6.36l-7.6 7.6a6.5 6.5 0 109.19 9.19l6.6-6.6-1.41-1.42-6.6 6.6a4.5 4.5 0 11-6.36-6.36l7.6-7.6a2.5 2.5 0 013.54 3.54l-7.6 7.6a.5.5 0 01-.71-.71l6.6-6.6-1.41-1.42z"
                          />
                        </svg>
                      </button>
                    }
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

      @if (attachTarget(); as target) {
        <loom-questionnaire-attach-picker
          [constraint]="target.attachConstraint"
          [busy]="attachBusy()"
          [error]="attachError()"
          (confirm)="confirmAttach($event)"
          (close)="closeAttachPicker()"
        />
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
      .header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
      }
      .header-titles h1 {
        margin: 0;
        font-size: 1.4rem;
      }
      .header-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
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
      .btn.primary {
        background: var(--pw-accent);
        border-color: var(--pw-accent);
        color: #fff;
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
  readonly typeOptions = Object.entries(QUESTIONNAIRE_TYPE_LABELS).map(
    ([value, label]) => ({ value, label }),
  );

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<QuestionnaireDirectoryItem[]>([]);
  readonly total = signal(0);
  readonly canCreate = signal(false);
  readonly createBusy = signal(false);

  readonly departments = signal<Dept[]>([]);
  readonly positions = signal<Pos[]>([]);

  readonly departmentId = signal('');
  readonly positionId = signal('');
  readonly templateType = signal('');
  readonly attachmentState = signal('');
  readonly createdFrom = signal('');
  readonly createdTo = signal('');
  readonly sortBy = signal<QuestionnaireDirectorySortBy>('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly limit = signal(50);
  readonly offset = signal(0);

  readonly attachTarget = signal<QuestionnaireDirectoryItem | null>(null);
  readonly attachBusy = signal(false);
  readonly attachError = signal<string | null>(null);

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
      this.templateType.set(q.get('templateType') ?? '');
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
    return questionnaireAttachmentLabel(state);
  }

  typeLabel(type: QuestionnaireType): string {
    return questionnaireTypeLabel(type);
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

  async createBlank(): Promise<void> {
    if (this.createBusy()) return;
    this.createBusy.set(true);
    this.error.set(null);
    try {
      const created = await firstValueFrom(this.api.createAssignment({}));
      const link = buildQuestionnaireAssignmentLink({
        assignmentId: created.id,
      });
      await this.router.navigateByUrl(link.routerLink);
    } catch (err: unknown) {
      this.error.set(
        (err as { error?: { message?: string } })?.error?.message ||
          'Не вдалося створити анкету',
      );
    } finally {
      this.createBusy.set(false);
    }
  }

  openAttachPicker(item: QuestionnaireDirectoryItem): void {
    this.attachError.set(null);
    this.attachTarget.set(item);
  }

  closeAttachPicker(): void {
    this.attachTarget.set(null);
    this.attachError.set(null);
  }

  confirmAttach(employeeId: string): void {
    const target = this.attachTarget();
    if (!target || this.attachBusy()) return;
    this.attachBusy.set(true);
    this.attachError.set(null);
    this.api.attachAssignment(target.id, { employeeId }).subscribe({
      next: () => {
        this.attachBusy.set(false);
        this.closeAttachPicker();
        this.reload();
      },
      error: (err) => {
        this.attachBusy.set(false);
        this.attachError.set(
          err?.error?.message || 'Не вдалося прикріпити анкету',
        );
      },
    });
  }

  private currentQuery(): Record<string, string | null> {
    return {
      departmentId: this.departmentId() || null,
      positionId: this.positionId() || null,
      templateType: this.templateType() || null,
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
        templateType: this.templateType() || undefined,
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
          this.canCreate.set(res.capabilities.canCreate);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Не вдалося завантажити список анкет');
        },
      });
  }
}
