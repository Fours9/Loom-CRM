import { Component, EventEmitter, Input, OnDestroy, Output, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CalendarDayItem } from '../core/api/models';
import { requestFrameTone } from '../shared/request-status-presentation';
import { TranslatePipe } from '../core/i18n/translate.pipe';
import { OverlayScrollLockService } from '../core/overlay/overlay-scroll-lock.service';
import { ViewportService } from '../core/viewport/viewport.service';
import { CalendarListEventsComponent } from './calendar-list-events.component';
import { formatUkDayLabel, todayIsoLocal } from './calendar-date.util';
import {
  buildCreateAbsenceRequestLink,
  type CreateAbsenceRequestLink,
} from '../requests/create-request-navigation';

@Component({
  selector: 'app-calendar-day-drawer',
  standalone: true,
  imports: [RouterLink, TranslatePipe, CalendarListEventsComponent],
  template: `
    @if (!isTabletUp) {
      <div class="scrim" aria-hidden="true" (click)="closed.emit()"></div>
    }
    <aside
      class="drawer"
      data-calendar-drawer
      role="dialog"
      [attr.aria-modal]="isTabletUp ? null : 'true'"
      [attr.aria-label]="'День ' + date"
      (click)="$event.stopPropagation()"
    >
      <header class="head">
        <div>
          <h2>{{ title }}</h2>
          <p class="muted">{{ date }}</p>
        </div>
        <div class="head-actions">
          <a
            class="primary"
            [routerLink]="createRequestLink.routerLink"
            [queryParams]="createRequestLink.queryParams"
          >
            Нова заявка
          </a>
          <button
            type="button"
            class="ghost"
            [attr.aria-label]="'calendar.drawer.closeAria' | t"
            (click)="closed.emit()"
          >
            {{ 'calendar.drawer.close' | t }}
          </button>
        </div>
      </header>
      @if (loading) {
        <p class="muted">{{ 'calendar.drawer.loading' | t }}</p>
      } @else if (error) {
        <p class="error">{{ error }}</p>
      } @else if (!items.length) {
        <p class="muted">{{ 'calendar.empty.drawerDay' | t }}</p>
      } @else {
        <div class="axis-head">
          <span class="axis-title">{{ 'calendar.drawer.axisTitle' | t }}</span>
          <app-calendar-list-events [segments]="[]" [showHeader]="true" />
        </div>
        <ul class="list">
          @for (item of items; track item.key) {
            <li
              class="item-card pw-request-frame"
              [attr.data-frame]="
                frameTone(item.statusGroup, {
                  deletionRequested: item.deletionRequested,
                  deletionFrame: 'rejected',
                  periodEnded: isPeriodEnded(item),
                })
              "
              [class.is-active]="isActiveNow(item) && !item.deletionRequested && !isPeriodEnded(item)"
            >
              @if (item.statusGroup === 'pending') {
                <div class="status-row">
                  <span class="badge badge-pending">Очікує рішення</span>
                </div>
              } @else if (isPeriodEnded(item) && !item.deletionRequested) {
                <div class="status-row">
                  <span class="badge badge-completed">Завершена</span>
                </div>
              } @else if (isActiveNow(item)) {
                <div class="status-row">
                  <span class="badge badge-active">Дійсна</span>
                </div>
              }
              <app-calendar-list-events [segments]="[timelineItem(item)]" />
              <div class="meta">
                @if (item.employeeName) {
                  <span class="name">{{ item.employeeName }}</span>
                }
                @if (item.absenceTypeLabel || item.periodStart || (item.startTime && item.endTime)) {
                  <span class="type-when">
                    @if (item.absenceTypeLabel) {
                      <span>{{ item.absenceTypeLabel }}</span>
                    }
                    @if (item.periodStart) {
                      @if (item.absenceTypeLabel) {
                        <span class="sep">·</span>
                      }
                      <span>{{ formatPeriod(item.periodStart, item.periodEnd) }}</span>
                    }
                    @if (item.startTime && item.endTime) {
                      @if (item.absenceTypeLabel || item.periodStart) {
                        <span class="sep">·</span>
                      }
                      <span>{{ item.startTime }}–{{ item.endTime }}</span>
                    }
                  </span>
                }
                @if (item.departmentName || item.positionName) {
                  <span class="dept-pos">
                    @if (item.departmentName) {
                      <span>{{ item.departmentName }}</span>
                    }
                    @if (item.departmentName && item.positionName) {
                      <span class="sep">·</span>
                    }
                    @if (item.positionName) {
                      <span>{{ item.positionName }}</span>
                    }
                  </span>
                }
                @if (item.deletionRequested) {
                  <span class="badge badge-deletion">Запит на видалення</span>
                }
                @if (item.requestId) {
                  <a [routerLink]="['/absences/requests', item.requestId]">Переглянути заяву</a>
                }
              </div>
            </li>
          }
        </ul>
      }
    </aside>
  `,
  styles: [
    `
      .scrim {
        position: fixed;
        inset: 0;
        background: color-mix(in srgb, var(--pw-text-strong) 42%, transparent);
        backdrop-filter: blur(2px);
        z-index: var(--pw-z-scrim, 200);
      }
      .drawer {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        max-height: 85vh;
        max-height: 85dvh;
        background:
          linear-gradient(
            180deg,
            color-mix(in srgb, var(--pw-accent) 8%, var(--pw-surface)) 0%,
            var(--pw-surface) 7rem
          );
        border: 1px solid var(--pw-border);
        border-bottom: 0;
        border-radius: 18px 18px 0 0;
        box-shadow: 0 -12px 36px color-mix(in srgb, #000 16%, transparent);
        padding: 1.1rem 1.15rem calc(1.1rem + env(safe-area-inset-bottom, 0px));
        overflow: auto;
        z-index: var(--pw-z-drawer, 210);
      }
      @media (min-width: 641px) {
        .drawer {
          /* Sit below CRM sticky topbar (topbar z-index is above drawer). */
          top: var(--shell-topbar-h, 4.05rem);
          right: 0;
          left: auto;
          bottom: auto;
          width: min(480px, 100vw);
          height: calc(100vh - var(--shell-topbar-h, 4.05rem));
          height: calc(100dvh - var(--shell-topbar-h, 4.05rem));
          max-height: none;
          border-radius: 0;
          border: 0;
          border-left: 1px solid var(--pw-border);
          box-shadow: -12px 0 36px color-mix(in srgb, #000 14%, transparent);
          padding: 1.15rem 1.2rem;
          background:
            linear-gradient(
              165deg,
              color-mix(in srgb, var(--pw-accent) 9%, var(--pw-surface)) 0%,
              var(--pw-surface) 8rem
            );
        }
      }
      .head {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: flex-start;
        margin-bottom: 1.1rem;
        padding-bottom: 0.95rem;
        border-bottom: 1px solid color-mix(in srgb, var(--pw-border) 85%, transparent);
      }
      .head-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0.5rem;
      }
      h2 {
        margin: 0;
        font-size: 1.2rem;
        font-weight: 750;
        letter-spacing: -0.02em;
        color: var(--pw-text-strong);
      }
      .muted {
        color: var(--pw-muted);
        margin: 0.25rem 0 0;
        font-size: 0.86rem;
      }
      .primary {
        display: inline-flex;
        align-items: center;
        text-decoration: none;
        background: var(--pw-accent);
        color: var(--pw-on-accent, #fff);
        border: 1px solid transparent;
        border-radius: 10px;
        padding: 0.48rem 0.9rem;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 4px 12px color-mix(in srgb, var(--pw-accent) 28%, transparent);
        transition:
          transform 0.15s ease,
          box-shadow 0.15s ease;
      }
      .primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px color-mix(in srgb, var(--pw-accent) 35%, transparent);
      }
      .ghost {
        width: auto;
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        border-radius: 10px;
        padding: 0.45rem 0.75rem;
        cursor: pointer;
        font-weight: 600;
        transition:
          border-color 0.15s ease,
          background 0.15s ease;
      }
      .ghost:hover {
        border-color: var(--pw-accent);
        background: var(--pw-accent-soft);
      }
      .axis-head {
        display: grid;
        gap: 0.3rem;
        margin-bottom: 0.75rem;
        /* Match item-card frame border (2px) + padding (0.65rem) so hour ticks
           line up with the bars inside each card. */
        padding: 0 calc(0.65rem + 2px);
      }
      .axis-title {
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--pw-muted);
      }
      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }
      .item-card {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        padding: 0.75rem;
        border-radius: 12px;
        box-shadow: 0 3px 12px color-mix(in srgb, var(--pw-shadow) 70%, transparent);
        transition:
          border-color 0.15s ease,
          box-shadow 0.15s ease,
          transform 0.15s ease;
      }
      .item-card:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 18px var(--pw-shadow);
      }
      .item-card.is-active {
        border-color: #16a34a;
        border-style: dashed;
        border-width: 2px;
        background: color-mix(in srgb, #22c55e 12%, var(--pw-surface));
      }
      @media (prefers-reduced-motion: reduce) {
        .primary,
        .ghost,
        .item-card {
          transition: none;
        }
        .primary:hover,
        .item-card:hover {
          transform: none;
        }
      }
      .status-row {
        display: flex;
        justify-content: flex-start;
      }
      .item-card app-calendar-list-events {
        display: block;
        width: 100%;
      }
      .meta {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.35rem;
        font-size: 0.85rem;
      }
      .meta .name {
        font-weight: 600;
      }
      .meta .muted {
        margin: 0;
        color: var(--pw-muted);
      }
      .type-when {
        display: flex;
        flex-wrap: nowrap;
        align-items: baseline;
        gap: 0.35rem;
        width: 100%;
        color: var(--pw-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .type-when .sep {
        flex: 0 0 auto;
        opacity: 0.7;
      }
      .dept-pos {
        display: flex;
        flex-wrap: nowrap;
        align-items: baseline;
        gap: 0.35rem;
        width: 100%;
        color: var(--pw-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dept-pos .sep {
        flex: 0 0 auto;
        opacity: 0.7;
      }
      .dept-pos > span:not(.sep) {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .badge-pending {
        display: inline-flex;
        align-items: center;
        padding: 0.28rem 0.65rem;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: #92400e;
        background: #fde68a;
        border: 1px solid #f59e0b;
      }
      .badge-active {
        display: inline-flex;
        align-items: center;
        padding: 0.28rem 0.65rem;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: #14532d;
        background: #bbf7d0;
        border: 1px solid #22c55e;
      }
      .badge-completed {
        display: inline-flex;
        align-items: center;
        padding: 0.28rem 0.65rem;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: #475569;
        background: #e2e8f0;
        border: 1px solid #94a3b8;
      }
      .badge-deletion {
        display: inline-flex;
        align-items: center;
        padding: 0.28rem 0.65rem;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: #991b1b;
        background: #fecaca;
        border: 1px solid #dc2626;
      }
      .error {
        color: var(--pw-danger);
      }
      a {
        color: var(--pw-accent);
      }
    `,
  ],
})
export class CalendarDayDrawerComponent implements OnDestroy {
  @Input({ required: true }) date!: string;
  @Input() employeeId: string | null = null;
  @Input() items: CalendarDayItem[] = [];
  @Input() loading = false;
  @Input() error = '';
  @Output() closed = new EventEmitter<void>();

