import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  effect,
  input,
  output,
  signal,
} from '@angular/core';

const MAX_COMMENT = 2000;

@Component({
  selector: 'loom-questionnaire-request-changes-popover',
  standalone: true,
  template: `
    <div class="wrap">
      <button
        #trigger
        type="button"
        class="btn"
        [disabled]="busy()"
        [attr.aria-expanded]="open()"
        aria-haspopup="dialog"
        aria-controls="request-changes-popover"
        (click)="toggle()"
      >
        {{ busy() ? 'Запит…' : 'Запросити зміни' }}
      </button>

      @if (open()) {
        <div
          id="request-changes-popover"
          class="popover"
          role="dialog"
          aria-label="Запит змін до анкети"
        >
          <label class="label" for="request-changes-comment"
            >Що потрібно змінити?</label
          >
          <textarea
            #commentEl
            id="request-changes-comment"
            rows="4"
            [attr.maxlength]="maxLength"
            [value]="comment()"
            (input)="onInput($event)"
            [disabled]="busy()"
          ></textarea>
          <div class="meta">
            <span class="muted">{{ comment().length }}/{{ maxLength }}</span>
          </div>
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
          <div class="actions">
            <button
              type="button"
              class="btn"
              [disabled]="busy()"
              (click)="cancel()"
            >
              Скасувати
            </button>
            <button
              type="button"
              class="btn primary"
              [disabled]="busy() || !comment().trim()"
              (click)="submit()"
            >
              Надіслати
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .wrap {
        position: relative;
        display: inline-flex;
      }
      .btn {
        border: 1px solid var(--pw-border);
        background: var(--pw-surface);
        color: var(--pw-text);
        border-radius: 10px;
        padding: 0.45rem 0.75rem;
        cursor: pointer;
      }
      .btn.primary {
        background: var(--pw-accent);
        border-color: var(--pw-accent);
        color: #fff;
      }
      .btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .popover {
        position: absolute;
        top: calc(100% + 0.4rem);
        right: 0;
        z-index: 40;
        width: min(22rem, 90vw);
        display: grid;
        gap: 0.5rem;
        padding: 0.85rem;
        border-radius: 12px;
        border: 1px solid var(--pw-border);
        background: var(--pw-surface);
        box-shadow: 0 8px 24px color-mix(in srgb, #0f172a 16%, transparent);
      }
      .label {
        font-size: 0.9rem;
        font-weight: 600;
      }
      textarea {
        width: 100%;
        resize: vertical;
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        background: var(--pw-bg, var(--pw-surface));
        color: var(--pw-text);
        padding: 0.55rem 0.65rem;
        font: inherit;
      }
      .meta {
        display: flex;
        justify-content: flex-end;
      }
      .muted {
        color: var(--pw-muted);
        font-size: 0.8rem;
      }
      .error {
        margin: 0;
        color: var(--pw-danger, #b42318);
        font-size: 0.85rem;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }
    `,
  ],
})
export class QuestionnaireRequestChangesPopoverComponent {
  readonly busy = input(false);
  readonly submitComment = output<string>();

  readonly open = signal(false);
  readonly comment = signal('');
  readonly error = signal<string | null>(null);
  readonly maxLength = MAX_COMMENT;

  @ViewChild('trigger') private trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('commentEl') private commentEl?: ElementRef<HTMLTextAreaElement>;

  constructor() {
    effect(() => {
      if (this.open()) {
        queueMicrotask(() => this.commentEl?.nativeElement.focus());
      }
    });
  }

  toggle(): void {
    if (this.busy()) return;
    if (this.open()) {
      this.cancel();
      return;
    }
    this.error.set(null);
    this.open.set(true);
  }

  cancel(): void {
    this.open.set(false);
    this.comment.set('');
    this.error.set(null);
    queueMicrotask(() => this.trigger?.nativeElement.focus());
  }

  /** Parent calls after successful API. */
  closeAfterSuccess(): void {
    this.open.set(false);
    this.comment.set('');
    this.error.set(null);
    queueMicrotask(() => this.trigger?.nativeElement.focus());
  }

  setError(message: string): void {
    this.error.set(message);
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value ?? '';
    this.comment.set(value.slice(0, MAX_COMMENT));
  }

  submit(): void {
    const trimmed = this.comment().trim();
    if (!trimmed || this.busy()) return;
    this.error.set(null);
    this.submitComment.emit(trimmed);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.cancel();
  }
}
