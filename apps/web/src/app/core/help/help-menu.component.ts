import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  inject,
  input,
  signal,
} from '@angular/core';
import { HelpPageContextService } from './help-page-context.service';
import { HelpTourService } from './help-tour.service';
import type { HelpTourId } from './help-tour.models';

const MAIN_TOUR_ID: HelpTourId = 'app.main';

@Component({
  selector: 'loom-help-menu',
  standalone: true,
  template: `
    <div class="help-menu-wrap">
      <button
        #triggerBtn
        type="button"
        class="help-trigger"
        aria-haspopup="menu"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="ariaLabel()"
        [title]="ariaLabel()"
        (click)="toggle($event)"
      >
        ?
      </button>
      @if (open()) {
        <div class="help-menu" role="menu">
          @if (showMain()) {
            <button
              type="button"
              role="menuitem"
              class="help-menu-item"
              (click)="startOption(MAIN_TOUR_ID)"
            >
              Основне
            </button>
          }
          @if (pageOption(); as page) {
            <button
              type="button"
              role="menuitem"
              class="help-menu-item"
              [disabled]="page.disabled"
              (click)="onPageClick(page)"
            >
              {{ page.label }}
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .help-menu-wrap {
        position: relative;
        display: inline-grid;
      }
      .help-trigger {
        display: inline-grid;
        place-items: center;
        width: 1.85rem;
        height: 1.85rem;
        border-radius: 999px;
        border: 1px solid var(--pw-border, #d0d7e2);
        background: var(--pw-surface, #fff);
        color: var(--pw-muted, #656d76);
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        line-height: 1;
      }
      .help-trigger:hover {
        color: var(--pw-text, #1f2328);
        border-color: color-mix(in srgb, var(--pw-accent, #2563eb) 45%, var(--pw-border));
      }
      .help-menu {
        position: absolute;
        top: calc(100% + 0.35rem);
        right: 0;
        z-index: 40;
        min-width: 11rem;
        display: grid;
        padding: 0.35rem;
        border-radius: 10px;
        border: 1px solid var(--pw-border, #d0d7e2);
        background: var(--pw-surface, #fff);
        box-shadow: 0 10px 28px rgb(15 23 42 / 14%);
      }
      .help-menu-item {
        text-align: left;
        border: 0;
        background: transparent;
        padding: 0.45rem 0.65rem;
        border-radius: 8px;
        font: inherit;
        cursor: pointer;
        color: var(--pw-text, #1f2328);
      }
      .help-menu-item:hover:not(:disabled) {
        background: color-mix(in srgb, var(--pw-accent, #2563eb) 12%, transparent);
      }
      .help-menu-item:disabled {
        opacity: 0.55;
        cursor: default;
      }
    `,
  ],
})
export class HelpMenuComponent {
  private readonly help = inject(HelpTourService);
  private readonly pageContext = inject(HelpPageContextService);

  readonly showMain = input(true);
  readonly ariaLabel = input('Довідка');

  readonly open = signal(false);
  readonly MAIN_TOUR_ID = MAIN_TOUR_ID;

  @ViewChild('triggerBtn') private triggerBtn?: ElementRef<HTMLButtonElement>;

  pageOption(): {
    label: string;
    tourId: HelpTourId | null;
    disabled: boolean;
  } | null {
    const ctx = this.pageContext.current();
    if (!ctx) return null;
    if (ctx.tourId) {
      return { label: ctx.label, tourId: ctx.tourId, disabled: false };
    }
    if (ctx.soon) {
      return {
        label: `${ctx.label} · незабаром`,
        tourId: null,
        disabled: true,
      };
    }
    return { label: ctx.label, tourId: null, disabled: true };
  }

  toggle(event: Event): void {
    event.stopPropagation();
    this.open.update((v) => !v);
  }

  startOption(tourId: HelpTourId): void {
    const trigger = this.triggerBtn?.nativeElement ?? null;
    this.open.set(false);
    this.help.start(tourId, trigger);
  }

  onPageClick(page: {
    label: string;
    tourId: HelpTourId | null;
    disabled: boolean;
  }): void {
    if (page.disabled || !page.tourId) return;
    this.startOption(page.tourId);
  }

  closeMenu(restoreFocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (restoreFocus) {
      queueMicrotask(() => this.triggerBtn?.nativeElement.focus());
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.open()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeMenu(true);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const host = this.triggerBtn?.nativeElement.closest('.help-menu-wrap');
    if (host && event.target instanceof Node && host.contains(event.target)) {
      return;
    }
    this.closeMenu(false);
  }
}
