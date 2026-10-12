import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  forwardRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { commitPwControlValue } from './pw-cva-commit';
import {
  claimPwOverlay,
  releasePwOverlay,
  type PwOverlayHandle,
} from './pw-overlay-session';
import { listenPwOverlayOutsideClick } from './pw-overlay-outside-click';

export type PwSelectOption = { value: string; label: string };

@Component({
  selector: 'loom-pw-select',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PwSelectComponent),
      multi: true,
    },
  ],
  template: `
    <div
      class="wrap"
      [class.open]="open()"
      [class.drop-up]="openUp()"
      [class.disabled]="isDisabled()"
    >
      <button
        type="button"
        class="trigger"
        [attr.aria-expanded]="open()"
        [attr.aria-disabled]="isDisabled()"
        [disabled]="isDisabled()"
        aria-haspopup="listbox"
        (click)="toggle($event)"
      >
        <span class="value" [class.placeholder]="!selectedLabel()">{{
          selectedLabel() || placeholder()
        }}</span>
        <span class="caret" aria-hidden="true">▾</span>
      </button>

      @if (open()) {
        <ul class="pw-menu menu" role="listbox" (click)="$event.stopPropagation()">
          @for (opt of options(); track opt.value) {
            <li
              role="option"
              [attr.aria-selected]="opt.value === currentValue()"
              [class.active]="opt.value === currentValue()"
              (click)="choose(opt.value, $event)"
            >
              {{ opt.label }}
            </li>
          }
        </ul>
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
        min-width: 8rem;
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
      .caret {
        flex: 0 0 auto;
        color: var(--pw-muted);
        font-size: 0.75rem;
        line-height: 1;
        transition: transform 0.18s ease;
      }
      .wrap.open .caret {
        transform: rotate(180deg);
        color: var(--pw-accent);
      }
      .menu {
        position: absolute;
        left: 0;
        right: 0;
        top: calc(100% + 6px);
        bottom: auto;
        z-index: 40;
      }
      .wrap.drop-up .menu {
        top: auto;
        bottom: calc(100% + 6px);
      }
      @media (prefers-reduced-motion: reduce) {
        .caret,
        .trigger {
          transition: none !important;
        }
      }
    `,
  ],
})
export class PwSelectComponent
  implements ControlValueAccessor, OnInit, OnDestroy, PwOverlayHandle
{
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly dropdownGapPx = 6;
  private readonly estimatedMenuMaxPx = 280;
  private stopOutsideClick: (() => void) | null = null;

  /** Prefer either `[value]`+`(valueChange)` or `ngModel`/`formControlName` — not both. */
  readonly value = input('');
  readonly options = input<PwSelectOption[]>([]);
  readonly placeholder = input('Усі');
  readonly disabled = input(false);
  readonly valueChange = output<string>();

  /** Syncs from `[value]` when bound; `writeValue` / choose may override until next input change. */
  private readonly internalValue = linkedSignal(() => this.value());
  private readonly cvaDisabled = signal(false);
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  readonly open = signal(false);
  readonly openUp = signal(false);

  readonly currentValue = computed(() => this.internalValue());
  readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());

  readonly selectedLabel = computed(() => {
    const v = this.currentValue();
    return this.options().find((o) => o.value === v)?.label ?? '';
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

  ngOnInit(): void {
    this.stopOutsideClick = listenPwOverlayOutsideClick(
      this.host,
      () => this.open(),
      () => this.closeMenu(),
    );
  }

  ngOnDestroy(): void {
    this.stopOutsideClick?.();
    this.stopOutsideClick = null;
    releasePwOverlay(this);
  }

  closeFromOverlaySession(): void {
    this.open.set(false);
    this.openUp.set(false);
  }

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    if (this.isDisabled()) return;
    if (this.open()) {
      this.closeMenu();
      return;
    }
    this.openMenu();
  }

  choose(value: string, event?: Event): void {
    // Inside a wrapping <label>, option clicks would also activate the trigger
    // and reopen the menu — block that default before closing.
    event?.preventDefault();
    event?.stopPropagation();
    if (this.isDisabled()) return;
    commitPwControlValue(value, {
      setValue: (v) => this.internalValue.set(v),
      emitValueChange: (v) => this.valueChange.emit(v),
      cvaOnChange: this.onChange,
      cvaOnTouched: this.onTouched,
    });
    this.closeMenu();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.open()) this.updatePlacement();
  }

  private openMenu(): void {
    claimPwOverlay(this);
    this.openUp.set(false);
    this.open.set(true);
    setTimeout(() => this.updatePlacement());
  }

  private closeMenu(): void {
    this.open.set(false);
    this.openUp.set(false);
    releasePwOverlay(this);
  }

  private estimatedMenuHeight(): number {
    const rows = Math.max(this.options().length, 1);
    return Math.min(this.estimatedMenuMaxPx, 12 + rows * 40);
  }

  private shouldOpenUp(neededPx: number): boolean {
    const trigger = this.host.nativeElement.querySelector('.trigger') as HTMLElement | null;
    if (!trigger) return false;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - this.dropdownGapPx;
    const spaceAbove = rect.top - this.dropdownGapPx;
    return spaceBelow < neededPx && spaceAbove > spaceBelow;
  }

  private updatePlacement(): void {
    if (!this.open()) return;
    const menu = this.host.nativeElement.querySelector('.menu') as HTMLElement | null;
    const needed = menu?.offsetHeight || this.estimatedMenuHeight();
    this.openUp.set(this.shouldOpenUp(needed));
  }
}