  readonly frameTone = requestFrameTone;

  get createRequestLink(): CreateAbsenceRequestLink {
    return buildCreateAbsenceRequestLink({
      startDate: this.date,
      employeeId: this.employeeId || undefined,
    });
  }

  private readonly viewport = inject(ViewportService);
  private readonly scrollLock = inject(OverlayScrollLockService);
  /** Owner flag — ensures acquire()/release() calls stay balanced across
   * repeated breakpoint transitions while this one drawer instance is open. */
  private hasScrollLock = false;

  constructor() {
    // Phone (base): modal bottom sheet → lock body scroll.
    // Tablet+ (min-width: 641px): non-modal right panel → no lock.
    // Runs once on init (acquire if starting on phone) and again on every
    // phone↔tablet breakpoint crossing while this drawer instance stays open
    // (the selected day is preserved across the transition by the caller).
    effect(() => {
      if (this.viewport.isTabletUp()) {
        this.releaseScrollLock();
      } else {
        this.acquireScrollLock();
      }
    });
  }

  ngOnDestroy(): void {
    // Leaving the calendar / destroying this instance always releases the lock.
    this.releaseScrollLock();
  }

  get isTabletUp(): boolean {
    return this.viewport.isTabletUp();
  }

  get title(): string {
    return formatUkDayLabel(this.date);
  }

