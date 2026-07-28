import { Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api/api.service';
import { Department, Position } from '../core/api/models';
import { ABSENCE_TYPE_LABELS } from '../core/api/labels';
import { requestTypeLabel } from '../core/api/request-view.util';
import {
  MultiSelectItem,
  MultiSelectListComponent,
} from '../shared/multi-select-list.component';
import { RequestStatusBadgeComponent } from '../shared/request-status-badge.component';
import {
  RequestListItemViewModel,
  toRequestListItemVm,
} from './request-list-item.vm';
import { buildCreateAbsenceRequestLink } from './create-request-navigation';

type RequestSortKey =
  | 'createdAt'
  | 'startDate'
  | 'employeeName'
  | 'departmentName'
  | 'positionName'
  | 'type'
  | 'status';

@Component({
  selector: 'app-requests-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    MultiSelectListComponent,
    RequestStatusBadgeComponent,
  ],
  template: `
    <section class="page">
      <header class="page-head">
        <div>
          <h1>Заявки</h1>
          <p>Список заявок на відсутність</p>
        </div>
        <a
          class="btn"
          [routerLink]="createRequestLink.routerLink"
          [queryParams]="createRequestLink.queryParams"
        >
          Нова заявка
        </a>
      </header>

      <div class="filters">
        <label class="filter-block narrow">
          <span>Статус</span>
          <select [(ngModel)]="statusGroup" (ngModelChange)="onFilterChange()">
            <option value="">Усі</option>
            <option value="pending">Подана</option>
            <option value="approved">Затверджена</option>
            <option value="completed">Завершена</option>
            <option value="rejected">Відхилена</option>
            <option value="cancelled">Скасована</option>
            <option value="deletion_requested">Запит на видалення</option>
          </select>
        </label>
        <label class="filter-block narrow">
          <span>Тип</span>
          <select [(ngModel)]="type" (ngModelChange)="onFilterChange()">
            <option value="">Усі типи</option>
            @for (t of typeKeys; track t) {
              <option [value]="t">{{ requestTypeLabel(t) }}</option>
            }
          </select>
        </label>
        <label class="filter-block">
          <span>Відділи</span>
          <app-multi-select-list
            [items]="departmentItems"
            [selectedIds]="departmentIds"
            placeholder="Усі відділи"
            (selectedIdsChange)="onDepartmentsChange($event)"
          />
        </label>
        <label class="filter-block narrow">
          <span>Посада</span>
          <select [(ngModel)]="positionId" (ngModelChange)="onFilterChange()">
            <option value="">Усі посади</option>
            @for (p of positions; track p.id) {
              <option [value]="p.id">{{ p.name }}</option>
            }
          </select>
        </label>
        <label class="filter-block narrow phone-sort">
          <span>Сортування</span>
          <select [ngModel]="sortBy" (ngModelChange)="onPhoneSortKey($event)">
            <option value="createdAt">Створено</option>
            <option value="startDate">Період</option>
            <option value="employeeName">Працівник</option>
            <option value="departmentName">Відділ</option>
            <option value="positionName">Посада</option>
            <option value="type">Тип</option>
            <option value="status">Статус</option>
          </select>
          <button type="button" class="sort-dir-btn" (click)="toggleSortDir()" [attr.aria-label]="'Напрямок: ' + sortDir">
            {{ sortDir === 'asc' ? '↑' : '↓' }}
          </button>
        </label>
      </div>

      @if (error) {
        <p class="error">{{ error }}</p>
      }
      @if (info) {
        <p class="ok">{{ info }}</p>
      }

      <ul class="card-list" aria-label="Заявки">
        @for (r of items; track r.id) {
          <li class="request-card pw-request-frame" [attr.data-frame]="r.frameTone">
            <a class="card-link" [routerLink]="r.detailLink">
              <span
                class="swatch"
                [style.background]="r.calendarColor"
                aria-hidden="true"
              ></span>
              <span class="card-body">
                <strong class="card-title">{{ r.employeeName }}</strong>
                <span class="card-meta">{{ r.typeLabel }} · {{ r.periodLabel }}</span>
                <span class="card-meta">{{ r.departmentName }} · {{ r.positionName }}</span>
                <span class="card-meta">{{ r.createdAt | date: 'short' }}</span>
                <app-request-status-badge [status]="r.statusGroup" />
              </span>
            </a>
            @if (r.canEdit) {
              <div class="card-actions">
                <a class="btn-edit" [routerLink]="r.editLink" [queryParams]="{ edit: '1' }">Редагувати</a>
              </div>
            }
          </li>
        }
      </ul>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>
                <button type="button" class="sort-btn" (click)="toggleSort('employeeName')">
                  Працівник <span class="sort-ind">{{ sortIndicator('employeeName') }}</span>
                </button>
              </th>
              <th>
                <button type="button" class="sort-btn" (click)="toggleSort('departmentName')">
                  Відділ <span class="sort-ind">{{ sortIndicator('departmentName') }}</span>
                </button>
              </th>
              <th>
                <button type="button" class="sort-btn" (click)="toggleSort('positionName')">
                  Посада <span class="sort-ind">{{ sortIndicator('positionName') }}</span>
                </button>
              </th>
              <th>
                <button type="button" class="sort-btn" (click)="toggleSort('type')">
                  Тип <span class="sort-ind">{{ sortIndicator('type') }}</span>
                </button>
              </th>
              <th>
                <button type="button" class="sort-btn" (click)="toggleSort('startDate')">
                  Період <span class="sort-ind">{{ sortIndicator('startDate') }}</span>
                </button>
              </th>
              <th>
                <button type="button" class="sort-btn" (click)="toggleSort('status')">
                  Статус <span class="sort-ind">{{ sortIndicator('status') }}</span>
                </button>
              </th>
              <th>
                <button type="button" class="sort-btn" (click)="toggleSort('createdAt')">
                  Створено <span class="sort-ind">{{ sortIndicator('createdAt') }}</span>
                </button>
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (r of items; track r.id) {
              <tr
                [routerLink]="r.detailLink"
                class="row-link pw-request-frame"
                [attr.data-frame]="r.frameTone"
              >
                <td>
                  <span
                    class="swatch"
                    [style.background]="r.calendarColor"
                    [title]="r.calendarColor"
                  ></span>
                </td>
                <td>{{ r.employeeName }}</td>
                <td>{{ r.departmentName }}</td>
                <td>{{ r.positionName }}</td>
                <td>{{ r.typeLabel }}</td>
                <td>{{ r.periodLabel }}</td>
                <td><app-request-status-badge [status]="r.statusGroup" /></td>
                <td>{{ r.createdAt | date: 'short' }}</td>
                <td class="actions" (click)="$event.stopPropagation()">
                  @if (r.canEdit) {
                    <a class="btn-edit" [routerLink]="r.editLink" [queryParams]="{ edit: '1' }">Редагувати</a>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (!loading && items.length === 0) {
        <p class="empty">Заявок не знайдено</p>
      }

      <div class="pager">
        <button type="button" [disabled]="page <= 1" (click)="prev()">Назад</button>
        <span>Стор. {{ page }} / {{ totalPages }}</span>
        <button type="button" [disabled]="page >= totalPages" (click)="next()">Далі</button>
      </div>
    </section>
  `,
  styles: [
    `
      .page { display: grid; gap: 1rem; }
      .page-head {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 1rem;
        align-items: start;
      }
      .page-head p { margin: 0.25rem 0 0; color: var(--pw-muted); }
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: end;
      }
      .filter-block {
        display: grid;
        gap: 0.35rem;
        font-size: 0.9rem;
        color: var(--pw-text);
        width: 100%;
        flex: 1 1 100%;
        min-width: 0;
      }
      .filter-block.narrow { width: 100%; flex: 1 1 100%; }
      .phone-sort {
        grid-template-columns: 1fr auto;
        align-items: end;
      }
      .phone-sort > span { grid-column: 1 / -1; }
      .sort-dir-btn {
        min-width: 2.75rem;
        min-height: 2.75rem;
        border: 1px solid var(--pw-border-strong);
        border-radius: 8px;
        background: var(--pw-surface);
        cursor: pointer;
      }
      select {
        padding: 0.55rem 0.7rem;
        border: 1px solid var(--pw-border-strong);
        border-radius: 8px;
        width: 100%;
        box-sizing: border-box;
        min-height: 2.75rem;
      }
      .btn {
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        text-decoration: none;
        padding: 0.65rem 1rem;
        border-radius: 8px;
        min-height: 2.75rem;
        display: inline-flex;
        align-items: center;
      }
      .card-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.75rem;
      }
      .request-card {
        display: grid;
        gap: 0;
        overflow: hidden;
      }
      .card-link {
        display: flex;
        gap: 0.75rem;
        align-items: flex-start;
        padding: 0.85rem 1rem;
        text-decoration: none;
        color: inherit;
        min-width: 0;
      }
      .card-body {
        display: grid;
        gap: 0.35rem;
        min-width: 0;
        justify-items: start;
      }
      .card-title { overflow-wrap: anywhere; }
      .card-meta {
        color: var(--pw-muted);
        font-size: 0.9rem;
        overflow-wrap: anywhere;
      }
      .card-actions {
        padding: 0 1rem 0.85rem;
        display: flex;
        justify-content: flex-end;
      }
      .table-wrap { display: none; }
      table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0 0.55rem;
        background: transparent;
      }
      thead th {
        text-align: left;
        padding: 0.35rem 0.75rem;
        border: 0;
        color: var(--pw-muted);
        font-weight: 600;
      }
      tbody td {
        text-align: left;
        padding: 0.75rem;
        border: 0;
        background: transparent;
      }
      tbody tr.pw-request-frame td:first-child {
        border-radius: 12px 0 0 12px;
      }
      tbody tr.pw-request-frame td:last-child {
        border-radius: 0 12px 12px 0;
      }
      .sort-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        min-height: auto;
      }
      .sort-ind { color: var(--pw-muted); font-weight: 500; }
      .swatch {
        display: inline-block;
        width: 14px;
        height: 14px;
        border-radius: 4px;
        border: 1px solid var(--pw-border);
        vertical-align: middle;
        flex-shrink: 0;
        margin-top: 0.25rem;
      }
      .row-link { cursor: pointer; }
      .row-link:hover { filter: brightness(0.98); }
      .actions { width: 1%; white-space: nowrap; text-align: right; vertical-align: middle; }
      .btn-edit {
        display: inline-flex;
        align-items: center;
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        text-decoration: none;
        border-radius: 8px;
        padding: 0.5rem 0.75rem;
        font: inherit;
        line-height: 1.2;
        min-height: 2.75rem;
      }
      .error { color: var(--pw-danger); }
      .ok { color: #027a48; margin: 0; }
      html[data-theme='dark'] .ok { color: #6ee7b7; }
      .empty { padding: 1rem; color: var(--pw-muted); }
      .pager {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        align-items: center;
      }
      .pager button {
        border: 1px solid var(--pw-border-strong);
        background: var(--pw-surface);
        border-radius: 8px;
        padding: 0.5rem 0.75rem;
        cursor: pointer;
        min-height: 2.75rem;
      }
      .pager button:disabled { opacity: 0.5; cursor: default; }
      @media (min-width: 641px) {
        .filter-block {
          width: 260px;
          flex: 0 0 260px;
        }
        .filter-block.narrow {
          width: 200px;
          flex: 0 0 200px;
        }
        .phone-sort { display: none; }
        .card-list { display: none; }
        .table-wrap {
          display: block;
          border: 0;
          overflow: visible;
          background: transparent;
        }
      }
    `,
  ],
})
export class RequestsPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly createRequestLink = buildCreateAbsenceRequestLink();
  readonly requestTypeLabel = requestTypeLabel;

  items: RequestListItemViewModel[] = [];
  departments: Department[] = [];
  positions: Position[] = [];
  statusGroup = '';
  type = '';
  departmentIds: string[] = [];
  positionId = '';
  page = 1;
  pageSize = 20;
  total = 0;
  loading = false;
  error = '';
  info = '';
  sortBy: RequestSortKey = 'createdAt';
  sortDir: 'asc' | 'desc' = 'desc';
  readonly typeKeys = Object.keys(ABSENCE_TYPE_LABELS);

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get departmentItems(): MultiSelectItem[] {
    return this.departments.map((d) => ({ id: d.id, label: d.name }));
  }

  ngOnInit(): void {
    const state = history.state as { deletedRequestId?: string } | null;
    if (state?.deletedRequestId) {
      this.info = 'Заявку видалено';
    }
    this.api.getDepartments(true).subscribe((d) => (this.departments = d));
    this.reloadPositions();
    this.load();
  }

  onDepartmentsChange(ids: string[]): void {
    this.departmentIds = ids;
    this.page = 1;
    this.reloadPositions(() => this.load());
  }

  onFilterChange(): void {
    this.page = 1;
    this.load();
  }

  onPhoneSortKey(key: RequestSortKey): void {
    this.sortBy = key;
    this.page = 1;
    this.load();
  }

  toggleSortDir(): void {
    this.sortDir = this.sortDir === 'desc' ? 'asc' : 'desc';
    this.page = 1;
    this.load();
  }

  toggleSort(key: RequestSortKey): void {
    if (this.sortBy === key) {
      this.sortDir = this.sortDir === 'desc' ? 'asc' : 'desc';
    } else {
      this.sortBy = key;
      this.sortDir = 'desc';
    }
    this.page = 1;
    this.load();
  }

  sortIndicator(key: RequestSortKey): string {
    if (this.sortBy !== key) {
      return '↕';
    }
    return this.sortDir === 'desc' ? '↓' : '↑';
  }

  private reloadPositions(after?: () => void): void {
    const request = this.departmentIds.length
      ? this.api.getPositions(this.departmentIds)
      : this.api.getPositions();
    request.subscribe((p) => {
      this.positions = p;
      if (this.positionId && !this.positions.some((x) => x.id === this.positionId)) {
        this.positionId = '';
      }
      after?.();
    });
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api
      .getRequests({
        page: this.page,
        pageSize: this.pageSize,
        statusGroup: this.statusGroup || undefined,
        type: this.type || undefined,
        departmentIds: this.departmentIds.length ? this.departmentIds : undefined,
        positionId: this.positionId || undefined,
        sortBy: this.sortBy,
        sortDir: this.sortDir,
      })
      .subscribe({
        next: (res) => {
          this.items = res.items.map((r) => toRequestListItemVm(r));
          this.total = res.total;
          this.loading = false;
        },
        error: () => {
          this.error = 'Не вдалося завантажити заявки';
          this.loading = false;
        },
      });
  }

  prev(): void {
    if (this.page > 1) {
      this.page -= 1;
      this.load();
    }
  }

  next(): void {
    if (this.page < this.totalPages) {
      this.page += 1;
      this.load();
    }
  }
}
