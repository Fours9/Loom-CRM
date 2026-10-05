import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  claimPwOverlay,
  releasePwOverlay,
  type PwOverlayHandle,
} from './pw-overlay-session';

export type PwSelectOption = { value: string; label: string };

@Component({
  selector: 'loom-pw-select',
  standalone: true,
  template: `
    <div class="wrap" [class.open]="open()">
      <button
        type="button"
        class="trigger"
        [attr.aria-expanded]="open()"
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
              [attr.aria-selected]="opt.value === value()"
              [class.active]="opt.value === value()"
              (click)="choose(opt.value)"
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
      .wrap {
        position: relative;
        z-index: 1;
        overflow: visible;
      }
      .wrap.open {
        z-index: 30;
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
      .trigger:hover {
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
        z-index: 40;
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
export class PwSelectComponent implements OnDestroy, PwOverlayHandle {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly value = input('');
  readonly options = input<PwSelectOption[]>([]);
  readonly placeholder = input('Усі');
  readonly valueChange = output<string>();

  readonly open = signal(false);

  readonly selectedLabel = computed(() => {
    const v = this.value();
    return this.options().find((o) => o.value === v)?.label ?? '';
  });

  ngOnDestroy(): void {
    releasePwOverlay(this);
  }

  closeFromOverlaySession(): void {
    this.open.set(false);
  }

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    if (this.open()) {
      this.closeMenu();
      return;
    }
    this.openMenu();
  }

  choose(value: string): void {
    this.valueChange.emit(value);
    this.closeMenu();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  private openMenu(): void {
    claimPwOverlay(this);
    this.open.set(true);
  }

  private closeMenu(): void {
    this.open.set(false);
    releasePwOverlay(this);
  }
}
