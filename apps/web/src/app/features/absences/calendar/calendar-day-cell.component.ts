import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CalendarDaySummary, CalendarSegmentSummary } from '../core/api/models';
import { TranslateService } from '../core/i18n/translate.service';
import { ViewportService } from '../core/viewport/viewport.service';
import { CalendarSegmentComponent } from './calendar-segment.component';
import { PHONE_VISIBLE_SEGMENTS } from './calendar-constants';
import { parseIsoParts, todayIsoLocal } from './calendar-date.util';

@Component({
  selector: 'app-calendar-day-cell',
  standalone: true,
  imports: [CalendarSegmentComponent],
  template: `
    <button
      type="button"
      class="cell"
      data-calendar-day-open
      [class.empty]="!day.segments.length"
      [class.today]="isToday"
      (click)="onOpen($event)"
      [attr.aria-label]="aria"
      [attr.aria-current]="isToday ? 'date' : null"
      [title]="aria"
    >
      <span class="dom">{{ dayNum }}</span>
      @if (visibleSegments.length) {
        <div class="bands" [style.--band-count]="visibleSegments.length">
          @for (s of visibleSegments; track s.key) {
            <app-calendar-segment [segment]="s" variant="band" />
          }
        </div>
      }
      @if (hiddenCount > 0) {
        <span class="more" [attr.aria-label]="overflowAriaLabel">+{{ hiddenCount }}</span>
      }
    </button>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: inherit;
      }
      .cell {
        position: relative;
        display: flex;
        flex-direction: column;
        width: 100%;
        min-height: 3.5rem;
        height: 100%;
        padding: 0;
        border: 1px solid var(--pw-border);
        border-radius: 6px;
        background: var(--pw-surface);
        cursor: pointer;
        text-align: left;
        color: inherit;
        overflow: hidden;
      }
      .cell:hover {
        border-color: var(--pw-accent);
      }
      .cell.empty {
        background: var(--pw-surface);
      }
      .cell.today {
        border-color: #2563eb;
        border-width: 3px;
        box-shadow: inset 0 0 0 1px color-mix(in srgb, #2563eb 35%, transparent);
      }
      .cell.today .dom {
        background: #2563eb;
        color: #ffffff;
      }
      :host-context(html[data-theme='dark']) .cell.today {
        border-color: #eab308;
        box-shadow: inset 0 0 0 1px color-mix(in srgb, #eab308 45%, transparent);
      }
      :host-context(html[data-theme='dark']) .cell.today .dom {
        background: #eab308;
        color: #422006;
      }
      .dom {
        position: absolute;
        top: 0.15rem;
        left: 0.2rem;
        z-index: 3;
        font-size: 0.65rem;
        font-weight: 700;
        line-height: 1;
        padding: 0.1rem 0.22rem;
        border-radius: 3px;
        background: color-mix(in srgb, var(--pw-surface) 82%, transparent);
        color: var(--pw-text-strong, inherit);
        pointer-events: none;
      }
      .bands {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 3.5rem;
        width: 100%;
      }
      .bands > .band,
      .bands > app-calendar-segment {
        flex: 1 1 0;
        min-height: 0.55rem;
        width: 100%;
      }
      /* Phone: keep the color/pattern bands but drop the text label — the
         cell aria-label / segment aria-label still carry the info for a11y. */
      .bands ::ng-deep .seg-label {
        display: none;
      }
      .more {
        position: absolute;
        right: 0.12rem;
        bottom: 0.12rem;
        z-index: 3;
        font-size: 0.58rem;
        font-weight: 700;
        padding: 0.05rem 0.22rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--pw-surface) 88%, transparent);
        color: var(--pw-muted);
        pointer-events: none;
      }
      @media (min-width: 641px) {
        .cell {
          min-height: 7rem;
          border-radius: 8px;
        }
        .bands {
          min-height: 7rem;
        }
        .bands > .band,
        .bands > app-calendar-segment {
          min-height: 0;
        }
        .bands ::ng-deep .seg-label {
          display: block;
        }
        .dom {
          top: 0.28rem;
          left: 0.35rem;
          font-size: 0.78rem;
          padding: 0.12rem 0.3rem;
          border-radius: 4px;
        }
        .more {
          right: 0.3rem;
          bottom: 0.25rem;
          font-size: 0.7rem;
          padding: 0.1rem 0.35rem;
        }
      }
    `,
  ],
})
export class CalendarDayCellComponent {
  @Input({ required: true }) day!: CalendarDaySummary;
  @Output() open = new EventEmitter<string>();

  private readonly viewport = inject(ViewportService);
  private readonly i18n = inject(TranslateService);

  get dayNum(): number {
    return parseIsoParts(this.day.date).d;
  }

  get isToday(): boolean {
    return this.day.date === todayIsoLocal();
  }

  /** Already-ordered by backend — never re-sort here. */
  get visibleSegments(): CalendarSegmentSummary[] {
    if (this.viewport.isTabletUp()) {
      return this.day.segments;
    }
    return this.day.segments.slice(0, PHONE_VISIBLE_SEGMENTS);
  }

  get hiddenCount(): number {
    if (this.viewport.isTabletUp()) {
      return this.day.overflowCount;
    }
    const folded = Math.max(0, this.day.segments.length - PHONE_VISIBLE_SEGMENTS);
    return this.day.overflowCount + folded;
  }

  get overflowAriaLabel(): string {
    return `${this.i18n.t('calendar.overflowAria')}: ${this.hiddenCount}`;
  }

  get aria(): string {
    const n = this.day.segments.length + this.day.overflowCount;
    const todayHint = this.isToday ? `, ${this.i18n.t('calendar.today')}` : '';
    return `${this.day.date}, подій: ${n}${todayHint}`;
  }

  /** Focus the trigger explicitly (mouse click on <button> isn't guaranteed to
   * focus it on every platform — Safari in particular) so the drawer can
   * reliably return focus here on close. Programmatic focus() from a click
   * handler does not trigger :focus-visible in modern browsers. */
  onOpen(event: MouseEvent): void {
    (event.currentTarget as HTMLElement | null)?.focus({ preventScroll: true });
    this.open.emit(this.day.date);
    event.stopPropagation();
  }
}
