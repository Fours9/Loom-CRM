import { Component, HostListener, OnDestroy, OnInit, inject, input, output } from '@angular/core';
import { OverlayScrollLockService } from '../../core/overlay/overlay-scroll-lock.service';

@Component({
  selector: 'loom-catalog-edit-dialog',
  standalone: true,
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
          <h2 [id]="headingId()">{{ title() }}</h2>
          <div class="head-actions">
            <ng-content select="[catalogHeadActions]" />
          </div>
        </div>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <ng-content />
      </div>
    </div>
  `,
  styles: [
    `
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: 50;
        display: grid;
        place-items: center;
        align-items: start;
        background: color-mix(in srgb, #0f172a 45%, transparent);
        padding: calc(var(--shell-topbar-h, 0px) + 1rem) 1rem 0.75rem;
        overflow-y: auto;
      }
      .modal {
        display: grid;
        gap: 0.85rem;
        width: min(28rem, 100%);
        margin: auto;
        position: relative;
        padding: 3.25rem 1.2rem 1.1rem;
        border-radius: 12px;
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
        max-height: calc(100dvh - var(--shell-topbar-h, 0px) - 1.75rem);
        overflow: auto;
      }
      .head {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
      }
      .head-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
        justify-content: flex-end;
      }
      h2 {
        margin: 0;
        font-size: 1.1rem;
      }
      .error {
        margin: 0;
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
export class CatalogEditDialogComponent implements OnInit, OnDestroy {
  private readonly scrollLock = inject(OverlayScrollLockService);
  readonly headingId = input.required<string>();
  readonly title = input.required<string>();
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