  /** Approved absence whose period has already ended (vs Kyiv today from API). */
  isPeriodEnded(item: CalendarDayItem): boolean {
    if (item.periodEnded) return true;
    if (item.statusGroup !== 'approved') return false;
    const end = item.periodEnd || item.periodStart;
    return Boolean(end && end < todayIsoLocal());
  }

  /** Ensure muted “ended” look on the hour bar even if API flag is missing. */
  timelineItem(item: CalendarDayItem): CalendarDayItem {
    if (!this.isPeriodEnded(item) || item.periodEnded) return item;
    return { ...item, periodEnded: true };
  }

  /** Approved absence happening now (today; part_time within current time window). */
  isActiveNow(item: CalendarDayItem): boolean {
    if (item.statusGroup !== 'approved') return false;
    if (this.date !== todayIsoLocal()) return false;
    if (item.startTime && item.endTime) {
      const now = currentHmLocal();
      return now >= item.startTime.slice(0, 5) && now <= item.endTime.slice(0, 5);
    }
    return true;
  }

  formatPeriod(start: string, end?: string): string {
    const a = formatUkShortDate(start);
    const b = end && end !== start ? formatUkShortDate(end) : null;
    return b ? `${a}–${b}` : a;
  }

  private acquireScrollLock(): void {
    if (this.hasScrollLock) return;
    this.scrollLock.acquire();
    this.hasScrollLock = true;
  }

  private releaseScrollLock(): void {
    if (!this.hasScrollLock) return;
    this.scrollLock.release();
    this.hasScrollLock = false;
  }
}

function currentHmLocal(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatUkShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
}
