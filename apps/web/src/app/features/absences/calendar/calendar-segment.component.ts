import { Component, Input } from '@angular/core';
import { CalendarSegmentSummary } from '../core/api/models';
import { isValidCalendarHex } from './calendar-date.util';

@Component({
  selector: 'app-calendar-segment',
  standalone: true,
  template: `
    <div
      class="seg"
      [class.pending]="segment.statusGroup === 'pending'"
      [class.busy]="segment.pattern === 'busy_anonymous'"
      [class.ended]="ended || segment.periodEnded"
      [class.card]="variant === 'card'"
      [attr.aria-label]="segment.ariaLabel"
      [style.--seg-color]="safeColor"
      [style.--hatch-start]="segment.hatchStartRatio"
      [style.--hatch-end]="segment.hatchEndRatio"
      [attr.data-pattern]="segment.pattern"
      role="img"
    >
      <span class="seg-fill"></span>
      <span class="seg-label">{{ segment.label }}</span>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 0;
        width: 100%;
      }
      :host(.band-host) {
        height: 100%;
        flex: 1 1 0;
      }
      .seg {
        position: relative;
        box-sizing: border-box;
        width: 100%;
        overflow: hidden;
        border: 0;
        background: color-mix(in srgb, var(--seg-color) 22%, var(--pw-surface));
      }
      :host(.band-host) .seg {
        height: 100%;
        min-height: 100%;
        border-radius: 0;
        border-bottom: 1px solid color-mix(in srgb, var(--pw-surface) 55%, transparent);
      }
      :host(.band-host):last-child .seg {
        border-bottom: 0;
      }
      .seg.card {
        height: 4.25rem;
        min-height: 4.25rem;
        border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--seg-color) 45%, var(--pw-border));
      }
      .seg.pending {
        outline: 2px dashed color-mix(in srgb, var(--seg-color) 80%, #000);
        outline-offset: -3px;
      }
      .seg.ended {
        filter: grayscale(0.45);
        opacity: 0.72;
      }
      .seg.ended .seg-fill {
        opacity: 0.7;
      }
      .seg.ended.card {
        border-color: color-mix(in srgb, #64748b 55%, var(--pw-border));
        background: color-mix(in srgb, #94a3b8 18%, var(--pw-surface));
      }
      .seg-fill {
        position: absolute;
        top: 0;
        bottom: 0;
        left: calc(var(--hatch-start) * 100%);
        width: calc((var(--hatch-end) - var(--hatch-start)) * 100%);
        background: var(--seg-color);
        opacity: 0.92;
      }
      .seg[data-pattern='solid'] .seg-fill {
        left: 0;
        width: 100%;
      }
      .seg[data-pattern='hatch_left'] .seg-fill,
      .seg[data-pattern='hatch_mid'] .seg-fill,
      .seg[data-pattern='hatch_right'] .seg-fill,
      .seg[data-pattern='busy_anonymous'] .seg-fill {
        background-image: repeating-linear-gradient(
          -45deg,
          var(--seg-color) 0 3px,
          transparent 3px 7px
        );
        background-color: color-mix(in srgb, var(--seg-color) 35%, transparent);
        opacity: 1;
      }
      .seg-label {
        position: absolute;
        z-index: 1;
        left: 0.5rem;
        right: 0.5rem;
        bottom: 0.4rem;
        font-size: 0.8rem;
        font-weight: 600;
        line-height: 1.15;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #fff;
        text-shadow: 0 1px 2px color-mix(in srgb, #000 55%, transparent);
        pointer-events: none;
      }
    `,
  ],
  host: {
    '[class.band-host]': 'variant === "band"',
  },
})
export class CalendarSegmentComponent {
  @Input({ required: true }) segment!: CalendarSegmentSummary;
  /** `band` — equal slice in month cell; `card` — separate block in drawer/list. */
  @Input() variant: 'band' | 'card' = 'band';
  /** Override / force muted “already ended” look (drawer). */
  @Input() ended = false;

  get safeColor(): string {
    return isValidCalendarHex(this.segment.color) ? this.segment.color : '#6B7280';
  }
}
