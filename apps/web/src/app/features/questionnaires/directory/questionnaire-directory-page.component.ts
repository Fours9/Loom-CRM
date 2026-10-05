import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type {
  QuestionnaireAttachmentState,
  QuestionnaireDirectoryItem,
  QuestionnaireDirectorySortBy,
  QuestionnaireTemplateListResponse,
  QuestionnaireType,
} from '@loom/contracts-questionnaires';
import { QuestionnairesApiService } from '../core/questionnaires-api.service';
import { downloadBlob } from '../core/download-blob';
import { buildQuestionnaireAssignmentLink } from '../navigation/questionnaire-navigation';
import {
  QUESTIONNAIRE_TYPE_LABELS,
  questionnaireAttachmentLabel,
  questionnaireTypeLabel,
} from '../questionnaire-labels';
import { hasActiveReviewerRequest } from '../core/questionnaire-active-change-request';
import { QuestionnaireAttachPickerComponent } from './questionnaire-attach-picker.component';
import { QuestionnaireCreateDialogComponent } from '../shared/questionnaire-create-dialog.component';
import { QuestionnaireFilterToolbarComponent,
  type QuestionnaireFilterToolbarValue,
} from '../shared/questionnaire-filter-toolbar.component';
import {
  HelpCalloutComponent,
} from '../../../core/help';
import {
  QUESTIONNAIRE_LIFECYCLE_CALLOUT,
} from '../help/questionnaire-help.definition';
import {
  claimPwOverlay,
  releasePwOverlay,
  type PwOverlayHandle,
} from '../../../shared/ui/pw-overlay-session';
type Dept = { id: string; name: string };
type Pos = { id: string; name: string };

