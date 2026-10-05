import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { OverlayScrollLockService } from '../overlay/overlay-scroll-lock.service';
import { HelpTourService } from './help-tour.service';

@Component({
  selector: 'loom-help-spotlight-overlay',
  standalone: true,
  template: `
    @if (help.session(); as s) {
      <div
        class="help-root"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
      >
        <div
          class="help-dim"
          [class.help-dim--clear]="!!s.hole"
          (click)="help.close('user')"
        ></div>
        @if (s.hole) {
          <div
            class="help-hole"
            [style.top.px]="s.hole.top - pad"
            [style.left.px]="s.hole.left - pad"
            [style.width.px]="s.hole.width + pad * 2"
            [style.height.px]="s.hole.height + pad * 2"
          ></div>
        }
        <div class="help-panel" #panel>
          <h2 [id]="titleId">{{ s.step.title }}</h2>
          <p>{{ s.step.body }}</p>
          <div class="help-actions">
            <button type="button" class="btn ghost" (click)="help.close('user')">
              Закрити
            </button>
            <div class="help-nav">
              <button
                type="button"
                class="btn"
                [disabled]="s.stepIndex === 0"
                (click)="help.prev()"
              >
                Назад
              </button>
              <button type="button" class="btn primary" #nextBtn (click)="onNext()">
                {{ isLast(s) ? 'Готово' : 'Далі' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .help-root {
        position: fixed;
        inset: 0;
        z-index: 9000;
        pointer-events: auto;
      }
      .help-dim {
        position: absolute;
        inset: 0;
        background: color-mix(in srgb, #0f172a 55%, transparent);
      }
      .help-dim--clear {
        background: transparent;
      }
      .help-hole {
        position: fixed;
        border-radius: 10px;
        box-shadow: 0 0 0 9999px color-mix(in srgb, #0f172a 55%, transparent);
        outline: 2px solid var(--pw-accent, #2563eb);
        pointer-events: none;
        z-index: 1;
      }
      .help-panel {
        position: fixed;
        z-index: 2;
        left: 50%;
        bottom: max(1.25rem, env(safe-area-inset-bottom, 0px));
        transform: translateX(-50%);
        width: min(28rem, calc(100% - 2rem));
        display: grid;
        gap: 0.65rem;
        padding: 1rem 1.1rem 1.05rem;
        border-radius: 12px;
        background: var(--pw-surface, #fff);
        border: 1px solid var(--pw-border, #d0d7e2);
        box-shadow: 0 12px 32px rgb(15 23 42 / 18%);
        color: var(--pw-text, #1f2328);
      }
      h2 {
        margin: 0;
        font-size: 1.05rem;
      }
      p {
        margin: 0;
        font-size: 0.92rem;
        line-height: 1.45;
        color: var(--pw-muted, #656d76);
        white-space: pre-line;
      }
      .help-actions {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        align-items: center;
        margin-top: 0.25rem;
      }
      .help-nav {
        display: flex;
        gap: 0.4rem;
      }
      .btn {
        border-radius: 8px;
        border: 1px solid var(--pw-border, #d0d7e2);
        padding: 0.4rem 0.85rem;
        background: var(--pw-surface, #fff);
        cursor: pointer;
        font: inherit;
        color: inherit;
      }
      .btn.primary {
        background: var(--pw-accent, #2563eb);
        border-color: var(--pw-accent, #2563eb);
        color: #fff;
      }
      .btn.ghost {
        background: transparent;
      }
      .btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
    `,
  ],
})
export class HelpSpotlightOverlayComponent {
  readonly help = inject(HelpTourService);
  private readonly scrollLock = inject(OverlayScrollLockService);
  readonly titleId = 'loom-help-tour-title';
  readonly pad = 6;

  @ViewChild('nextBtn') private nextBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('panel') private panel?: ElementRef<HTMLElement>;

  private locked = false;

  constructor() {
    effect(() => {
      const active = !!this.help.session();
      if (active && !this.locked) {
        this.scrollLock.acquire();
        this.locked = true;
        queueMicrotask(() => this.nextBtn?.nativeElement.focus());
      } else if (!active && this.locked) {
        this.scrollLock.release();
        this.locked = false;
      }
    });
  }

  /** Tab containment only — Escape is owned by HelpTourService (capture). */
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.help.session() || event.key !== 'Tab') return;
    const items = this.focusableHelpControls();
    if (!items.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onNext(): void {
    const s = this.help.session();
    if (!s) return;
    if (this.isLast(s)) {
      this.help.close('done');
      return;
    }
    this.help.next();
  }

  isLast(s: { stepIndex: number; stepCount: number }): boolean {
    return s.stepIndex >= s.stepCount - 1;
  }

  private focusableHelpControls(): HTMLButtonElement[] {
    const root = this.panel?.nativeElement;
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),
    );
  }
}
