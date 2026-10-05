import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, switchMap, of, catchError } from 'rxjs';
import { ApiService } from '../core/api/api.service';
import { TranslatePipe } from '../core/i18n/translate.pipe';
import { TranslateService } from '../core/i18n/translate.service';
import { ViewportService } from '../core/viewport/viewport.service';
import {
  AbsenceType,
  CalendarDayItem,
  CalendarDaySummary,
  CalendarLegendItem,
  CalendarQueryFilters,
  CalendarStatusGroup,
  CalendarViewMode,
  Department,
  EmployeeListItem,
} from '../core/api/models';
import { ABSENCE_TYPE_LABELS } from '../core/api/labels';
import { CalendarDayCellComponent } from './calendar-day-cell.component';
import { CalendarDayDrawerComponent } from './calendar-day-drawer.component';
import { CalendarListEventsComponent } from './calendar-list-events.component';
import { CalendarSegmentComponent } from './calendar-segment.component';
import {
  addDaysIso,
  endOfMonthIso,
  endOfWeekIso,
  enumerateIso,
  formatUkDayLabel,
  monthTitleUk,
  startOfMonthIso,
  startOfWeekIso,
  todayIsoLocal,
} from './calendar-date.util';

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    CalendarDayCellComponent,
    CalendarDayDrawerComponent,
    CalendarListEventsComponent,
    CalendarSegmentComponent,
  ],
  template: `
    <section class="page" [class.embedded]="embedded" data-help-id="absences.calendar">
      <div class="stage">
        <span class="stage__glow" aria-hidden="true"></span>
        <header class="top" [class.embedded]="embedded">
          @if (!embedded) {
            <div class="hero">
              <p class="eyebrow">Час і відсутність</p>
              <h1>Робочий календар</h1>
            </div>
          }
          <div class="nav-row" data-help-id="absences.calendar.nav">
            <button
              type="button"
              class="ghost nav-btn"
              [attr.aria-label]="'calendar.prev' | t"
              (click)="shift(-1)"
            >
              ←
            </button>
            <strong class="period">{{ periodTitle }}</strong>
            <button
              type="button"
              class="ghost nav-btn"
              [attr.aria-label]="'calendar.next' | t"
              (click)="shift(1)"
            >
              →
            </button>
            <button type="button" class="ghost today-btn" (click)="goToday()">
              {{ 'calendar.today' | t }}
            </button>
          </div>
          @if (legend.length) {
            <ul class="legend" aria-label="Легенда типів">
              @for (item of legend; track item.value) {
                <li>
                  <span class="legend-swatch" [attr.data-kind]="item.visualKind"></span>
                  {{ item.label }}
                </li>
              }
            </ul>
          }
        </header>

        <div class="toolbar">
          <div class="modes" #modesEl data-help-id="absences.calendar.modes" role="tablist">
            @for (m of modes; track m) {
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="viewMode === m"
                [class.active]="viewMode === m"
                (click)="setMode(m)"
              >
                {{ ('calendar.modes.' + m) | t }}
              </button>
            }
          </div>
          <div class="filters" data-help-id="absences.calendar.filters">
            @if (!isEmployeeOnly) {
              <label>
                {{ 'calendar.filters.department' | t }}
                <select [(ngModel)]="filterDepartmentId" (ngModelChange)="onDepartmentFilterChanged()">
                  <option value="">{{ 'calendar.filters.all' | t }}</option>
                  @for (d of departments; track d.id) {
                    <option [value]="d.id">{{ d.name }}</option>
                  }
                </select>
              </label>
              <label>
                {{ 'calendar.filters.employee' | t }}
                <select [(ngModel)]="filterEmployeeId" (ngModelChange)="onFiltersChanged()">
                  <option value="">{{ 'calendar.filters.all' | t }}</option>
                  @for (e of employees; track e.id) {
                    <option [value]="e.id">{{ e.lastName }} {{ e.firstName }}</option>
                  }
                </select>
              </label>
            }
            <label>
              {{ 'calendar.filters.type' | t }}
              <select [(ngModel)]="filterType" (ngModelChange)="onFiltersChanged()">
                <option value="">{{ 'calendar.filters.all' | t }}</option>
                @for (t of typeFilterOptions; track t.value) {
                  <option [value]="t.value">{{ t.label }}</option>
                }
              </select>
            </label>
            <label>
              {{ 'calendar.filters.status' | t }}
              <select [(ngModel)]="filterStatus" (ngModelChange)="onFiltersChanged()">
                <option value="">{{ 'calendar.filters.allVisible' | t }}</option>
                <option value="approved">Підтверджено</option>
                <option value="pending">Очікує</option>
              </select>
            </label>
          </div>
        </div>

        @if (rangeError) {
          <p class="error">{{ rangeError }}</p>
        }
        @if (rangeLoading) {
          <p class="muted status-line">{{ 'calendar.loading' | t }}</p>
        }

        @if (viewMode === 'month' || viewMode === 'week') {
          <div class="board">
            <div class="weekdays">
              @for (w of weekdays; track w) {
                <span>{{ w }}</span>
              }
            </div>
            <div class="grid" [class.week]="viewMode === 'week'">
              @for (pad of leadingPads; track $index) {
                <div class="pad"></div>
              }
              @for (day of visibleDays; track day.date) {
                <app-calendar-day-cell [day]="day" (open)="openDrawer($event)" />
              }
            </div>
          </div>
        }

      @if (viewMode === 'day') {
        <div class="day-view">
          @for (day of visibleDays; track day.date) {
            <article
              class="day-card"
              data-calendar-day-open
              role="button"
              tabindex="0"
              [class.today]="isToday(day.date)"
              [attr.aria-label]="'Відкрити деталі дня ' + day.date"
              [attr.aria-current]="isToday(day.date) ? 'date' : null"
              (click)="activateDayTrigger(day.date, $event)"
              (keydown.enter)="activateDayTrigger(day.date, $event)"
              (keydown.space)="activateDayTrigger(day.date, $event); $event.preventDefault()"
            >
              <h2>{{ formatDay(day.date) }}</h2>
              @if (!day.segments.length && !day.overflowCount) {
                <p class="muted">{{ 'calendar.empty.day' | t }}</p>
              } @else {
                <div class="day-bands">
                  @for (s of day.segments; track s.key) {
                    <app-calendar-segment [segment]="s" variant="band" />
                  }
                </div>
                @if (day.overflowCount > 0) {
                  <span class="linkish" [attr.aria-label]="overflowAriaLabel(day.overflowCount)">
                    Ще +{{ day.overflowCount }}
                  </span>
                }
              }
            </article>
          }
        </div>
      }

      @if (viewMode === 'list') {
        @if (isTabletUp) {
          <table class="list-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>
                  <div class="list-events-head">
                    <span>Події (08:00–20:00)</span>
                    <app-calendar-list-events [segments]="[]" [showHeader]="true" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              @for (day of listDaysWithEvents; track day.date) {
                <tr
                  class="list-row"
                  data-calendar-day-open
                  role="button"
                  tabindex="0"
                  [class.today]="isToday(day.date)"
                  [attr.aria-label]="'Відкрити деталі дня ' + day.date"
                  [attr.aria-current]="isToday(day.date) ? 'date' : null"
                  (click)="activateDayTrigger(day.date, $event)"
                  (keydown.enter)="activateDayTrigger(day.date, $event)"
                  (keydown.space)="activateDayTrigger(day.date, $event); $event.preventDefault()"
                >
                  <td>{{ formatDay(day.date) }}</td>
                  <td>
                    <app-calendar-list-events [segments]="day.segments" />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <div class="list-cards">
            @for (day of listDaysWithEvents; track day.date) {
              <article
                class="day-card"
                data-calendar-day-open
                role="button"
                tabindex="0"
                [class.today]="isToday(day.date)"
                [attr.aria-label]="'Відкрити деталі дня ' + day.date"
                [attr.aria-current]="isToday(day.date) ? 'date' : null"
                (click)="activateDayTrigger(day.date, $event)"
                (keydown.enter)="activateDayTrigger(day.date, $event)"
                (keydown.space)="activateDayTrigger(day.date, $event); $event.preventDefault()"
              >
                <h2>{{ formatDay(day.date) }}</h2>
                <div class="segment-cards">
                  @for (s of day.segments; track s.key) {
                    <app-calendar-segment [segment]="s" variant="card" />
                  }
                  @if (day.overflowCount > 0) {
                    <span class="linkish" [attr.aria-label]="overflowAriaLabel(day.overflowCount)">
                      Ще +{{ day.overflowCount }}
                    </span>
                  }
                </div>
              </article>
            }
          </div>
        }
        @if (!listDaysWithEvents.length && !rangeLoading) {
          <p class="muted">{{ 'calendar.empty.range' | t }}</p>
        }
      }
      </div>

      @if (drawerDate) {
        <app-calendar-day-drawer
          [date]="drawerDate"
          [employeeId]="presetEmployeeId || filterEmployeeId || null"
          [items]="drawerItems"
          [loading]="drawerLoading"
          [error]="drawerError"
          (closed)="closeDrawer()"
        />
      }
    </section>
  `,
  styles: [
    `
      .page {
        display: grid;
        gap: 0;
      }
      .stage {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        display: grid;
        gap: 1.15rem;
        padding: clamp(1rem, 2.5vw, 1.5rem);
        border-radius: 18px;
        border: 1px solid var(--pw-border);
        background:
          linear-gradient(
            165deg,
            color-mix(in srgb, var(--pw-accent) 9%, var(--pw-surface)) 0%,
            var(--pw-surface) 40%,
            var(--pw-surface-2) 100%
          );
        box-shadow: 0 10px 32px var(--pw-shadow);
      }
      .page.embedded .stage {
        padding: 0.85rem;
        border-radius: 14px;
        box-shadow: 0 4px 18px var(--pw-shadow);
      }
      .stage__glow {
        pointer-events: none;
        position: absolute;
        inset: -30% auto auto 55%;
        width: min(55vw, 22rem);
        height: min(55vw, 22rem);
        border-radius: 50%;
        background: radial-gradient(
          circle,
          color-mix(in srgb, var(--pw-accent) 18%, transparent) 0%,
          transparent 70%
        );
        z-index: 0;
      }
      .top,
      .toolbar,
      .board,
      .day-view,
      .list-table,
      .list-cards,
      .status-line,
      .error {
        position: relative;
        z-index: 1;
      }
      .top {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 0.85rem;
        align-items: flex-start;
      }
      .top.embedded {
        justify-content: flex-end;
        align-items: center;
      }
      .hero {
        display: grid;
        gap: 0.2rem;
      }
      .eyebrow {
        margin: 0;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--pw-muted);
      }
      h1 {
        margin: 0;
        font-size: clamp(1.45rem, 3.2vw, 1.85rem);
        font-weight: 750;
        letter-spacing: -0.02em;
        color: var(--pw-text-strong);
      }
      .nav-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
        align-items: center;
      }
      .period {
        min-width: 8.5rem;
        text-align: center;
        font-size: 1.02rem;
        font-weight: 700;
        color: var(--pw-text-strong);
      }
      .toolbar {
        display: grid;
        gap: 0.85rem;
        padding: 0.85rem;
        border-radius: 14px;
        border: 1px solid color-mix(in srgb, var(--pw-border) 85%, transparent);
        background: color-mix(in srgb, var(--pw-surface) 88%, transparent);
        box-shadow: 0 2px 10px color-mix(in srgb, var(--pw-shadow) 70%, transparent);
      }
      .modes {
        display: inline-flex;
        flex-wrap: nowrap;
        gap: 0.2rem;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
        padding: 0.22rem;
        border-radius: 999px;
        background: var(--pw-surface-2);
        border: 1px solid var(--pw-border);
        width: fit-content;
        max-width: 100%;
      }
      .modes button {
        flex: 0 0 auto;
        white-space: nowrap;
        border: 0;
        background: transparent;
        border-radius: 999px;
        padding: 0.42rem 0.9rem;
        cursor: pointer;
        color: var(--pw-muted);
        font-weight: 600;
        font-size: 0.88rem;
        transition:
          background 0.16s ease,
          color 0.16s ease,
          box-shadow 0.16s ease;
      }
      .modes button.active {
        background: var(--pw-surface);
        color: var(--pw-accent);
        box-shadow: 0 2px 8px var(--pw-shadow);
      }
      .ghost,
      .linkish {
        width: auto;
        border: 1px solid var(--pw-border);
        background: var(--pw-surface);
        border-radius: 10px;
        padding: 0.42rem 0.75rem;
        cursor: pointer;
        color: inherit;
        font-weight: 600;
        transition:
          border-color 0.15s ease,
          background 0.15s ease,
          transform 0.15s ease;
      }
      .nav-btn {
        min-width: 2.4rem;
        padding-inline: 0.55rem;
      }
      .today-btn {
        border-color: color-mix(in srgb, var(--pw-accent) 35%, var(--pw-border));
        background: var(--pw-accent-soft);
        color: var(--pw-accent);
      }
      .ghost:hover,
      .linkish:hover {
        border-color: var(--pw-accent);
        background: var(--pw-accent-soft);
      }
      .filters {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.65rem;
        position: relative;
        z-index: 4;
        overflow: visible;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--pw-muted);
      }
      select {
        padding: 0.5rem 0.65rem;
        border-radius: 10px;
        border: 1px solid var(--pw-border-strong);
        background: var(--pw-input-bg, var(--pw-surface));
        color: var(--pw-text);
        font-weight: 500;
      }
      .board {
        display: grid;
        gap: 0.45rem;
        padding: 0.75rem;
        border-radius: 14px;
        border: 1px solid var(--pw-border);
        background: color-mix(in srgb, var(--pw-surface) 94%, transparent);
        box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 55%, transparent);
      }
      .weekdays {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0.3rem;
        font-size: 0.68rem;
        font-weight: 750;
        letter-spacing: 0.04em;
        color: var(--pw-muted);
        text-transform: uppercase;
      }
      .weekdays span {
        text-align: center;
        padding: 0.35rem 0.15rem;
        border-radius: 8px;
        background: color-mix(in srgb, var(--pw-accent-soft) 55%, transparent);
      }
      .weekdays span:nth-child(6),
      .weekdays span:nth-child(7) {
        color: var(--pw-accent);
        background: color-mix(in srgb, var(--pw-accent) 10%, var(--pw-surface-2));
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0.3rem;
        align-items: stretch;
      }
      .grid > app-calendar-day-cell {
        min-height: 3.75rem;
        animation: cal-rise 0.35s ease both;
      }
      .pad {
        min-height: 3.75rem;
        border-radius: 10px;
        background:
          repeating-linear-gradient(
            -45deg,
            color-mix(in srgb, var(--pw-border) 55%, transparent) 0 6px,
            transparent 6px 12px
          );
        opacity: 0.45;
      }
      .day-view {
        display: grid;
        gap: 0.85rem;
      }
      .day-card {
        border: 1px solid var(--pw-border);
        border-radius: 14px;
        padding: 1rem 1.05rem;
        display: grid;
        gap: 0.55rem;
        cursor: pointer;
        background: color-mix(in srgb, var(--pw-surface) 96%, transparent);
        box-shadow: 0 3px 14px color-mix(in srgb, var(--pw-shadow) 80%, transparent);
        transition:
          border-color 0.16s ease,
          transform 0.16s ease,
          box-shadow 0.16s ease;
      }
      .day-card:hover {
        border-color: color-mix(in srgb, var(--pw-accent) 45%, var(--pw-border));
        transform: translateY(-1px);
        box-shadow: 0 8px 22px var(--pw-shadow);
      }
      .day-card.today {
        border-color: var(--pw-accent);
        border-width: 2px;
        box-shadow:
          0 0 0 1px color-mix(in srgb, var(--pw-accent) 28%, transparent),
          0 8px 22px var(--pw-shadow);
      }
      .day-card.today h2 {
        color: var(--pw-accent);
      }
      .day-card h2 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
      }
      .day-card:focus-visible {
        outline: 2px solid var(--pw-accent);
        outline-offset: 2px;
      }
      .day-bands {
        display: flex;
        flex-direction: column;
        min-height: 10rem;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid var(--pw-border);
        pointer-events: none;
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pw-surface) 40%, transparent);
      }
      .day-bands > app-calendar-segment {
        flex: 1 1 0;
        min-height: 0;
      }
      .day-card .linkish {
        pointer-events: none;
        align-self: start;
        background: var(--pw-accent-soft);
        color: var(--pw-accent);
        border-color: transparent;
      }
      .list-cards {
        display: grid;
        gap: 0.85rem;
      }
      .segment-cards {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
      }
      .list-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        table-layout: fixed;
        border: 1px solid var(--pw-border);
        border-radius: 14px;
        overflow: hidden;
        background: color-mix(in srgb, var(--pw-surface) 96%, transparent);
      }
      .list-table th,
      .list-table td {
        border-bottom: 1px solid var(--pw-border);
        padding: 0.85rem 0.75rem;
        vertical-align: middle;
        text-align: left;
      }
      .list-table th {
        background: var(--pw-surface-2);
        font-size: 0.78rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--pw-muted);
      }
      .list-table tr:last-child td {
        border-bottom: 0;
      }
      .list-table th:first-child,
      .list-table td:first-child {
        width: 9rem;
        white-space: nowrap;
        font-weight: 700;
      }
      .list-table th:last-child,
      .list-table td:last-child {
        width: auto;
      }
      .list-events-head {
        display: grid;
        gap: 0.35rem;
      }
      .list-events-head > span {
        font-weight: 700;
        text-transform: none;
        letter-spacing: 0;
        font-size: 0.92rem;
        color: var(--pw-text-strong);
      }
      .list-row {
        cursor: pointer;
        transition: background 0.14s ease;
      }
      .list-row:hover td {
        background: color-mix(in srgb, var(--pw-accent-soft) 65%, transparent);
      }
      .list-row.today td:first-child {
        color: var(--pw-accent);
        font-weight: 750;
        box-shadow: inset 4px 0 0 var(--pw-accent);
      }
      .list-row:focus-visible {
        outline: 2px solid var(--pw-accent);
        outline-offset: -2px;
      }
      .list-row app-calendar-list-events {
        pointer-events: none;
        display: block;
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
        list-style: none;
        margin: 0;
        padding: 0;
        width: 100%;
        font-size: 0.78rem;
        color: var(--pw-muted);
      }
      .legend li {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.28rem 0.55rem;
        border-radius: 999px;
        border: 1px solid var(--pw-border);
        background: color-mix(in srgb, var(--pw-surface) 90%, transparent);
      }
      .legend-swatch {
        width: 0.8rem;
        height: 0.8rem;
        border-radius: 3px;
        background: var(--pw-accent);
        border: 1px solid color-mix(in srgb, var(--pw-accent) 40%, var(--pw-border));
      }
      .legend-swatch[data-kind='partial_absence'] {
        box-shadow: inset 0 0 0 2px #16a34a;
        background: repeating-linear-gradient(
          -45deg,
          var(--pw-accent),
          var(--pw-accent) 4px,
          transparent 4px,
          transparent 9px
        );
      }
      .legend-swatch[data-kind='overtime'],
      .legend-swatch[data-kind='extra_work_day'],
      .legend-swatch[data-kind='business_trip'] {
        box-shadow: inset 0 0 0 2px #dc2626;
        background: repeating-linear-gradient(
          45deg,
          var(--pw-accent),
          var(--pw-accent) 4px,
          transparent 4px,
          transparent 9px
        );
      }
      .muted {
        color: var(--pw-muted);
      }
      .status-line {
        margin: 0;
        font-weight: 600;
      }
      .error {
        margin: 0;
        color: var(--pw-danger);
        font-weight: 600;
      }
      @keyframes cal-rise {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
      @media (min-width: 641px) {
        .modes {
          flex-wrap: wrap;
          overflow-x: visible;
        }
        .filters {
          grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
        }
        .grid {
          gap: 0.45rem;
        }
        .grid > app-calendar-day-cell {
          min-height: 7.25rem;
        }
        .pad {
          min-height: 7.25rem;
        }
        .weekdays {
          gap: 0.45rem;
          font-size: 0.74rem;
        }
        .board {
          padding: 1rem;
          gap: 0.55rem;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .grid > app-calendar-day-cell,
        .day-card,
        .ghost,
        .modes button {
          animation: none !important;
          transition: none !important;
        }
      }
    `,
  ],
})
export class CalendarPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(TranslateService);
  private readonly viewport = inject(ViewportService);
  private readonly range$ = new Subject<void>();
  private readonly drawer$ = new Subject<string>();
  private subs = new Subscription();

  @Input() presetEmployeeId: string | null = null;
  @Input() employeeOnlyMode = false;
  @Input() embedded = false;

  @ViewChild('modesEl') modesEl?: ElementRef<HTMLDivElement>;

  readonly modes: CalendarViewMode[] = ['month', 'week', 'day', 'list'];
  readonly weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  readonly typeFilterOptions = Object.entries(ABSENCE_TYPE_LABELS).map(
    ([value, label]) => ({ value, label }),
  );

  viewMode: CalendarViewMode = 'month';
  anchor = todayIsoLocal();
  days: CalendarDaySummary[] = [];
  legend: CalendarLegendItem[] = [];
  rangeLoading = false;
  rangeError = '';

  departments: Department[] = [];
  employees: EmployeeListItem[] = [];
  filterDepartmentId = '';
  filterEmployeeId = '';
  filterType = '';
  filterStatus = '';

  drawerDate: string | null = null;
  drawerItems: CalendarDayItem[] = [];
  drawerLoading = false;
  drawerError = '';

  private drawerTriggerEl: HTMLElement | null = null;

  get isEmployeeOnly(): boolean {
    return this.employeeOnlyMode && Boolean(this.presetEmployeeId);
  }

  get isTabletUp(): boolean {
    return this.viewport.isTabletUp();
  }

  get from(): string {
    if (this.viewMode === 'week') return startOfWeekIso(this.anchor);
    if (this.viewMode === 'day') return this.anchor;
    if (this.viewMode === 'list') return startOfMonthIso(this.anchor);
    return startOfMonthIso(this.anchor);
  }

  get to(): string {
    if (this.viewMode === 'week') return endOfWeekIso(this.anchor);
    if (this.viewMode === 'day') return this.anchor;
    if (this.viewMode === 'list') return endOfMonthIso(this.anchor);
    return endOfMonthIso(this.anchor);
  }

  get periodTitle(): string {
    if (this.viewMode === 'day') return formatUkDayLabel(this.anchor);
    if (this.viewMode === 'week') return `${this.from} — ${this.to}`;
    return monthTitleUk(this.anchor);
  }

  get leadingPads(): number[] {
    if (this.viewMode !== 'month') return [];
    const start = startOfWeekIso(this.from);
    const pads = enumerateIso(start, addDaysIso(this.from, -1));
    return pads.map((_, i) => i);
  }

  get visibleDays(): CalendarDaySummary[] {
    const map = new Map(this.days.map((d) => [d.date, d]));
    return enumerateIso(this.from, this.to).map(
      (date) => map.get(date) ?? { date, segments: [], overflowCount: 0 },
    );
  }

  get listDaysWithEvents(): CalendarDaySummary[] {
    return this.visibleDays.filter((d) => d.segments.length + d.overflowCount > 0);
  }

  ngOnInit(): void {
    if (this.employeeOnlyMode && !this.presetEmployeeId) {
      this.rangeError = 'Не вказано працівника для персонального календаря';
      return;
    }

    this.filterEmployeeId = this.presetEmployeeId ?? '';

    this.subs.add(
      this.range$
        .pipe(
          debounceTime(200),
          switchMap(() => {
            this.rangeLoading = true;
            this.rangeError = '';
            const key = this.queryKey();
            return this.api.getCalendarRange(this.from, this.to, this.filters()).pipe(
              catchError((err) => {
                this.rangeError = err?.error?.message || err?.message || this.i18n.t('calendar.error');
                this.rangeLoading = false;
                return of({ days: [] as CalendarDaySummary[], legend: [] as CalendarLegendItem[], _key: key });
              }),
            );
          }),
        )
        .subscribe((res) => {
          this.days = res.days ?? [];
          if (res.legend?.length) {
            this.legend = res.legend;
          }
          this.rangeLoading = false;
        }),
    );

    this.subs.add(
      this.drawer$
        .pipe(
          switchMap((date) => {
            this.drawerLoading = true;
            this.drawerError = '';
            return this.api.getCalendarDay(date, this.filters()).pipe(
              catchError((err) => {
                this.drawerError =
                  err?.error?.message || err?.message || this.i18n.t('calendar.drawer.error');
                this.drawerLoading = false;
                return of({ date, items: [] as CalendarDayItem[] });
              }),
            );
          }),
        )
        .subscribe((res) => {
          this.drawerItems = res.items ?? [];
          this.drawerLoading = false;
        }),
    );

    if (!this.isEmployeeOnly) {
      this.subs.add(
        this.api.getDepartments().subscribe({
          next: (d) => (this.departments = d),
        }),
      );
      this.reloadEmployees();
    }

    this.reloadRange();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  setMode(mode: CalendarViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.reloadRange();
    queueMicrotask(() => this.scrollActiveModeIntoView());
  }

  shift(dir: number): void {
    if (this.viewMode === 'day') {
      this.anchor = addDaysIso(this.anchor, dir);
    } else if (this.viewMode === 'week') {
      this.anchor = addDaysIso(this.anchor, dir * 7);
    } else {
      const [y, m] = this.anchor.split('-').map(Number);
      const nm = m - 1 + dir;
      const dt = new Date(y, nm, 1);
      this.anchor = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-01`;
    }
    this.reloadRange();
  }

  goToday(): void {
    this.anchor = todayIsoLocal();
    this.reloadRange();
  }

  onDepartmentFilterChanged(): void {
    this.reloadEmployees(() => this.onFiltersChanged());
  }

  onFiltersChanged(): void {
    this.reloadRange();
    if (this.drawerDate) {
      this.drawer$.next(this.drawerDate);
    }
  }

  /** Reload employee options for the employee filter; scoped to selected department. */
  private reloadEmployees(after?: () => void): void {
    this.subs.add(
      this.api
        .getEmployees({
          status: 'active',
          departmentId: this.isEmployeeOnly
            ? undefined
            : this.filterDepartmentId || undefined,
          sortBy: 'fullName',
          sortDir: 'asc',
        })
        .subscribe({
          next: (items) => {
            this.employees = items;
            if (
              !this.presetEmployeeId &&
              this.filterEmployeeId &&
              !items.some((e) => e.id === this.filterEmployeeId)
            ) {
              this.filterEmployeeId = '';
            }
            after?.();
          },
          error: () => {
            this.employees = [];
            after?.();
          },
        }),
    );
  }

  /** Focus the trigger element itself before opening — programmatic focus()
   * does not trigger :focus-visible on click, and guarantees `document.activeElement`
   * is the right element to restore focus to when the drawer closes. */
  activateDayTrigger(date: string, event: Event): void {
    (event.currentTarget as HTMLElement | null)?.focus({ preventScroll: true });
    this.openDrawer(date);
    event.stopPropagation();
  }

  openDrawer(date: string): void {
    if (this.drawerDate === date) {
      this.closeDrawer();
      return;
    }
    this.drawerDate = date;
    this.drawerTriggerEl = (document.activeElement as HTMLElement | null) ?? null;
    this.drawer$.next(date);
  }

  closeDrawer(): void {
    const trigger = this.drawerTriggerEl;
    this.drawerDate = null;
    this.drawerItems = [];
    this.drawerError = '';
    this.drawerTriggerEl = null;
    if (trigger && document.contains(trigger)) {
      queueMicrotask(() => trigger.focus({ preventScroll: true }));
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.drawerDate) return;
    const target = event.target as HTMLElement | null;
    if (!target) {
      this.closeDrawer();
      return;
    }
    if (target.closest('[data-calendar-drawer]')) return;
    if (target.closest('[data-calendar-day-open]')) return;
    this.closeDrawer();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.drawerDate) this.closeDrawer();
  }

  formatDay(date: string): string {
    return formatUkDayLabel(date);
  }

  isToday(date: string): boolean {
    return date === todayIsoLocal();
  }

  overflowAriaLabel(count: number): string {
    return `${this.i18n.t('calendar.overflowAria')}: ${count}`;
  }

  private scrollActiveModeIntoView(): void {
    const container = this.modesEl?.nativeElement;
    if (!container) return;
    const active = container.querySelector<HTMLElement>('button.active');
    if (!active) return;
    const target = active.offsetLeft - (container.clientWidth - active.clientWidth) / 2;
    container.scrollLeft = Math.max(0, target);
  }

  private reloadRange(): void {
    this.range$.next();
  }

  private filters(): CalendarQueryFilters {
    const f: CalendarQueryFilters = {};
    const employeeId = this.presetEmployeeId || this.filterEmployeeId;

    if (!this.isEmployeeOnly && this.filterDepartmentId) {
      f.departmentIds = [this.filterDepartmentId];
    }
    if (employeeId) {
      f.employeeIds = [employeeId];
    }
    if (this.filterType) {
      f.types = [this.filterType as AbsenceType];
    }
    if (this.filterStatus) {
      f.statusGroups = [this.filterStatus as CalendarStatusGroup];
    }
    return f;
  }

  private queryKey(): string {
    return JSON.stringify({
      from: this.from,
      to: this.to,
      f: this.filters(),
      v: this.viewMode,
    });
  }
}
