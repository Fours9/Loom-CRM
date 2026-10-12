import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
  input,
  output,
} from '@angular/core';
import { HelpTriggerComponent } from '../../core/help/help-trigger.component';
import type { HelpTourId } from '../../core/help/help-tour.models';
import { OverlayScrollLockService } from '../../core/overlay/overlay-scroll-lock.service';

@Component({
  selector: 'loom-catalog-edit-dialog',
  standalone: true,
  imports: [HelpTriggerComponent],
  template: `
    <div
      class="backdrop"
      (mousedown)="onBackdropPointerDown($event)"
      (click)="onBackdropClick($event)"
    >
      <div
        class="modal"
        (mousedown)="$event.stopPropagation()"
        (click)="$event.stopPropagation()"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="headingId()"
      >
        <div class="head">
          <button
            type="button"
            class="icon-close"
            aria-label="Закрити"
            title="Закрити"
            (click)="closed.emit()"
          >
            ×
          </button>
          <div class="head-title">
            <h2 [id]="headingId()">{{ title() }}</h2>
            <loom-help-trigger [tourId]="tourId()" ariaLabel="Підказка про цю форму" />
          </div>
          <div class="head-actions">
            <ng-content select="[catalogHeadActions]" />
          </div>
        </div>

        <div class="body">
          @if (error()) {
            <p class="error">{{ error() }}</p>
          }

          <ng-content />
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: var(--pw-z-modal, 250);
        display: grid;
        place-items: center;
        background: color-mix(in srgb, #0f172a 45%, transparent);
        padding: calc(var(--shell-topbar-h, 0px) + 0.75rem) 1rem 0.75rem;
      }
      .modal {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 0.85rem;
        width: min(28rem, 100%);
        margin: auto;
        position: relative;
        padding: 3.25rem 0 0;
        border-radius: 12px;
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
        max-height: calc(100dvh - var(--shell-topbar-h, 0px) - 1.75rem);
        /* Keep shell open so nested menus are not clipped; .body scrolls. */
        overflow: visible;
      }
      .head {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
        padding: 0 1.2rem;
      }
      .head-title {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        flex: 1 1 auto;
        min-width: 0;
      }
      .head-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
        justify-content: flex-end;
      }
      .body {
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 0 1.2rem 1.1rem;
      }
      h2 {
        margin: 0;
        font-size: 1.1rem;
      }
      .error {
        margin: 0 0 0.75rem;
        color: var(--pw-danger);
      }
      .icon-close {
        position: absolute;
        top: 0.55rem;
        right: 0.7rem;
        z-index: 1;
        display: inline-grid;
        place-items: center;
        width: 2.25rem;
        min-width: 2.25rem;
        height: 2.25rem;
        padding: 0;
        font-size: 1.35rem;
        line-height: 1;
        background: transparent;
        color: var(--pw-text);
        border: 1px solid var(--pw-border-strong);
        border-radius: 8px;
        cursor: pointer;
      }
    `,
  ],
})
/**
 * Visual chrome only. Reparenting belongs on the outer `@if`-gated host via
 * `PwDialogHostDirective` — never attach here.
 */
export class CatalogEditDialogComponent implements OnInit, OnDestroy {
  private readonly scrollLock = inject(OverlayScrollLockService);
  readonly headingId = input.required<string>();
  readonly title = input.required<string>();
  readonly tourId = input.required<HelpTourId>();
  readonly error = input('');
  readonly closed = output<void>();
  private backdropPress = false;

  ngOnInit(): void {
    this.scrollLock.acquire();
  }

  ngOnDestroy(): void {
    this.scrollLock.release();
  }

  onBackdropPointerDown(event: Event): void {
    this.backdropPress = event.target === event.currentTarget;
  }

  onBackdropClick(event: Event): void {
    if (this.backdropPress && event.target === event.currentTarget) {
      this.closed.emit();
    }
    this.backdropPress = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }
}
