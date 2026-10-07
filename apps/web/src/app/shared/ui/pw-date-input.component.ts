import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  forwardRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  parseIsoParts,
  toIsoDate,
  todayIsoLocal,
} from './date-iso.util';
import { commitPwControlValue } from './pw-cva-commit';
import {
  claimPwOverlay,
  releasePwOverlay,
  type PwOverlayHandle,
} from './pw-overlay-session';

const MONTHS_UA = [
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

@Component({
  selector: 'loom-pw-date-input',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PwDateInputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="wrap" [class.open]="open()" [class.disabled]="isDisabled()">
      <button
        type="button"
        class="trigger"
        [attr.aria-expanded]="open()"
        [attr.aria-disabled]="isDisabled()"
        [disabled]="isDisabled()"
        aria-haspopup="dialog"
        (click)="toggle($event)"
      >
        <span class="value" [class.placeholder]="!displayValue()">{{
          displayValue() || placeholder()
        }}</span>
        <span class="icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path
              fill="currentColor"
              d="M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V2zm12 7H5v10h14V9z"
            />
          </svg>
        </span>
      </button>

      @if (open()) {
        <div class="popover" role="dialog" (click)="$event.stopPropagation()">
          <div class="pop-head">
            <strong>{{ monthTitle() }}</strong>
            <div class="nav">
              <button type="button" class="icon-btn" (click)="shiftMonth(-1)" aria-label="Попередній місяць">
                ↑
              </button>
              <button type="button" class="icon-btn" (click)="shiftMonth(1)" aria-label="Наступний місяць">
                ↓
              </button>
            </div>
          </div>
          <div class="weekdays" aria-hidden="true">
            @for (d of weekdays; track d) {
              <span>{{ d }}</span>
            }
          </div>
          <div class="grid">
            @for (cell of cells(); track cell.key) {
              <button
                type="button"
                class="day"
                [class.outside]="cell.outside"
                [class.selected]="cell.iso === currentValue()"
                [class.today]="cell.iso === today"
                (click)="choose(cell.iso)"
              >
                {{ cell.day }}
              </button>
            }
          </div>
          <div class="pop-foot">
            <button type="button" class="link" (click)="clear()">Очистити</button>
            <button type="button" class="link" (click)="choose(today)">Сьогодні</button>
          </div>
        </div>
      }
    </div>
  `,
  host: {
    '[class.open]': 'open()',
    '[class.disabled]': 'isDisabled()',
  },
  styles: [
    `
      :host {
        display: block;
        position: relative;
        z-index: 1;
        min-width: 9.5rem;
        overflow: visible;
      }
      :host(.open) {
        z-index: 30;
      }
      :host(.disabled) {
        opacity: 0.55;
        pointer-events: none;
      }
      .wrap {
        position: relative;
        z-index: 1;
        overflow: visible;
      }
      .wrap.open {
        z-index: 30;
      }
      .wrap.disabled .trigger {
        cursor: not-allowed;
      }
      .trigger {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        box-sizing: border-box;
        min-height: var(--pw-control-h, 2.6rem);
        padding: 0.45rem 0.7rem;
        border: 1px solid var(--pw-border-strong, var(--pw-border));
        border-radius: var(--pw-radius, 12px);
        background: var(--pw-input-bg, var(--pw-surface));
        color: var(--pw-text);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        transition:
          border-color 0.16s ease,
          box-shadow 0.16s ease;
      }
      .trigger:hover:not(:disabled) {
        border-color: color-mix(in srgb, var(--pw-accent) 40%, var(--pw-border));
      }
      .wrap.open .trigger {
        border-color: var(--pw-accent);
        box-shadow: var(
          --pw-focus-ring,
          0 0 0 3px color-mix(in srgb, var(--pw-accent) 28%, transparent)
        );
      }
      .value {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .placeholder {
        color: var(--pw-muted);
        font-weight: 500;
      }
      .icon {
        display: inline-grid;
        place-items: center;
        color: var(--pw-accent);
      }
      .popover {
        position: absolute;
        right: 0;
        top: calc(100% + 6px);
        z-index: 40;
        width: min(18.5rem, 92vw);
        padding: 0.75rem;
        border: 1px solid color-mix(in srgb, var(--pw-accent) 16%, var(--pw-border));
        border-radius: 16px;
        background: var(--pw-surface);
        box-shadow: 0 12px 32px var(--pw-shadow-md, var(--pw-shadow));
        animation: pw-menu-rise 0.2s ease both;
      }
      .pop-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.55rem;
      }
      .pop-head strong {
        font-size: 0.95rem;
        letter-spacing: -0.01em;
        text-transform: capitalize;
      }
      .nav {
        display: inline-flex;
        gap: 0.2rem;
      }
      .icon-btn {
        width: 2rem;
        height: 2rem;
        border: 1px solid var(--pw-border);
        border-radius: 10px;
        background: var(--pw-surface-2, var(--pw-surface));
        color: var(--pw-text);
        cursor: pointer;
        font-weight: 700;
      }
      .icon-btn:hover {
        border-color: var(--pw-accent);
        color: var(--pw-accent);
      }
      .weekdays {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 0.15rem;
        margin-bottom: 0.25rem;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--pw-muted);
        text-align: center;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 0.2rem;
      }
      .day {
        aspect-ratio: 1;
        border: 0;
        border-radius: 10px;
        background: transparent;
        color: var(--pw-text);
        font: inherit;
        font-weight: 650;
        cursor: pointer;
        transition:
          background 0.14s ease,
          color 0.14s ease,
          transform 0.14s ease;
      }
      .day:hover {
        background: var(--pw-accent-soft);
        color: var(--pw-accent);
      }
      .day.outside {
        color: var(--pw-muted);
        opacity: 0.55;
      }
      .day.today {
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pw-accent) 45%, transparent);
      }
      .day.selected {
        background: var(--pw-accent);
        color: var(--pw-on-accent, #fff);
      }
      .pop-foot {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        margin-top: 0.65rem;
        padding-top: 0.55rem;
        border-top: 1px solid var(--pw-border);
      }
      .link {
        border: 0;
        background: transparent;
        color: var(--pw-accent);
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        padding: 0.25rem 0.15rem;
      }
      .link:hover {
        text-decoration: underline;
      }
      @keyframes pw-menu-rise {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .popover,
        .day,
        .trigger {
          animation: none !important;
          transition: none !important;
        }
      }
    `,
  ],
})
export class PwDateInputComponent
  implements ControlValueAccessor, OnDestroy, PwOverlayHandle
{
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Prefer either `[value]`+`(valueChange)` or `ngModel`/`formControlName` — not both. */
  readonly value = input('');
  readonly placeholder = input('дд.мм.рррр');
  readonly disabled = input(false);
  readonly valueChange = output<string>();

  /** Syncs from `[value]` when bound; `writeValue` / choose may override until next input change. */
  private readonly internalValue = linkedSignal(() => this.value());
  private readonly cvaDisabled = signal(false);
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  readonly open = signal(false);
  readonly viewYear = signal(new Date().getFullYear());
  readonly viewMonth = signal(new Date().getMonth() + 1); // 1-12
  readonly today = todayIsoLocal();
  readonly weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  readonly currentValue = computed(() => this.internalValue());
  readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());

  readonly displayValue = computed(() => {
    const iso = this.currentValue();
    if (!iso) return '';
    const { y, m, d } = parseIsoParts(iso);
    if (!y || !m || !d) return iso;
    return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
  });

  readonly monthTitle = computed(() => {
    const name = MONTHS_UA[this.viewMonth() - 1] ?? '';
    return `${name} ${this.viewYear()} р.`;
  });

  readonly cells = computed(() => {
    const y = this.viewYear();
    const m = this.viewMonth();
    const first = new Date(y, m - 1, 1);
    const js = first.getDay(); // 0 Sun
    const mondayOffset = js === 0 ? -6 : 1 - js;
    const start = new Date(y, m - 1, 1 + mondayOffset);
    const out: Array<{ key: string; iso: string; day: number; outside: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = toIsoDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
      out.push({
        key: iso,
        iso,
        day: dt.getDate(),
        outside: dt.getMonth() + 1 !== m,
      });
    }
    return out;
  });

  writeValue(value: string | null): void {
    this.internalValue.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled.set(isDisabled);
  }

  ngOnDestroy(): void {
    releasePwOverlay(this);
  }

  closeFromOverlaySession(): void {
    this.open.set(false);
  }

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    if (this.isDisabled()) return;
    if (this.open()) {
      this.closeMenu();
      return;
    }
    this.syncViewToValue();
    this.openMenu();
  }

  shiftMonth(delta: number): void {
    let m = this.viewMonth() + delta;
    let y = this.viewYear();
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    this.viewMonth.set(m);
    this.viewYear.set(y);
  }

  choose(iso: string): void {
    if (this.isDisabled()) return;
    this.commit(iso);
    this.closeMenu();
  }

  clear(): void {
    if (this.isDisabled()) return;
    this.commit('');
    this.closeMenu();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  private commit(iso: string): void {
    commitPwControlValue(iso, {
      setValue: (v) => this.internalValue.set(v),
      emitValueChange: (v) => this.valueChange.emit(v),
      cvaOnChange: this.onChange,
      cvaOnTouched: this.onTouched,
    });
  }

  private openMenu(): void {
    claimPwOverlay(this);
    this.open.set(true);
  }

  private closeMenu(): void {
    this.open.set(false);
    releasePwOverlay(this);
  }

  private syncViewToValue(): void {
    const iso = this.currentValue() || this.today;
    const { y, m } = parseIsoParts(iso);
    if (y && m) {
      this.viewYear.set(y);
      this.viewMonth.set(m);
    }
  }
}
