import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
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
  CalendarQueryFilters,
  CalendarStatusGroup,
  CalendarViewMode,
  Department,
  EmployeeListItem,
} from '../core/api/models';
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
    <section class="page">
      <header class="top">
        <h1>Календар відсутностей</h1>
        <div class="nav-row">
          <button
            type="button"
            class="ghost"
            [attr.aria-label]="'calendar.prev' | t"
            (click)="shift(-1)"
          >
            ←
          </button>
          <strong>{{ periodTitle }}</strong>
          <button
            type="button"
            class="ghost"
            [attr.aria-label]="'calendar.next' | t"
            (click)="shift(1)"
          >
            →
          </button>
          <button type="button" class="ghost" (click)="goToday()">{{ 'calendar.today' | t }}</button>
        </div>
      </header>

      <div class="toolbar">
        <div class="modes" #modesEl>
          @for (m of modes; track m) {
            <button type="button" [class.active]="viewMode === m" (click)="setMode(m)">
              {{ ('calendar.modes.' + m) | t }}
            </button>
          }
        </div>
        <div class="filters">
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
          <label>
            {{ 'calendar.filters.type' | t }}
            <select [(ngModel)]="filterType" (ngModelChange)="onFiltersChanged()">
              <option value="">{{ 'calendar.filters.all' | t }}</option>
              <option value="day_off">DayOff</option>
              <option value="vacation">Відпустка</option>
              <option value="sick_leave">Лікарняний</option>
              <option value="part_time">Частковий день</option>
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
        <p class="muted">{{ 'calendar.loading' | t }}</p>
      }

      @if (viewMode === 'month' || viewMode === 'week') {
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

      @if (drawerDate) {
        <app-calendar-day-drawer
          [date]="drawerDate"
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
        gap: 1rem;
      }
      .top {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
      }
      h1 {
        margin: 0;
      }
      .nav-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      }
      .toolbar {
        display: grid;
        gap: 0.75rem;
      }
      .modes {
        display: flex;
        flex-wrap: nowrap;
        gap: 0.35rem;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
        padding-bottom: 0.15rem;
      }
      .modes button {
        flex: 0 0 auto;
        white-space: nowrap;
      }
      .modes button,
      .ghost,
      .linkish {
        width: auto;
        border: 1px solid var(--pw-border);
        background: var(--pw-surface);
        border-radius: 8px;
        padding: 0.4rem 0.7rem;
        cursor: pointer;
        color: inherit;
      }
      .modes button.active {
        border-color: var(--pw-accent);
        background: var(--pw-accent-soft);
        color: var(--pw-accent);
        font-weight: 600;
      }
      .filters {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.65rem;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.85rem;
      }
      select {
        padding: 0.45rem 0.55rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border-strong);
      }
      .weekdays {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0.2rem;
        font-size: 0.68rem;
        font-weight: 700;
        color: var(--pw-muted);
        text-transform: uppercase;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0.2rem;
        align-items: stretch;
      }
      .grid > app-calendar-day-cell {
        min-height: 3.5rem;
      }
      .pad {
        min-height: 3.5rem;
      }
      .day-view {
        display: grid;
        gap: 0.85rem;
      }
      .day-card {
        border: 1px solid var(--pw-border);
        border-radius: 10px;
        padding: 0.85rem;
        display: grid;
        gap: 0.5rem;
        cursor: pointer;
        background: var(--pw-surface);
      }
      .day-card:hover {
        border-color: var(--pw-accent);
      }
      .day-card.today {
        border-color: #2563eb;
        border-width: 3px;
        box-shadow: inset 0 0 0 1px color-mix(in srgb, #2563eb 30%, transparent);
      }
      .day-card.today h2 {
        color: #1d4ed8;
      }
      :host-context(html[data-theme='dark']) .day-card.today {
        border-color: #eab308;
        box-shadow: inset 0 0 0 1px color-mix(in srgb, #eab308 40%, transparent);
      }
      :host-context(html[data-theme='dark']) .day-card.today h2 {
        color: #facc15;
      }
      .day-card:focus-visible {
        outline: 2px solid var(--pw-accent);
        outline-offset: 2px;
      }
      .day-bands {
        display: flex;
        flex-direction: column;
        min-height: 10rem;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid var(--pw-border);
        pointer-events: none;
      }
      .day-bands > app-calendar-segment {
        flex: 1 1 0;
        min-height: 0;
      }
      .day-card .linkish {
        pointer-events: none;
      }
      .list-cards {
        display: grid;
        gap: 0.85rem;
      }
      .segment-cards {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .list-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      .list-table th,
      .list-table td {
        border-bottom: 2px solid color-mix(in srgb, var(--pw-muted) 40%, var(--pw-border-strong));
        padding: 0.75rem 0.35rem;
        vertical-align: middle;
        text-align: left;
      }
      .list-table th:first-child,
      .list-table td:first-child {
        width: 8.5rem;
        white-space: nowrap;
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
      }
      .list-row {
        cursor: pointer;
      }
      .list-row:hover td {
        background: color-mix(in srgb, var(--pw-accent-soft) 55%, transparent);
      }
      .list-row.today td:first-child {
        color: #1d4ed8;
        font-weight: 700;
        box-shadow: inset 4px 0 0 #2563eb;
      }
      :host-context(html[data-theme='dark']) .list-row.today td:first-child {
        color: #facc15;
        box-shadow: inset 4px 0 0 #eab308;
      }
      .list-row:focus-visible {
        outline: 2px solid var(--pw-accent);
        outline-offset: -2px;
      }
      .list-row app-calendar-list-events {
        pointer-events: none;
        display: block;
      }
      .muted {
        color: var(--pw-muted);
      }
      .error {
        color: var(--pw-danger);
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
          gap: 0.35rem;
        }
        .grid > app-calendar-day-cell {
          min-height: 7rem;
        }
        .pad {
          min-height: 7rem;
        }
        .weekdays {
          gap: 0.35rem;
          font-size: 0.75rem;
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

  @ViewChild('modesEl') modesEl?: ElementRef<HTMLDivElement>;

  readonly modes: CalendarViewMode[] = ['month', 'week', 'day', 'list'];
  readonly weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  viewMode: CalendarViewMode = 'month';
  anchor = todayIsoLocal();
  days: CalendarDaySummary[] = [];
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
    this.subs.add(
      this.api.getDepartments().subscribe({
        next: (d) => (this.departments = d),
      }),
    );
    this.reloadEmployees();

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
                return of({ days: [] as CalendarDaySummary[], _key: key });
              }),
            );
          }),
        )
        .subscribe((res) => {
          this.days = res.days ?? [];
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
          departmentId: this.filterDepartmentId || undefined,
          sortBy: 'fullName',
          sortDir: 'asc',
        })
        .subscribe({
          next: (items) => {
            this.employees = items;
            if (this.filterEmployeeId && !items.some((e) => e.id === this.filterEmployeeId)) {
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
    if (this.filterDepartmentId) f.departmentIds = [this.filterDepartmentId];
    if (this.filterEmployeeId) f.employeeIds = [this.filterEmployeeId];
    if (this.filterType) f.types = [this.filterType as AbsenceType];
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
