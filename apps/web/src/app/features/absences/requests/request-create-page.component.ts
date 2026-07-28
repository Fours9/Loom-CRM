import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { concatMap, from, of, catchError, finalize, toArray } from 'rxjs';
import { ApiService } from '../core/api/api.service';
import { AuthService } from '../core/auth/auth.service';
import { AbsenceType, Department, EmployeeListItem, Position, ScheduleDay, TimeEventTypeMetadata } from '../core/api/models';
import { ABSENCE_TYPE_LABELS, roleDisplayLabel } from '../core/api/labels';
import { requestTypeLabel } from '../core/api/request-view.util';
import {
  MultiSelectItem,
  MultiSelectListComponent,
} from '../shared/multi-select-list.component';
import {
  shiftBoundsForDate,
  timeOptionsInShift,
} from '../core/schedule/work-time.util';
import {
  parseCreateAbsenceRequestPrefill,
  type CreateAbsenceRequestPrefill,
} from './create-request-navigation';

const MAX_PENDING_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

type TargetMode = 'self' | 'other';
type EmployeeSortKey =
  | 'fullName'
  | 'employeeNumber'
  | 'department'
  | 'position'
  | 'role'
  | 'status';

@Component({
  selector: 'app-request-create-page',
  standalone: true,
  imports: [FormsModule, RouterLink, MultiSelectListComponent],
  template: `
    <section class="page">
      <div class="sheet">
        <header class="page-head">
          <p><a routerLink="/absences/requests">← До списку</a></p>
          <h1>Нова заявка</h1>
        </header>

        <form class="form" (ngSubmit)="submit()">
          @if (canPickEmployee) {
            <fieldset class="target">
              <legend>За кого подати</legend>
              <label class="radio">
                <input
                  type="radio"
                  name="targetMode"
                  value="self"
                  [(ngModel)]="targetMode"
                  (ngModelChange)="onTargetModeChange()"
                />
                Я
              </label>
              <label class="radio">
                <input
                  type="radio"
                  name="targetMode"
                  value="other"
                  [(ngModel)]="targetMode"
                  (ngModelChange)="onTargetModeChange()"
                />
                Інший працівник
              </label>
            </fieldset>

            @if (targetMode === 'other') {
              <div class="picker">
                <div class="filters">
                  <input
                    [(ngModel)]="q"
                    name="q"
                    (ngModelChange)="loadEmployees()"
                    placeholder="Пошук ПІБ / номер / email"
                  />
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
                    <select [(ngModel)]="positionId" name="positionId" (ngModelChange)="loadEmployees()">
                      <option value="">Усі посади</option>
                      @for (p of positions; track p.id) {
                        <option [value]="p.id">{{ p.name }}</option>
                      }
                    </select>
                  </label>
                </div>

                <div class="picker-cards" role="radiogroup" aria-label="Працівник">
                  @for (e of employees; track e.id) {
                    <div class="picker-card">
                      <input
                        type="radio"
                        class="pw-visually-hidden"
                        name="employeePick"
                        [id]="'emp-pick-' + e.id"
                        [value]="e.id"
                        [checked]="employeeId === e.id"
                        (change)="selectEmployee(e)"
                      />
                      <label class="picker-label" [for]="'emp-pick-' + e.id">
                        <span class="swatch" [style.background]="e.calendarColor" aria-hidden="true"></span>
                        <span class="picker-body">
                          <strong>{{ e.fullName }}</strong>
                          <span class="muted">{{ e.employeeNumber }} · {{ e.departmentName }}</span>
                          <span class="muted">{{ e.positionName }} · {{ roleLabel(e.role, e.isDepartmentManager) }}</span>
                        </span>
                      </label>
                    </div>
                  }
                  @if (!employeesLoading && employees.length === 0) {
                    <p class="empty">Працівників не знайдено</p>
                  }
                </div>

                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th></th>
                        <th>
                          <button type="button" class="sort-btn" (click)="toggleSort('fullName')">
                            ПІБ <span class="sort-ind">{{ sortIndicator('fullName') }}</span>
                          </button>
                        </th>
                        <th>
                          <button type="button" class="sort-btn" (click)="toggleSort('employeeNumber')">
                            Номер <span class="sort-ind">{{ sortIndicator('employeeNumber') }}</span>
                          </button>
                        </th>
                        <th>
                          <button type="button" class="sort-btn" (click)="toggleSort('department')">
                            Відділ <span class="sort-ind">{{ sortIndicator('department') }}</span>
                          </button>
                        </th>
                        <th>
                          <button type="button" class="sort-btn" (click)="toggleSort('position')">
                            Посада <span class="sort-ind">{{ sortIndicator('position') }}</span>
                          </button>
                        </th>
                        <th>
                          <button type="button" class="sort-btn" (click)="toggleSort('role')">
                            Роль <span class="sort-ind">{{ sortIndicator('role') }}</span>
                          </button>
                        </th>
                        <th>
                          <button type="button" class="sort-btn" (click)="toggleSort('status')">
                            Статус <span class="sort-ind">{{ sortIndicator('status') }}</span>
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (e of employees; track e.id) {
                        <tr
                          class="row-link"
                          [class.active]="employeeId === e.id"
                          (click)="selectEmployee(e)"
                        >
                          <td><span class="swatch" [style.background]="e.calendarColor"></span></td>
                          <td>{{ e.fullName }}</td>
                          <td>{{ e.employeeNumber }}</td>
                          <td>{{ e.departmentName }}</td>
                          <td>{{ e.positionName }}</td>
                          <td>{{ roleLabel(e.role, e.isDepartmentManager) }}</td>
                          <td>{{ accountStatusLabel(e) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                  @if (!employeesLoading && employees.length === 0) {
                    <p class="empty">Працівників не знайдено</p>
                  }
                </div>

                @if (selectedEmployee) {
                  <div class="employee-preview">
                    <header class="hero">
                      <span class="swatch-lg" [style.background]="selectedEmployee.calendarColor"></span>
                      <div>
                        <h2>{{ selectedEmployee.fullName }}</h2>
                        <p>
                          #{{ selectedEmployee.employeeNumber }}
                          · {{ selectedEmployee.departmentName || '—' }}
                          · {{ selectedEmployee.positionName || '—' }}
                        </p>
                      </div>
                    </header>
                    <article class="anketa">
                      <h3>Анкета</h3>
                      <p><strong>ПІБ:</strong> {{ selectedEmployee.fullName }}</p>
                      <p><strong>Номер:</strong> {{ selectedEmployee.employeeNumber }}</p>
                      <p class="color-line">
                        <strong>Колір:</strong>
                        <span class="swatch" [style.background]="selectedEmployee.calendarColor"></span>
                        <span>{{ selectedEmployee.calendarColor }}</span>
                      </p>
                      <p>
                        <strong>Відділ / посада:</strong>
                        {{ selectedEmployee.departmentName || '—' }}
                        · {{ selectedEmployee.positionName || '—' }}
                      </p>
                      <p><strong>Роль:</strong> {{ roleLabel(selectedEmployee.role, selectedEmployee.isDepartmentManager) }}</p>
                      <p>
                        <strong>Статус:</strong>
                        {{ accountStatusLabel(selectedEmployee) }}
                      </p>
                    </article>
                  </div>
                }
              </div>
            }
          }

          <label>
            <span>Тип</span>
            <select [(ngModel)]="type" name="type" (ngModelChange)="onTypeChange()">
              @for (group of typeGroups; track group.category) {
                <optgroup [label]="group.label">
                  @for (t of group.types; track t.value) {
                    <option [value]="t.value">{{ t.label }}</option>
                  }
                </optgroup>
              }
            </select>
          </label>

          <div class="dates-block">
            <div class="row">
              <label>
                <span>Дата початку</span>
                <input
                  type="date"
                  [(ngModel)]="startDate"
                  name="startDate"
                  required
                  (ngModelChange)="onStartDateChange()"
                />
              </label>
              @if (showsEndDate) {
                <label>
                  <span>Дата кінця</span>
                  <input type="date" [(ngModel)]="endDate" name="endDate" required />
                </label>
              }
            </div>

            @if (startDate) {
              <div class="period-block">
                <span class="period-text">{{ periodText() }}</span>
                <div class="mini-cals">
                  @for (month of periodCalendars(); track month.key) {
                    <div class="mini-cal">
                      <div class="mini-cal-title">{{ month.title }}</div>
                      <div class="mini-cal-weekdays">
                        @for (d of weekdays; track d) {
                          <span>{{ d }}</span>
                        }
                      </div>
                      <div class="mini-cal-grid">
                        @for (day of month.days; track $index) {
                          <span
                            class="mini-cal-day"
                            [class.out]="!day.inMonth"
                            [class.selected]="day.selected"
                            [class.range-start]="day.isStart"
                            [class.range-end]="day.isEnd"
                            [style.--mark]="calendarMarkColor"
                          >{{ day.inMonth ? day.day : '' }}</span>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          @if (showsTimeFields) {
            <div class="row">
              <label>
                <span>Час з</span>
                @if (usesShiftTimeOptions) {
                  <select
                    [(ngModel)]="absenceStartTime"
                    name="absenceStartTime"
                    [required]="timeRequired"
                    [disabled]="!shiftBounds"
                    (ngModelChange)="onStartTimeChange()"
                  >
                    <option value="">Оберіть</option>
                    @for (t of startTimeOptions; track t) {
                      <option [value]="t">{{ t }}</option>
                    }
                  </select>
                } @else {
                  <select
                    [(ngModel)]="absenceStartTime"
                    name="absenceStartTime"
                    [required]="timeRequired"
                    (ngModelChange)="onStartTimeChange()"
                  >
                    <option value="">Оберіть</option>
                    @for (t of freeTimeOptions; track t) {
                      <option [value]="t">{{ t }}</option>
                    }
                  </select>
                }
              </label>
              <label>
                <span>Час по</span>
                @if (usesShiftTimeOptions) {
                  <select
                    [(ngModel)]="absenceEndTime"
                    name="absenceEndTime"
                    [required]="timeRequired"
                    [disabled]="!shiftBounds || !absenceStartTime"
                  >
                    <option value="">Оберіть</option>
                    @for (t of endTimeOptions; track t) {
                      <option [value]="t">{{ t }}</option>
                    }
                  </select>
                } @else {
                  <select
                    [(ngModel)]="absenceEndTime"
                    name="absenceEndTime"
                    [required]="timeRequired"
                    [disabled]="!absenceStartTime"
                  >
                    <option value="">Оберіть</option>
                    @for (t of freeEndTimeOptions; track t) {
                      <option [value]="t">{{ t }}</option>
                    }
                  </select>
                }
              </label>
            </div>
            @if (usesShiftTimeOptions && startDate && !scheduleLoading && !shiftBounds) {
              <p class="error">Обрана дата не є робочим днем у графіку працівника — оберіть іншу дату.</p>
            } @else if (usesShiftTimeOptions && shiftBounds) {
              <p class="hint">
                Доступний час зміни: {{ shiftBounds.start }}–{{ shiftBounds.end }}.
                Оберіть вікно всередині графіка (не всю зміну).
              </p>
            } @else if (type === 'extra_work_day') {
              <p class="hint">Лише у запланований вихідний. Час — за бажанням.</p>
            } @else if (type === 'overtime') {
              <p class="hint">Вкажіть інтервал у межах одного дня (без переходу через північ).</p>
            }
          }

          <label>
            <span>Причина (необовʼязково)</span>
            <textarea [(ngModel)]="reason" name="reason" rows="3"></textarea>
          </label>

          @if (supportsUnpaid) {
            <label class="check">
              <input type="checkbox" [(ngModel)]="isUnpaid" name="isUnpaid" />
              За власний рахунок
            </label>
          }

          <label>
            <span>Коментар</span>
            <textarea [(ngModel)]="employeeComment" name="employeeComment" rows="2"></textarea>
          </label>

          <div class="attachments-block">
            <span class="attachments-label">Вкладення (необовʼязково)</span>
            @if (pendingFiles.length) {
              <ul class="attachments">
                @for (file of pendingFiles; track $index) {
                  <li>
                    <span class="att-name" [title]="file.name">{{ file.name }}</span>
                    <button
                      type="button"
                      class="link-btn"
                      [disabled]="saving"
                      (click)="removePendingFile($index)"
                    >
                      Прибрати
                    </button>
                  </li>
                }
              </ul>
            }
            @if (pendingFiles.length < maxPendingAttachments) {
              <label class="file">
                <span>Додати файл (PDF/JPG/PNG, до 10 МБ, макс. {{ maxPendingAttachments }})</span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  [disabled]="saving"
                  (change)="onPendingFile($event)"
                />
              </label>
            } @else {
              <p class="hint">Досягнуто ліміт у {{ maxPendingAttachments }} вкладень</p>
            }
          </div>

          @if (error) {
            <p class="error">{{ error }}</p>
          }

          <div class="pw-form-actions">
            <button class="btn" type="submit" [disabled]="saving">Подати</button>
          </div>
        </form>
      </div>
    </section>
  `,
  styles: [
    `
      .page {
        display: flex;
        justify-content: center;
        padding: 0 0 2rem;
      }
      .sheet {
        width: min(100%, 920px);
        display: grid;
        gap: 1rem;
      }
      .page-head h1 { margin: 0.25rem 0 0; }
      .page-head p { margin: 0; }
      .page-head a { color: var(--pw-accent); text-decoration: none; }
      .form {
        display: grid;
        gap: 0.85rem;
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        padding: 1.25rem;
      }
      label { display: grid; gap: 0.35rem; font-size: 0.9rem; color: var(--pw-text); }
      .row { display: grid; grid-template-columns: 1fr; gap: 0.75rem; }
      input, select, textarea {
        padding: 0.55rem 0.7rem;
        border: 1px solid var(--pw-border-strong);
        border-radius: 8px;
        width: 100%;
        box-sizing: border-box;
      }
      .check {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        font-size: 1.1rem;
        font-weight: 700;
        margin: 0.15rem 0;
        padding: 0.85rem 0;
        border-top: 1px solid color-mix(in srgb, var(--pw-muted) 55%, transparent);
        border-bottom: 1px solid color-mix(in srgb, var(--pw-muted) 55%, transparent);
      }
      .check input {
        width: 1.25rem;
        height: 1.25rem;
        flex-shrink: 0;
        accent-color: var(--pw-accent);
      }
      .btn {
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        border: 0;
        border-radius: 8px;
        padding: 0.7rem 1rem;
        cursor: pointer;
      }
      .btn:disabled { opacity: 0.6; }
      @media (min-width: 641px) {
        .pw-form-actions .btn {
          width: auto;
        }
      }
      .error { color: var(--pw-danger); margin: 0; }
      .hint { margin: 0; color: var(--pw-muted); font-size: 0.85rem; }
      .attachments-block { display: grid; gap: 0.5rem; }
      .attachments-label { font-size: 0.9rem; color: var(--pw-text); }
      .attachments { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.4rem; }
      .attachments li {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-width: 0;
      }
      .att-name {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.9rem;
      }
      .link-btn {
        flex: 0 0 auto;
        border: 0;
        background: transparent;
        color: var(--pw-accent);
        cursor: pointer;
        padding: 0;
        font-size: 0.85rem;
      }
      .link-btn:disabled { opacity: 0.6; cursor: default; }
      .file { display: grid; gap: 0.35rem; }
      .target {
        border: 1px solid var(--pw-border);
        border-radius: 10px;
        padding: 0.75rem 1rem;
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        align-items: center;
      }
      .target legend { padding: 0 0.35rem; color: var(--pw-text); font-weight: 600; }
      .radio { display: flex; align-items: center; gap: 0.45rem; margin: 0; }
      .radio input { width: auto; }
      .picker { display: grid; gap: 0.75rem; }
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: end;
      }
      .filters > input {
        width: 100%;
        flex: 1 1 100%;
        align-self: end;
      }
      .filter-block {
        display: grid;
        gap: 0.35rem;
        font-size: 0.85rem;
        color: var(--pw-text);
        width: 100%;
        flex: 1 1 100%;
        min-width: 0;
      }
      .filter-block.narrow {
        width: 100%;
        flex: 1 1 100%;
      }
      .picker-cards {
        display: grid;
        gap: 0.5rem;
        max-height: 280px;
        overflow: auto;
      }
      .picker-card {
        border: 1px solid var(--pw-border);
        border-radius: 10px;
        background: var(--pw-surface);
      }
      .picker-card:has(input:checked) {
        border-color: var(--pw-accent);
        background: var(--pw-accent-soft);
      }
      .picker-label {
        display: flex;
        gap: 0.65rem;
        align-items: flex-start;
        padding: 0.75rem;
        cursor: pointer;
        min-width: 0;
      }
      .picker-body {
        display: grid;
        gap: 0.15rem;
        min-width: 0;
      }
      .picker-body strong { overflow-wrap: anywhere; }
      .picker-body .muted {
        color: var(--pw-muted);
        font-size: 0.85rem;
        overflow-wrap: anywhere;
      }
      .table-wrap {
        display: none;
        border: 1px solid var(--pw-border);
        border-radius: 10px;
        overflow: auto;
        max-height: 280px;
        background: var(--pw-surface);
      }
      table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
      th, td {
        text-align: left;
        padding: 0.45rem 0.55rem;
        border-bottom: 1px solid var(--pw-border);
        white-space: nowrap;
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
      }
      .sort-ind { color: var(--pw-muted); font-weight: 500; }
      .row-link { cursor: pointer; }
      .row-link:hover { background: var(--pw-surface-2); }
      .row-link.active { background: var(--pw-accent-soft); }
      .swatch {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 3px;
        border: 1px solid var(--pw-border);
        vertical-align: middle;
      }
      .empty { padding: 0.75rem; color: var(--pw-muted); margin: 0; }
      .employee-preview { display: grid; gap: 0.75rem; }
      .hero {
        display: flex;
        gap: 1rem;
        align-items: center;
      }
      .hero h2 { margin: 0; font-size: 1.2rem; }
      .hero p { margin: 0.25rem 0 0; color: var(--pw-muted); }
      .swatch-lg {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        flex-shrink: 0;
      }
      .anketa {
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        padding: 1rem;
        display: grid;
        gap: 0.5rem;
        background: var(--pw-surface-2);
      }
      .anketa h3 { margin: 0; font-size: 1.05rem; }
      .anketa > p { margin: 0; }
      .color-line {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.45rem;
      }
      .dates-block { display: grid; gap: 0.65rem; }
      .period-block { display: grid; gap: 0.45rem; }
      .period-text { color: var(--pw-text); font-size: 0.95rem; }
      .mini-cals {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }
      .mini-cal {
        width: 168px;
        border: 1px solid var(--pw-border);
        border-radius: 10px;
        padding: 0.5rem;
        background: var(--pw-surface-2);
      }
      .mini-cal-title {
        text-align: center;
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--pw-accent);
        margin-bottom: 0.35rem;
        text-transform: capitalize;
      }
      .mini-cal-weekdays,
      .mini-cal-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
      }
      .mini-cal-weekdays span {
        text-align: center;
        font-size: 0.62rem;
        color: var(--pw-muted);
        font-weight: 600;
      }
      .mini-cal-day {
        aspect-ratio: 1;
        display: grid;
        place-items: center;
        font-size: 0.68rem;
        border-radius: 5px;
        color: var(--pw-text);
      }
      .mini-cal-day.out { color: transparent; }
      .mini-cal-day.selected {
        background: color-mix(in srgb, var(--mark, var(--pw-accent)) 28%, var(--pw-surface));
        color: var(--pw-text-strong);
        font-weight: 600;
      }
      .mini-cal-day.range-start,
      .mini-cal-day.range-end {
        background: var(--mark, var(--pw-accent));
        color: var(--pw-on-accent);
      }
      @media (min-width: 641px) {
        .row { grid-template-columns: 1fr 1fr; }
        .filters > input {
          width: 220px;
          flex: 0 0 220px;
        }
        .filter-block {
          width: 220px;
          flex: 0 0 220px;
        }
        .filter-block.narrow {
          width: 180px;
          flex: 0 0 180px;
        }
        .picker-cards { display: none; }
        .table-wrap { display: block; }
      }
    `,
  ],
})
export class RequestCreatePageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly requestTypeLabel = requestTypeLabel;
  typeMetadata: TimeEventTypeMetadata[] = [];
  employees: EmployeeListItem[] = [];
  departments: Department[] = [];
  positions: Position[] = [];
  selectedEmployee: EmployeeListItem | null = null;
  targetMode: TargetMode = 'self';
  employeeId = '';
  q = '';
  departmentIds: string[] = [];
  positionId = '';
  sortBy: EmployeeSortKey = 'fullName';
  sortDir: 'asc' | 'desc' = 'asc';
  employeesLoading = false;
  type: AbsenceType = 'vacation';
  startDate = '';
  endDate = '';
  absenceStartTime = '';
  absenceEndTime = '';
  reason = '';
  isUnpaid = false;
  employeeComment = '';
  pendingFiles: File[] = [];
  readonly maxPendingAttachments = MAX_PENDING_ATTACHMENTS;
  saving = false;
  error = '';
  schedule: ScheduleDay[] = [];
  scheduleLoading = false;
  readonly freeTimeOptions = buildQuarterHourOptions();
  readonly weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  private readonly monthNames = [
    'січень',
    'лютий',
    'березень',
    'квітень',
    'травень',
    'червень',
    'липень',
    'серпень',
    'вересень',
    'жовтень',
    'листопад',
    'грудень',
  ];

  get typeGroups(): Array<{ category: string; label: string; types: TimeEventTypeMetadata[] }> {
    const types =
      this.typeMetadata.length > 0
        ? this.typeMetadata
        : fallbackTypeMetadata();
    return [
      {
        category: 'absence',
        label: 'Відсутності',
        types: types.filter((t) => t.category === 'absence'),
      },
      {
        category: 'work',
        label: 'Робота',
        types: types.filter((t) => t.category === 'work'),
      },
    ].filter((g) => g.types.length > 0);
  }

  get selectedTypeMeta(): TimeEventTypeMetadata | null {
    const types =
      this.typeMetadata.length > 0
        ? this.typeMetadata
        : fallbackTypeMetadata();
    return types.find((t) => t.value === this.type) ?? null;
  }

  get canPickEmployee(): boolean {
    return this.auth.isAdmin() || this.auth.isManager();
  }

  /** @deprecated Prefer showsEndDate from metadata.dateMode */
  get isFullDay(): boolean {
    return this.showsEndDate;
  }

  get showsEndDate(): boolean {
    return (this.selectedTypeMeta?.dateMode ?? 'date_range') === 'date_range';
  }

  get showsTimeFields(): boolean {
    const mode = this.selectedTypeMeta?.timeMode ?? 'none';
    return mode === 'required' || mode === 'optional';
  }

  get timeRequired(): boolean {
    return this.selectedTypeMeta?.timeMode === 'required';
  }

  get usesShiftTimeOptions(): boolean {
    return this.type === 'part_time';
  }

  get supportsUnpaid(): boolean {
    return this.selectedTypeMeta?.supportsUnpaid === true;
  }

  get freeEndTimeOptions(): string[] {
    if (!this.absenceStartTime) return this.freeTimeOptions;
    return this.freeTimeOptions.filter((t) => t > this.absenceStartTime);
  }

  get departmentItems(): MultiSelectItem[] {
    return this.departments.map((d) => ({ id: d.id, label: d.name }));
  }

  get calendarMarkColor(): string {
    return this.selectedEmployee?.calendarColor || 'var(--pw-accent)';
  }

  get targetEmployeeId(): string | null {
    if (this.canPickEmployee && this.targetMode === 'other') {
      return this.employeeId || null;
    }
    return this.auth.user()?.employeeId ?? null;
  }

  get shiftBounds(): { start: string; end: string } | null {
    return shiftBoundsForDate(this.schedule, this.startDate);
  }

  get startTimeOptions(): string[] {
    const bounds = this.shiftBounds;
    if (!bounds) return [];
    return timeOptionsInShift(bounds.start, bounds.end).filter((t) => t < bounds.end);
  }

  get endTimeOptions(): string[] {
    const bounds = this.shiftBounds;
    if (!bounds || !this.absenceStartTime) return [];
    return timeOptionsInShift(bounds.start, bounds.end).filter((t) => t > this.absenceStartTime);
  }

  ngOnInit(): void {
    const prefill = parseCreateAbsenceRequestPrefill(this.route.snapshot.queryParamMap);

    this.api.getAbsenceMetadata().subscribe({
      next: (meta) => {
        this.typeMetadata = meta.types ?? [];
        if (!this.typeMetadata.some((t) => t.value === this.type) && this.typeMetadata[0]) {
          this.type = this.typeMetadata[0].value;
        }
      },
    });

    if (this.canPickEmployee) {
      this.api
        .getDepartments(true)
        .subscribe((d) => (this.departments = d.filter((x) => x.isActive)));
      this.reloadPositions();
    }

    this.applyNavigationPrefill(prefill);
    this.reloadSchedule();
  }

  private applyNavigationPrefill(prefill: CreateAbsenceRequestPrefill): void {
    if (prefill.startDate) {
      this.startDate = prefill.startDate;
      this.onStartDateChange();
    }

    if (
      prefill.employeeId &&
      prefill.employeeId !== this.auth.user()?.employeeId &&
      this.canPickEmployee
    ) {
      this.targetMode = 'other';
      this.employeeId = prefill.employeeId;
      this.loadEmployees();
    }
  }

  onTargetModeChange(): void {
    this.error = '';
    if (this.targetMode === 'self') {
      this.employeeId = '';
      this.selectedEmployee = null;
      this.employees = [];
      this.reloadSchedule();
      return;
    }
    this.schedule = [];
    this.clearTimes();
    this.loadEmployees();
  }

  onDepartmentsChange(ids: string[]): void {
    this.departmentIds = ids;
    this.reloadPositions(() => this.loadEmployees());
  }

  loadEmployees(): void {
    this.employeesLoading = true;
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
          this.employees = rows;
          this.employeesLoading = false;
          if (this.employeeId && !rows.some((e) => e.id === this.employeeId)) {
            this.employeeId = '';
            this.selectedEmployee = null;
          } else if (this.employeeId) {
            this.selectedEmployee =
              rows.find((e) => e.id === this.employeeId) ?? this.selectedEmployee;
          }
        },
        error: () => {
          this.employeesLoading = false;
          this.error = 'Не вдалося завантажити список працівників';
        },
      });
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

  toggleSort(key: EmployeeSortKey): void {
    if (this.sortBy === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = key;
      this.sortDir = 'asc';
    }
    this.loadEmployees();
  }

  sortIndicator(key: EmployeeSortKey): string {
    if (this.sortBy !== key) {
      return '↕';
    }
    return this.sortDir === 'asc' ? '↑' : '↓';
  }

  selectEmployee(employee: EmployeeListItem): void {
    this.employeeId = employee.id;
    this.selectedEmployee = employee;
    this.error = '';
    this.reloadSchedule();
  }

  onTypeChange(): void {
    if (!this.showsEndDate) {
      this.endDate = this.startDate;
    }
    if (!this.showsTimeFields) {
      this.clearTimes();
    }
    if (!this.supportsUnpaid) {
      this.isUnpaid = false;
    }
  }

  onStartDateChange(): void {
    if (!this.showsEndDate) {
      this.endDate = this.startDate;
    }
    this.sanitizeTimesForShift();
  }

  onStartTimeChange(): void {
    if (this.absenceEndTime && this.absenceEndTime <= this.absenceStartTime) {
      this.absenceEndTime = '';
    }
  }

  private reloadSchedule(): void {
    const id = this.targetEmployeeId;
    if (!id) {
      this.schedule = [];
      this.clearTimes();
      return;
    }
    this.scheduleLoading = true;
    this.api.getSchedule(id).subscribe({
      next: (days) => {
        this.schedule = days;
        this.scheduleLoading = false;
        this.sanitizeTimesForShift();
      },
      error: () => {
        this.schedule = [];
        this.scheduleLoading = false;
        this.clearTimes();
      },
    });
  }

  private sanitizeTimesForShift(): void {
    if (!this.usesShiftTimeOptions) {
      return;
    }
    const bounds = this.shiftBounds;
    if (!bounds) {
      this.clearTimes();
      return;
    }
    if (
      !this.absenceStartTime ||
      this.absenceStartTime < bounds.start ||
      this.absenceStartTime >= bounds.end
    ) {
      this.absenceStartTime = '';
    }
    if (
      !this.absenceEndTime ||
      this.absenceEndTime <= this.absenceStartTime ||
      this.absenceEndTime > bounds.end
    ) {
      this.absenceEndTime = '';
    }
  }

  private clearTimes(): void {
    this.absenceStartTime = '';
    this.absenceEndTime = '';
  }

  periodText(): string {
    if (!this.startDate) {
      return '';
    }
    const end = this.showsEndDate ? this.endDate || this.startDate : this.startDate;
    let text = this.startDate === end ? this.startDate : `${this.startDate} — ${end}`;
    if (this.type === 'part_time' && (this.absenceStartTime || this.absenceEndTime)) {
      text += ` (${this.absenceStartTime || '…'}–${this.absenceEndTime || '…'})`;
    }
    return text;
  }

  periodCalendars(): Array<{
    key: string;
    title: string;
    days: Array<{ day: number; inMonth: boolean; selected: boolean; isStart: boolean; isEnd: boolean }>;
  }> {
    if (!this.startDate) {
      return [];
    }
    const endValue = this.showsEndDate ? this.endDate || this.startDate : this.startDate;
    const start = this.parseYmd(this.startDate);
    const end = this.parseYmd(endValue);
    if (!start || !end) {
      return [];
    }
    const startKey = this.ymdKey(start);
    const endKey = this.ymdKey(end);
    const months: Array<{ year: number; month: number }> = [];
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    let guard = 0;
    while (cursor <= last && guard < 6) {
      months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      guard += 1;
    }

    return months.map(({ year, month }) => {
      const first = new Date(year, month, 1);
      const offset = (first.getDay() + 6) % 7;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const cells: Array<{
        day: number;
        inMonth: boolean;
        selected: boolean;
        isStart: boolean;
        isEnd: boolean;
      }> = [];
      for (let i = 0; i < offset; i += 1) {
        cells.push({ day: 0, inMonth: false, selected: false, isStart: false, isEnd: false });
      }
      for (let day = 1; day <= daysInMonth; day += 1) {
        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const selected = key >= startKey && key <= endKey;
        cells.push({
          day,
          inMonth: true,
          selected,
          isStart: key === startKey,
          isEnd: key === endKey,
        });
      }
      while (cells.length % 7 !== 0) {
        cells.push({ day: 0, inMonth: false, selected: false, isStart: false, isEnd: false });
      }
      return {
        key: `${year}-${month}`,
        title: `${this.monthNames[month]} ${year}`,
        days: cells,
      };
    });
  }

  private parseYmd(value: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private ymdKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  roleLabel(role: string | null, isDepartmentManager?: boolean | null): string {
    return roleDisplayLabel(role, isDepartmentManager);
  }

  accountStatusLabel(e: { hasAccount: boolean; accountStatus?: string | null }): string {
    if (!e.hasAccount) return 'Без акаунта';
    return e.accountStatus === 'deactivated' ? 'Деактивований' : 'Активний';
  }

  onPendingFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (this.pendingFiles.length >= MAX_PENDING_ATTACHMENTS) {
      this.error = `Максимум ${MAX_PENDING_ATTACHMENTS} вкладень`;
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      this.error = 'Максимальний розмір файлу — 10 МБ';
      return;
    }
    if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) {
      this.error = 'Дозволено лише PDF, JPG, JPEG, PNG';
      return;
    }

    this.error = '';
    this.pendingFiles = [...this.pendingFiles, file];
  }

  removePendingFile(index: number): void {
    this.pendingFiles = this.pendingFiles.filter((_, i) => i !== index);
  }

  submit(): void {
    if (this.canPickEmployee && this.targetMode === 'other' && !this.employeeId) {
      this.error = 'Оберіть працівника зі списку';
      return;
    }
    if (this.canPickEmployee && this.targetMode === 'self' && !this.auth.user()?.employeeId) {
      this.error = 'У вашого акаунта немає анкети — оберіть іншого працівника';
      return;
    }
    if (this.type === 'part_time') {
      if (!this.shiftBounds) {
        this.error = 'Обрана дата не є робочим днем у графіку працівника';
        return;
      }
      if (!this.absenceStartTime || !this.absenceEndTime) {
        this.error = 'Оберіть час з і час по в межах графіка';
        return;
      }
      if (
        !this.startTimeOptions.includes(this.absenceStartTime) ||
        !this.endTimeOptions.includes(this.absenceEndTime)
      ) {
        this.error = 'Обраний час поза межами робочої зміни';
        return;
      }
    }
    if (this.timeRequired && (!this.absenceStartTime || !this.absenceEndTime)) {
      this.error = 'Оберіть час з і час по';
      return;
    }
    if (
      this.showsTimeFields &&
      ((this.absenceStartTime && !this.absenceEndTime) ||
        (!this.absenceStartTime && this.absenceEndTime))
    ) {
      this.error = 'Вкажіть обидва значення часу або залиште порожнім';
      return;
    }

    this.saving = true;
    this.error = '';
    const reason = this.reason.trim();
    const employeeComment = this.employeeComment.trim();
    this.api
      .createRequest({
        employeeId: this.targetMode === 'other' ? this.employeeId : undefined,
        type: this.type,
        startDate: this.startDate,
        endDate: this.showsEndDate ? this.endDate || this.startDate : this.startDate,
        absenceStartTime: this.showsTimeFields ? this.absenceStartTime || null : null,
        absenceEndTime: this.showsTimeFields ? this.absenceEndTime || null : null,
        ...(reason ? { reason } : {}),
        isUnpaid: this.supportsUnpaid ? this.isUnpaid : false,
        ...(employeeComment ? { employeeComment } : {}),
      })
      .subscribe({
        next: (created) => {
          const files = [...this.pendingFiles];
          if (!files.length) {
            this.saving = false;
            void this.router.navigate(['/absences/requests', created.id]);
            return;
          }

          from(files)
            .pipe(
              concatMap((file) =>
                this.api.uploadRequestAttachment(created.id, file).pipe(
                  catchError(() => of(null)),
                ),
              ),
              toArray(),
              finalize(() => {
                this.saving = false;
              }),
            )
            .subscribe({
              next: (results) => {
                const failed = results.filter((r) => r === null).length;
                void this.router.navigate(['/absences/requests', created.id], {
                  state: failed
                    ? {
                        flashError: `Заявку створено, але не вдалося завантажити ${failed} файл(ів). Додайте їх у режимі редагування.`,
                      }
                    : undefined,
                });
              },
            });
        },
        error: (err) => {
          this.saving = false;
          this.error = this.formatApiError(err?.error) || 'Не вдалося створити заявку';
        },
      });
  }

  private formatApiError(body: unknown): string {
    if (!body || typeof body !== 'object') {
      return '';
    }
    const err = body as {
      message?: string | string[] | { message?: string; code?: string };
      code?: string;
      conflicts?: Array<{
        type?: string;
        status?: string;
        startDate?: string;
        endDate?: string | null;
      }>;
    };

    if (
      err.code === 'TIME_EVENT_OVERLAP' ||
      err.code === 'OVERLAP' ||
      this.isOverlapMessage(err.message)
    ) {
      return this.formatOverlapError(err);
    }
    if (
      err.code === 'TIME_EVENT_SCHEDULE_REJECT' ||
      err.code === 'TIME_EVENT_TIME_REQUIRED' ||
      err.code === 'TIME_EVENT_UNPAID_UNSUPPORTED'
    ) {
      return typeof err.message === 'string'
        ? err.message
        : this.translateValidationMessage(String(err.code));
    }

    const raw = err.message;
    const parts = Array.isArray(raw)
      ? raw
      : typeof raw === 'string'
        ? [raw]
        : raw && typeof raw === 'object' && typeof raw.message === 'string'
          ? [raw.message]
          : [];
    if (!parts.length) {
      return err.code || '';
    }
    return parts.map((msg) => this.translateValidationMessage(String(msg))).join('; ');
  }

  private isOverlapMessage(message: unknown): boolean {
    if (typeof message === 'string') {
      return message.toLowerCase().includes('overlap');
    }
    if (message && typeof message === 'object' && 'message' in message) {
      return this.isOverlapMessage((message as { message?: unknown }).message);
    }
    return false;
  }

  private formatOverlapError(err: {
    message?: string | string[] | { message?: string };
    conflicts?: Array<{
      type?: string;
      status?: string;
      startDate?: string;
      endDate?: string | null;
    }>;
  }): string {
    if (typeof err.message === 'string' && /[а-яіїєґ]/i.test(err.message)) {
      return err.message;
    }
    const conflicts = err.conflicts ?? [];
    if (!conflicts.length) {
      return 'Період перетинається з уже наявною заявкою цього працівника';
    }
    const summary = conflicts
      .map((c) => {
        const type = ABSENCE_TYPE_LABELS[c.type ?? ''] ?? c.type ?? 'заявка';
        const end = c.endDate || c.startDate;
        const period =
          c.startDate && end && end !== c.startDate
            ? `${c.startDate}–${end}`
            : c.startDate || '';
        return period ? `${type} (${period})` : type;
      })
      .join('; ');
    return `Період перетинається з уже наявною заявкою: ${summary}`;
  }

  private translateValidationMessage(message: string): string {
    // Уже українською з API — показуємо як є
    if (/[а-яіїєґ]/i.test(message)) {
      return message;
    }
    const lower = message.toLowerCase();
    if (lower.includes('overlap')) {
      return 'Період перетинається з уже наявною заявкою цього працівника';
    }
    if (lower.includes('reason') && lower.includes('shorter')) {
      return 'Причина занадто довга (макс. 2000 символів)';
    }
    if (lower.includes('reason') && lower.includes('must be a string')) {
      return 'Причина має бути текстом';
    }
    if (lower.includes('employeecomment') && lower.includes('shorter')) {
      return 'Коментар занадто довгий (макс. 2000 символів)';
    }
    if (lower.includes('must be a uuid')) {
      return 'Некоректний ідентифікатор';
    }
    if (lower.includes('should not be empty')) {
      return 'Заповніть обовʼязкове поле';
    }
    if (lower.includes('must be a valid enum')) {
      return 'Невірний тип заявки';
    }
    if (lower.includes('must be a string')) {
      return 'Некоректне текстове значення';
    }
    if (lower.includes('must be shorter')) {
      return 'Текст занадто довгий';
    }
    return message;
  }
}

function buildQuarterHourOptions(): string[] {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return out;
}

function fallbackTypeMetadata(): TimeEventTypeMetadata[] {
  return (Object.keys(ABSENCE_TYPE_LABELS) as AbsenceType[]).map((value) => {
    const absence =
      value === 'day_off' ||
      value === 'vacation' ||
      value === 'sick_leave' ||
      value === 'part_time';
    return {
      value,
      label: ABSENCE_TYPE_LABELS[value] ?? value,
      category: absence ? 'absence' : 'work',
      dateMode:
        value === 'part_time' || value === 'overtime' || value === 'extra_work_day'
          ? 'single_day'
          : 'date_range',
      timeMode:
        value === 'part_time' || value === 'overtime'
          ? 'required'
          : value === 'extra_work_day'
            ? 'optional'
            : 'none',
      supportsUnpaid: value === 'day_off' || value === 'vacation',
      visualKind:
        value === 'part_time'
          ? 'partial_absence'
          : value === 'overtime' ||
              value === 'business_trip' ||
              value === 'extra_work_day'
            ? value
            : 'absence',
    };
  });
}