function parseIdListParam(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

@Component({
  selector: 'loom-questionnaire-directory-page',
  standalone: true,
  imports: [
    RouterLink,
    QuestionnaireAttachPickerComponent,
    QuestionnaireCreateDialogComponent,
    QuestionnaireFilterToolbarComponent,
    HelpCalloutComponent,
  ],
  template: `
    <div class="page pw-stage">
      <span class="pw-stage__glow" aria-hidden="true"></span>
      <header class="header pw-page-head" [class.overlay-open]="showBlankPicker()">
        <div class="header-titles">
          <p class="pw-eyebrow">Оцінка й розвиток</p>
          <h1>Анкети</h1>
          <p class="pw-lead">Усі призначення анкет у вашому доступі</p>
        </div>
        <div class="header-actions">
          <div class="blank-print-wrap" #blankPrintWrap>
            <button
              type="button"
              class="btn"
              [disabled]="blankPrintBusy()"
              [attr.aria-expanded]="showBlankPicker()"
              aria-haspopup="menu"
              (click)="toggleBlankPicker($event)"
            >
              {{ blankPrintBusy() ? 'Формування…' : 'Роздрукувати заготовку' }}
            </button>
            @if (showBlankPicker()) {
              <div class="blank-picker pw-menu" role="menu" (click)="$event.stopPropagation()">
                @if (printableLoading()) {
                  <p class="muted">Завантаження…</p>
                } @else if (!printableTemplates().length) {
                  <p class="muted">Немає доступних шаблонів</p>
                } @else {
                  @for (t of printableTemplates(); track t.code) {
                    <button
                      type="button"
                      role="menuitem"
                      (click)="printBlank(t.code)"
                    >
                      {{ t.title }}
                    </button>
                  }
                }
              </div>
            }
          </div>
          @if (canCreate()) {
            <button
              type="button"
              class="btn primary pw-btn"
              data-help-id="q.create"
              (click)="showCreate.set(true)"
            >
              Створити анкету
            </button>
          }
        </div>
      </header>

      <div class="callout-wrap pw-rise" style="--pw-delay: 70ms">
        <loom-help-callout
          [calloutId]="lifecycleCallout.id"
          [version]="lifecycleCallout.version"
          [body]="lifecycleCallout.body"
        />
      </div>

      <div class="filters-shell pw-panel pw-filters pw-rise" style="--pw-delay: 110ms">
        <loom-questionnaire-filter-toolbar
          [value]="filterValue()"
          [availableFilters]="directoryFilterFields"
          [typeOptions]="typeOptions"
          [departments]="departments()"
          [positions]="positions()"
          (filterChange)="onFilters($event)"
        />
      </div>

      @if (error()) {
        <p class="error pw-rise" style="--pw-delay: 130ms">{{ error() }}</p>
      }

      @if (loading()) {
        <p class="muted pw-rise" style="--pw-delay: 150ms">Завантаження…</p>
      } @else if (!items().length) {
        <div class="empty pw-empty pw-rise" style="--pw-delay: 150ms">
          <p class="muted">Анкет не знайдено.</p>
          @if (canCreate()) {
            <button
              type="button"
              class="btn primary pw-btn"
              data-help-id="q.create"
              (click)="showCreate.set(true)"
            >
              Створити анкету
            </button>
          }
        </div>
      } @else {
        <div class="table-wrap pw-table-shell pw-rise" style="--pw-delay: 160ms">
          <table>
            <thead>
              <tr>
                <th>Код</th>
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
                <tr
                  [class.row-changes-requested]="hasActiveChangeRequest(item)"
                >
                  <td>
                    <code>{{ item.code }}</code>
                    <div class="secondary">
                      {{ item.templateTitle }}
                      <span class="ver"
                        >{{ item.templateCode }} · v{{ item.version }}</span
                      >
                    </div>
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
                    <div class="actions-row">
                      @if (item.capabilities.canAttach) {
                        <button
                          type="button"
                          class="icon-btn"
                          title="Закріпити"
                          aria-label="Закріпити анкету до працівника"
                          data-help-id="q.attach"
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
                    </div>
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

      @if (showCreate()) {
        <loom-questionnaire-create-dialog
          dialogTitle="Створити анкету"
          (close)="showCreate.set(false)"
          (created)="onCreated($event)"
        />
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
        padding: clamp(1.15rem, 2.8vw, 1.85rem);
        max-width: 1200px;
        margin: 0 auto;
        width: 100%;
      }
      .header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.85rem;
        position: relative;
        z-index: 2;
      }
      /* Chrome menus (blank print) must clear filter stacking context. */
      .header.overlay-open {
        z-index: 7;
      }
      .header-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
        align-items: center;
      }
      .callout-wrap,
      .table-wrap,
      .empty {
        position: relative;
        z-index: 0;
        isolation: isolate;
      }
      .filters-shell {
        position: relative;
        z-index: 6;
        isolation: isolate;
        padding: 0.95rem 1rem;
        overflow: visible;
      }
      .header-titles h1 {
        margin: 0.25rem 0 0;
      }
      .title-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .empty {
        display: grid;
        gap: 0.85rem;
        justify-items: start;
      }
      .muted {
        color: var(--pw-muted);
        margin: 0.25rem 0 0;
      }
      .table-wrap {
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }
      tr.row-changes-requested > td {
        background: color-mix(in srgb, #f59e0b 14%, var(--pw-surface));
        border-top: 1px solid color-mix(in srgb, #f59e0b 55%, var(--pw-border));
        border-bottom: 1px solid color-mix(in srgb, #f59e0b 55%, var(--pw-border));
      }
      tr.row-changes-requested > td:first-child {
        border-left: 3px solid #f59e0b;
      }
      tr.row-changes-requested > td:last-child {
        border-right: 1px solid color-mix(in srgb, #f59e0b 55%, var(--pw-border));
      }
      th,
      td {
        text-align: left;
        padding: 0.55rem 0.65rem;
        border-bottom: 1px solid var(--pw-border);
        vertical-align: middle;
      }
      th {
        background: color-mix(in srgb, var(--pw-accent-soft) 55%, var(--pw-surface-2));
        font-weight: 700;
        font-size: 0.78rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--pw-muted);
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
      .secondary {
        display: grid;
        gap: 0.1rem;
        font-size: 0.75rem;
        color: var(--pw-muted);
        margin-top: 0.2rem;
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
        width: 1%;
        white-space: nowrap;
        vertical-align: middle;
      }
      /* Flex on <td> breaks border-collapse and draws the row border through buttons. */
      .actions-row {
        display: inline-flex;
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
        border-radius: 14px;
        border: 1px solid color-mix(in srgb, var(--pw-accent) 22%, var(--pw-border));
        padding: 0.55rem 0.95rem;
        background: color-mix(in srgb, var(--pw-surface) 92%, transparent);
        color: var(--pw-text);
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 700;
        min-height: 2.75rem;
        transition:
          transform 0.16s ease,
          border-color 0.16s ease,
          box-shadow 0.16s ease;
      }
      .btn:hover {
        border-color: var(--pw-accent);
        transform: translateY(-1px);
        box-shadow: 0 6px 16px var(--pw-shadow);
      }
      .btn.primary {
        background: var(--pw-accent);
        border-color: transparent;
        color: var(--pw-on-accent, #fff);
        box-shadow: 0 8px 22px color-mix(in srgb, var(--pw-accent) 28%, transparent);
      }
      .btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }
      .pager {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        margin-top: 0.35rem;
      }
      .error {
        color: var(--pw-danger);
        font-weight: 600;
        margin: 0;
      }
      .blank-print-wrap {
        position: relative;
        z-index: 1;
      }
      .blank-picker {
        position: absolute;
        right: 0;
        top: calc(100% + 6px);
        z-index: 40;
        min-width: 240px;
        max-height: min(280px, 50vh);
        /* .pw-menu supplies panel chrome + themed scrollbar */
      }
      .blank-picker .muted {
        margin: 0;
        padding: 0.55rem 0.65rem;
        color: var(--pw-muted);
        font-weight: 500;
      }
      .blank-picker button {
        text-align: left;
        border: 0;
        background: transparent;
        width: 100%;
        padding: 0.5rem 0.65rem;
        border-radius: 10px;
        cursor: pointer;
        font: inherit;
        font-weight: 600;
        color: var(--pw-text);
      }
      .blank-picker button:hover {
        background: var(--pw-accent-soft);
        color: var(--pw-accent);
      }
    `,
  ],
})
export class QuestionnaireDirectoryPageComponent
  implements OnInit, OnDestroy, PwOverlayHandle
{
  readonly lifecycleCallout = QUESTIONNAIRE_LIFECYCLE_CALLOUT;
  private readonly api = inject(QuestionnairesApiService);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild('blankPrintWrap')
  private blankPrintWrap?: ElementRef<HTMLElement>;

  readonly Math = Math;
  readonly typeOptions = Object.entries(QUESTIONNAIRE_TYPE_LABELS).map(
    ([value, label]) => ({ value, label }),
  );

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<QuestionnaireDirectoryItem[]>([]);
  readonly total = signal(0);
  readonly canCreate = signal(false);
  readonly showCreate = signal(false);
  readonly showBlankPicker = signal(false);
  readonly blankPrintBusy = signal(false);
  readonly printableLoading = signal(false);
  readonly printableTemplates = signal<
    QuestionnaireTemplateListResponse['items']
  >([]);

  readonly departments = signal<Dept[]>([]);
  readonly positions = signal<Pos[]>([]);

  readonly directoryFilterFields: Array<
    | 'code'
    | 'departmentIds'
    | 'positionIds'
    | 'templateTypes'
    | 'attachmentStates'
    | 'createdFrom'
    | 'createdTo'
  > = [
    'code',
    'departmentIds',
    'positionIds',
    'templateTypes',
    'attachmentStates',
    'createdFrom',
    'createdTo',
  ];

  readonly departmentIds = signal<string[]>([]);
  readonly positionIds = signal<string[]>([]);
  readonly templateTypes = signal<string[]>([]);
  readonly attachmentStates = signal<string[]>([]);
  readonly code = signal('');
  readonly createdFrom = signal('');
  readonly createdTo = signal('');
  readonly sortBy = signal<QuestionnaireDirectorySortBy>('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly limit = signal(50);
  readonly offset = signal(0);

  readonly attachTarget = signal<QuestionnaireDirectoryItem | null>(null);
  readonly attachBusy = signal(false);
  readonly attachError = signal<string | null>(null);

  filterValue(): QuestionnaireFilterToolbarValue {
    return {
      code: this.code() || undefined,
      departmentIds: this.departmentIds().length ? this.departmentIds() : undefined,
      positionIds: this.positionIds().length ? this.positionIds() : undefined,
      templateTypes: this.templateTypes().length ? this.templateTypes() : undefined,
      attachmentStates: this.attachmentStates().length
        ? this.attachmentStates()
        : undefined,
      createdFrom: this.createdFrom() || undefined,
      createdTo: this.createdTo() || undefined,
    };
  }

  toggleBlankPicker(event?: Event): void {
    event?.stopPropagation();
    if (this.blankPrintBusy()) return;
    if (this.showBlankPicker()) {
      this.closeBlankPicker();
      return;
    }
    this.openBlankPicker();
  }

  closeFromOverlaySession(): void {
    this.showBlankPicker.set(false);
  }

  ngOnDestroy(): void {
    releasePwOverlay(this);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.showBlankPicker()) return;
    const root = this.blankPrintWrap?.nativeElement;
    if (root && !root.contains(event.target as Node)) {
      this.closeBlankPicker();
    }
  }

  private openBlankPicker(): void {
    claimPwOverlay(this);
    this.showBlankPicker.set(true);
    if (this.printableTemplates().length) return;
    this.printableLoading.set(true);
    this.api.listPrintableTemplates().subscribe({
      next: (res) => {
        this.printableTemplates.set(res.items);
        this.printableLoading.set(false);
      },
      error: () => {
        this.printableLoading.set(false);
        this.closeBlankPicker();
        this.error.set('Не вдалося завантажити шаблони для друку');
      },
    });
  }

  private closeBlankPicker(): void {
    this.showBlankPicker.set(false);
    releasePwOverlay(this);
  }

  printBlank(templateCode: string): void {
    if (this.blankPrintBusy()) return;
    this.blankPrintBusy.set(true);
    this.closeBlankPicker();
    this.error.set(null);
    this.api.exportBlankPdf(templateCode).subscribe({
      next: ({ blob, filename }) => {
        this.blankPrintBusy.set(false);
        downloadBlob(blob, filename);
      },
      error: () => {
        this.blankPrintBusy.set(false);
        this.error.set('Не вдалося сформувати PDF заготовки');
      },
    });
  }

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
      this.departmentIds.set(parseIdListParam(q.get('departmentIds') ?? q.get('departmentId')));
      this.positionIds.set(parseIdListParam(q.get('positionIds') ?? q.get('positionId')));
      this.templateTypes.set(
        parseIdListParam(q.get('templateTypes') ?? q.get('templateType')),
      );
      this.attachmentStates.set(
        parseIdListParam(q.get('attachmentStates') ?? q.get('attachmentState')),
      );
      this.code.set(q.get('code') ?? '');
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

  hasActiveChangeRequest(item: QuestionnaireDirectoryItem): boolean {
    return hasActiveReviewerRequest({
      assignmentStatus: item.status,
      latest: item.latestSubmission,
    });
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

  onFilters(next: QuestionnaireFilterToolbarValue): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...this.currentQuery(),
        code: next.code || null,
        departmentIds: next.departmentIds?.length
          ? next.departmentIds.join(',')
          : null,
        positionIds: next.positionIds?.length
          ? next.positionIds.join(',')
          : null,
        templateTypes: next.templateTypes?.length
          ? next.templateTypes.join(',')
          : null,
        attachmentStates: next.attachmentStates?.length
          ? next.attachmentStates.join(',')
          : null,
        departmentId: null,
        positionId: null,
        templateType: null,
        attachmentState: null,
        createdFrom: next.createdFrom || null,
        createdTo: next.createdTo || null,
        offset: '0',
      },
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

  async onCreated(_event: { id: string }): Promise<void> {
    this.showCreate.set(false);
    this.reload();
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
        this.attachError.set(this.attachFailureMessage(err));
      },
    });
  }

  private attachFailureMessage(err: unknown): string {
    const raw = (err as { error?: { message?: string | string[] } })?.error
      ?.message;
    const message = Array.isArray(raw) ? raw[0] : raw;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
    return 'Не вдалося прикріпити анкету';
  }

  private currentQuery(): Record<string, string | null> {
    return {
      departmentIds: this.departmentIds().length
        ? this.departmentIds().join(',')
        : null,
      positionIds: this.positionIds().length
        ? this.positionIds().join(',')
        : null,
      templateTypes: this.templateTypes().length
        ? this.templateTypes().join(',')
        : null,
      attachmentStates: this.attachmentStates().length
        ? this.attachmentStates().join(',')
        : null,
      code: this.code() || null,
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
        departmentIds: this.departmentIds().length
          ? this.departmentIds()
          : undefined,
        positionIds: this.positionIds().length ? this.positionIds() : undefined,
        templateTypes: this.templateTypes().length
          ? this.templateTypes()
          : undefined,
        attachmentStates: this.attachmentStates().length
          ? this.attachmentStates()
          : undefined,
        code: this.code() || undefined,
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
