import { Component, Input } from '@angular/core';
import { CalendarSegmentSummary } from '../core/api/models';
import { isValidCalendarHex } from './calendar-date.util';
import {
  listAxisHourCount,
  listAxisHourLabels,
  listAxisPlacement,
} from './calendar-list-axis.util';

@Component({
  selector: 'app-calendar-list-events',
  standalone: true,
  template: `
    <div class="events" [style.--hour-count]="hourCount">
      @if (showHeader) {
        <div class="hour-head" aria-hidden="true">
          @for (h of hourLabels; track h) {
            <span class="hour-tick">{{ h }}</span>
          }
        </div>
      }
      <div class="lanes">
        @for (s of segments; track s.key) {
          <div
            class="lane"
            [class.pending]="s.statusGroup === 'pending'"
            [class.ended]="s.periodEnded"
            [attr.aria-label]="s.ariaLabel"
          >
            <div class="grid" aria-hidden="true">
              @for (h of hourLabels; track h) {
                <span class="col"></span>
              }
            </div>
            <div
              class="bar"
              [class.hatch]="isHatch(s)"
              [style.left.%]="barLeft(s)"
              [style.width.%]="barWidth(s)"
              [style.--seg-color]="safeColor(s)"
            >
              <span class="bar-label">{{ s.label }}</span>
              @if (s.startTime && s.endTime) {
                <span class="bar-time">{{ s.startTime.slice(0, 5) }}–{{ s.endTime.slice(0, 5) }}</span>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .events {
        display: grid;
        gap: 0.35rem;
        width: 100%;
        text-align: left;
      }
      .hour-head {
        display: grid;
        grid-template-columns: repeat(var(--hour-count), minmax(0, 1fr));
        font-size: 0.7rem;
        font-weight: 600;
        color: var(--pw-muted);
        border-bottom: 2px solid color-mix(in srgb, var(--pw-muted) 40%, var(--pw-border-strong));
        padding-bottom: 0.3rem;
      }
      .hour-tick {
        text-align: center;
        border-left: 2px solid color-mix(in srgb, var(--pw-muted) 40%, var(--pw-border-strong));
        line-height: 1.2;
      }
      .hour-tick:first-child {
        border-left: 0;
      }
      .hour-tick:last-child {
        border-right: 2px solid color-mix(in srgb, var(--pw-muted) 40%, var(--pw-border-strong));
      }
      .lanes {
        display: grid;
        gap: 0.4rem;
      }
      .lane {
        position: relative;
        height: 3.1rem;
        border-radius: 8px;
        overflow: hidden;
        background: color-mix(in srgb, var(--pw-surface) 88%, var(--pw-border));
        box-shadow: inset 0 0 0 2px
          color-mix(in srgb, var(--pw-muted) 35%, var(--pw-border-strong));
      }
      .grid {
        position: absolute;
        inset: 0;
        display: grid;
        grid-template-columns: repeat(var(--hour-count), minmax(0, 1fr));
        pointer-events: none;
        z-index: 0;
      }
      .col {
        border-left: 2px solid color-mix(in srgb, var(--pw-muted) 40%, var(--pw-border-strong));
      }
      .col:first-child {
        border-left: 0;
      }
      .col:last-child {
        border-right: 2px solid color-mix(in srgb, var(--pw-muted) 40%, var(--pw-border-strong));
      }
      .bar {
        position: absolute;
        top: 0.2rem;
        bottom: 0.2rem;
        z-index: 1;
        box-sizing: border-box;
        border-radius: 6px;
        padding: 0.2rem 0.4rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0.05rem;
        overflow: hidden;
        background: color-mix(in srgb, var(--seg-color) 88%, #000);
        border: 1px solid color-mix(in srgb, var(--seg-color) 55%, var(--pw-border));
        color: #fff;
        text-shadow: 0 1px 2px color-mix(in srgb, #000 55%, transparent);
      }
      .bar.hatch {
        background-image: repeating-linear-gradient(
          -45deg,
          var(--seg-color) 0 3px,
          transparent 3px 7px
        );
        background-color: color-mix(in srgb, var(--seg-color) 42%, transparent);
      }
      .lane.pending .bar {
        outline: 2px dashed color-mix(in srgb, var(--seg-color) 80%, #000);
        outline-offset: -2px;
      }
      .lane.ended .bar {
        filter: grayscale(0.45);
        opacity: 0.72;
      }
      .bar-label {
        font-size: 0.72rem;
        font-weight: 700;
        line-height: 1.15;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .bar-time {
        font-size: 0.68rem;
        font-weight: 600;
        opacity: 0.95;
        white-space: nowrap;
      }
    `,
  ],
})
export class CalendarListEventsComponent {
  @Input({ required: true }) segments!: CalendarSegmentSummary[];
  /** Show hour labels above lanes (use once in table header). */
  @Input() showHeader = false;

  readonly hourLabels = listAxisHourLabels();
  readonly hourCount = listAxisHourCount();

  barLeft(segment: CalendarSegmentSummary): number {
    return listAxisPlacement(segment).leftPct;
  }

  barWidth(segment: CalendarSegmentSummary): number {
    return listAxisPlacement(segment).widthPct;
  }

  safeColor(segment: CalendarSegmentSummary): string {
    return isValidCalendarHex(segment.color) ? segment.color : '#6B7280';
  }

  isHatch(segment: CalendarSegmentSummary): boolean {
    return (
      segment.pattern === 'hatch_left' ||
      segment.pattern === 'hatch_mid' ||
      segment.pattern === 'hatch_right' ||
      segment.pattern === 'busy_anonymous'
    );
  }
}
