import { Component, OnInit, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api/api.service';
import { Department, Position } from '../core/api/models';
import { SessionStore } from '../../../core/auth/session.store';
import { canOpenEmployeeCreate } from '../../../shared/employees/can-open-employee-create';
import {
  MultiSelectItem,
  MultiSelectListComponent,
} from '../shared/multi-select-list.component';
import {
  EmployeeListItemViewModel,
  toEmployeeListItemVm,
} from './employee-list-item.vm';

type EmployeeSortKey =
  | 'fullName'
  | 'employeeNumber'
  | 'department'
  | 'position'
  | 'role'
  | 'status';

@Component({
  selector: 'app-employees-page',
  standalone: true,
  imports: [FormsModule, RouterLink, MultiSelectListComponent],
  template: `
    <section class="page pw-stage" data-help-id="absences.employees">
      <span class="pw-stage__glow" aria-hidden="true"></span>
      <header class="page-head pw-page-head pw-rise">
        <div>
          <p class="pw-eyebrow">Час і відсутність</p>
          <h1>Працівники</h1>
          <p class="pw-lead">Список анкет і пошук</p>
        </div>
        @if (canOpenCreate()) {
          <a class="btn pw-btn" routerLink="/people/new" data-help-id="absences.employees.add">
            Додати працівника
          </a>
        }
      </header>

      <div class="filters pw-panel pw-filters pw-rise" style="--pw-delay: 80ms" data-help-id="absences.employees.filters">
        <input [(ngModel)]="q" (ngModelChange)="load()" placeholder="Пошук ПІБ / номер / email" />
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
          <select [(ngModel)]="positionId" (ngModelChange)="load()">
            <option value="">Усі посади</option>
            @for (p of positions; track p.id) {
              <option [value]="p.id">{{ p.name }}</option>
            }
          </select>
        </label>
        <label class="filter-block narrow phone-sort">
          <span>Сортування</span>
          <select [ngModel]="sortBy" (ngModelChange)="onPhoneSortKey($event)">
            <option value="fullName">ПІБ</option>
            <option value="employeeNumber">Номер</option>
            <option value="department">Відділ</option>
            <option value="position">Посада</option>
            <option value="role">Роль</option>
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

      <ul class="card-list" aria-label="Працівники">
        @for (e of items; track e.id) {
          <li class="employee-card">
            <a class="card-link" [routerLink]="e.detailLink">
              <span class="swatch" [style.background]="e.calendarColor" aria-hidden="true"></span>
              <span class="card-body">
                <strong class="card-title">{{ e.fullName }}</strong>
                <span class="card-meta">{{ e.employeeNumber }} · {{ e.statusLabel }}</span>
                <span class="card-meta">{{ e.departmentName }} · {{ e.positionName }}</span>
                <span class="card-meta">{{ e.roleLabel }}</span>
              </span>
            </a>
          </li>
        }
      </ul>

      <div class="table-wrap list-shell pw-rise" style="--pw-delay: 140ms">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>
                <button type="button" class="sort-btn" (click)="toggleSort('fullName')">
                  ПІБ <span class="sort-ind" [class.active]="sortBy === 'fullName'">{{ sortIndicator('fullName') }}</span>
                </button>
              </th>
              <th>
                <button type="button" class="sort-btn" (click)="toggleSort('employeeNumber')">
                  Номер <span class="sort-ind" [class.active]="sortBy === 'employeeNumber'">{{ sortIndicator('employeeNumber') }}</span>
                </button>
              </th>
              <th>
                <button type="button" class="sort-btn" (click)="toggleSort('department')">
                  Відділ <span class="sort-ind" [class.active]="sortBy === 'department'">{{ sortIndicator('department') }}</span>
                </button>
              </th>
              <th>
                <button type="button" class="sort-btn" (click)="toggleSort('position')">
                  Посада <span class="sort-ind" [class.active]="sortBy === 'position'">{{ sortIndicator('position') }}</span>
                </button>
              </th>
              <th>
                <button type="button" class="sort-btn" (click)="toggleSort('role')">
                  Роль <span class="sort-ind" [class.active]="sortBy === 'role'">{{ sortIndicator('role') }}</span>
                </button>
              </th>
              <th>
                <button type="button" class="sort-btn" (click)="toggleSort('status')">
                  Статус <span class="sort-ind" [class.active]="sortBy === 'status'">{{ sortIndicator('status') }}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            @for (e of items; track e.id) {
              <tr
                class="row-link"
                tabindex="0"
                role="link"
                [attr.aria-label]="e.fullName"
                (click)="open(e)"
                (keydown.enter)="open(e)"
                (keydown.space)="$event.preventDefault(); open(e)"
              >
                <td><span class="swatch" [style.background]="e.calendarColor"></span></td>
                <td>
                  <a class="row-name" [routerLink]="e.detailLink" (click)="$event.stopPropagation()">{{
                    e.fullName
                  }}</a>
                </td>
                <td>{{ e.employeeNumber }}</td>
                <td>{{ e.departmentName }}</td>
                <td>{{ e.positionName }}</td>
                <td>{{ e.roleLabel }}</td>
                <td>{{ e.statusLabel }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (!loading && items.length === 0) {
        <p class="empty">Працівників не знайдено</p>
      }
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
        position: relative;
        z-index: 4;
        isolation: isolate;
        overflow: visible;
      }
      .filter-block {
        display: grid;
        gap: 0.35rem;
        font-size: 0.9rem;
        color: var(--pw-text);
        width: 100%;
        flex: 1 1 100%;
        min-width: 0;
        overflow: visible;
        position: relative;
      }
      .filter-block.narrow { width: 100%; flex: 1 1 100%; }
      .filters > input {
        width: 100%;
        flex: 1 1 100%;
        align-self: end;
      }
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
      input, select {
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
      .employee-card {
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        background: var(--pw-surface);
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
        gap: 0.2rem;
        min-width: 0;
      }
      .card-title {
        overflow-wrap: anywhere;
      }
      .card-meta {
        color: var(--pw-muted);
        font-size: 0.9rem;
        overflow-wrap: anywhere;
      }
      .table-wrap { display: none; }
      table { width: 100%; border-collapse: collapse; background: var(--pw-surface); }
      th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid var(--pw-border); }
      .sort-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
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
      .sort-btn:hover { color: var(--pw-accent); }
      .sort-ind {
        min-width: 1rem;
        color: var(--pw-muted);
        font-weight: 500;
      }
      .sort-btn:hover .sort-ind,
      .sort-ind.active { color: var(--pw-accent); }
      .row-link { cursor: pointer; }
      .row-link:hover { background: var(--pw-surface-2); }
      .row-name {
        color: inherit;
        text-decoration: none;
        font-weight: 600;
      }
      .row-name:hover {
        color: var(--pw-accent);
        text-decoration: underline;
      }
      .swatch {
        display: inline-block;
        width: 14px;
        height: 14px;
        border-radius: 4px;
        border: 1px solid var(--pw-border);
        flex-shrink: 0;
        margin-top: 0.25rem;
      }
      .error { color: var(--pw-danger); }
      .empty { padding: 1rem; color: var(--pw-muted); }
      @media (min-width: 641px) {
        .filter-block {
          width: 260px;
          flex: 0 0 260px;
        }
        .filter-block.narrow {
          width: 200px;
          flex: 0 0 200px;
        }
        .filters > input {
          width: 260px;
          flex: 0 0 260px;
        }
        .phone-sort { display: none; }
        .card-list { display: none; }
        .table-wrap {
          display: block;
          position: relative;
          z-index: 0;
          isolation: isolate;
          border: 1px solid var(--pw-border);
          border-radius: 12px;
          overflow: hidden;
          background: var(--pw-surface);
        }
      }
    `,
  ],
})
export class EmployeesPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  items: EmployeeListItemViewModel[] = [];
  departments: Department[] = [];
  positions: Position[] = [];
  q = '';
  departmentIds: string[] = [];
  positionId = '';
  sortBy: EmployeeSortKey = 'fullName';
  sortDir: 'asc' | 'desc' = 'asc';
  loading = false;
  error = '';

  readonly canOpenCreate = computed(() => canOpenEmployeeCreate(this.session));

  get departmentItems(): MultiSelectItem[] {
    return this.departments.map((d) => ({ id: d.id, label: d.name }));
  }

  open(e: EmployeeListItemViewModel): void {
    void this.router.navigate(e.detailLink);
  }

  ngOnInit(): void {
    this.api.getDepartments(true).subscribe((d) => (this.departments = d));
    this.reloadPositions();
    this.load();
  }

  onDepartmentsChange(ids: string[]): void {
    this.departmentIds = ids;
    this.reloadPositions(() => this.load());
  }

  onPhoneSortKey(key: EmployeeSortKey): void {
    this.sortBy = key;
    this.load();
  }

  toggleSortDir(): void {
    this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    this.load();
  }

  toggleSort(key: EmployeeSortKey): void {
    if (this.sortBy === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = key;
      this.sortDir = 'asc';
    }
    this.load();
  }

  sortIndicator(key: EmployeeSortKey): string {
    if (this.sortBy !== key) {
      return '↕';
    }
    return this.sortDir === 'asc' ? '↑' : '↓';
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
      .getEmployees({
        q: this.q || undefined,
        departmentIds: this.departmentIds.length ? this.departmentIds : undefined,
        positionId: this.positionId || undefined,
        sortBy: this.sortBy,
        sortDir: this.sortDir,
      })
      .subscribe({
        next: (rows) => {
          this.items = rows.map((e) => toEmployeeListItemVm(e));
          this.loading = false;
        },
        error: () => {
          this.error = 'Не вдалося завантажити список';
          this.loading = false;
        },
      });
  }
}
