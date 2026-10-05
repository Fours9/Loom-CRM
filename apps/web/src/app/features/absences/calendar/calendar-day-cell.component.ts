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
        min-height: 3.75rem;
        height: 100%;
        padding: 0;
        border: 1px solid var(--pw-border);
        border-radius: 10px;
        background:
          linear-gradient(
            180deg,
            color-mix(in srgb, var(--pw-surface) 100%, transparent) 0%,
            color-mix(in srgb, var(--pw-surface-2) 70%, var(--pw-surface)) 100%
          );
        cursor: pointer;
        text-align: left;
        color: inherit;
        overflow: hidden;
        box-shadow: 0 1px 3px color-mix(in srgb, var(--pw-shadow) 55%, transparent);
        transition:
          border-color 0.15s ease,
          box-shadow 0.15s ease,
          transform 0.15s ease;
      }
      .cell:hover {
        border-color: color-mix(in srgb, var(--pw-accent) 50%, var(--pw-border));
        box-shadow: 0 6px 16px var(--pw-shadow);
        transform: translateY(-1px);
      }
      .cell:focus-visible {
        outline: 2px solid var(--pw-accent);
        outline-offset: 2px;
      }
      .cell.empty {
        background: color-mix(in srgb, var(--pw-surface) 92%, var(--pw-surface-2));
      }
      .cell.today {
        border-color: var(--pw-accent);
        border-width: 2px;
        box-shadow:
          0 0 0 1px color-mix(in srgb, var(--pw-accent) 25%, transparent),
          0 6px 16px var(--pw-shadow);
      }
      .cell.today .dom {
        background: var(--pw-accent);
        color: var(--pw-on-accent, #fff);
      }
      .dom {
        position: absolute;
        top: 0.2rem;
        left: 0.22rem;
        z-index: 3;
        font-size: 0.68rem;
        font-weight: 750;
        line-height: 1;
        padding: 0.18rem 0.32rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--pw-surface) 88%, transparent);
        color: var(--pw-text-strong, inherit);
        border: 1px solid color-mix(in srgb, var(--pw-border) 70%, transparent);
        pointer-events: none;
        backdrop-filter: blur(4px);
      }
      .bands {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 3.75rem;
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
        right: 0.18rem;
        bottom: 0.16rem;
        z-index: 3;
        font-size: 0.6rem;
        font-weight: 750;
        padding: 0.12rem 0.35rem;
        border-radius: 999px;
        background: var(--pw-accent-soft);
        color: var(--pw-accent);
        border: 1px solid color-mix(in srgb, var(--pw-accent) 22%, transparent);
        pointer-events: none;
      }
      @media (min-width: 641px) {
        .cell {
          min-height: 7.25rem;
          border-radius: 12px;
        }
        .bands {
          min-height: 7.25rem;
        }
        .bands > .band,
        .bands > app-calendar-segment {
          min-height: 0;
        }
        .bands ::ng-deep .seg-label {
          display: block;
        }
        .dom {
          top: 0.35rem;
          left: 0.4rem;
          font-size: 0.8rem;
          padding: 0.2rem 0.42rem;
        }
        .more {
          right: 0.35rem;
          bottom: 0.3rem;
          font-size: 0.7rem;
          padding: 0.14rem 0.42rem;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .cell {
          transition: none;
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
