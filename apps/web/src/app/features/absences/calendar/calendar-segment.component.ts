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
      [class.work]="isWork"
      [class.partial]="isPartial"
      [attr.aria-label]="segment.ariaLabel"
      [attr.data-category]="segment.category ?? 'absence'"
      [attr.data-visual-kind]="segment.visualKind ?? 'absence'"
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
      /* Work events: red frame on the timed fill strip */
      .seg.work .seg-fill {
        box-shadow: inset 0 0 0 5px #dc2626;
      }
      .seg.work.card {
        border-width: 1px;
        border-color: color-mix(in srgb, var(--seg-color) 45%, var(--pw-border));
        box-shadow: none;
      }
      .seg.work.card .seg-fill {
        box-shadow: inset 0 0 0 4px #dc2626;
      }
      /* Partial day: green frame on the timed fill strip */
      .seg.partial .seg-fill {
        box-shadow: inset 0 0 0 5px #16a34a;
      }
      .seg.partial.card {
        border-width: 1px;
        border-color: color-mix(in srgb, var(--seg-color) 45%, var(--pw-border));
        box-shadow: none;
      }
      .seg.partial.card .seg-fill {
        box-shadow: inset 0 0 0 4px #16a34a;
      }
      .seg.pending {
        outline: 2px dashed color-mix(in srgb, var(--seg-color) 80%, #000);
        outline-offset: -3px;
      }
      /* Timed work/partial: pending outline on the fill strip only */
      .seg.work.pending,
      .seg.partial.pending {
        outline: none;
      }
      .seg.work.pending .seg-fill {
        outline: 4px dashed color-mix(in srgb, #dc2626 70%, #000);
        outline-offset: -4px;
      }
      .seg.partial.pending .seg-fill {
        outline: 4px dashed color-mix(in srgb, #16a34a 70%, #000);
        outline-offset: -4px;
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
      /* Absence hatches (e.g. part_time): -45deg; width from hatch ratios */
      .seg[data-pattern='hatch_left'] .seg-fill,
      .seg[data-pattern='hatch_mid'] .seg-fill,
      .seg[data-pattern='hatch_right'] .seg-fill,
      .seg[data-pattern='busy_anonymous'] .seg-fill {
        background-image: repeating-linear-gradient(
          -45deg,
          var(--seg-color) 0 8px,
          transparent 8px 18px
        );
        background-color: color-mix(in srgb, var(--seg-color) 35%, transparent);
        opacity: 1;
      }
      /* Work hatches: opposite direction (+45deg); still respect time ratios */
      .seg.work[data-pattern='hatch_left'] .seg-fill,
      .seg.work[data-pattern='hatch_mid'] .seg-fill,
      .seg.work[data-pattern='hatch_right'] .seg-fill,
      .seg.work[data-pattern='solid'] .seg-fill {
        background-image: repeating-linear-gradient(
          45deg,
          var(--seg-color) 0 8px,
          transparent 8px 18px
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

  get isWork(): boolean {
    return this.segment.category === 'work';
  }

  get isPartial(): boolean {
    return this.segment.visualKind === 'partial_absence';
  }
}
