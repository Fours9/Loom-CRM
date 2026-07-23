import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-password-visibility-toggle',
  standalone: true,
  template: `
    <button
      type="button"
      class="toggle"
      (click)="toggled.emit()"
      [attr.aria-label]="visible() ? hideLabel() : showLabel()"
      [title]="visible() ? hideLabel() : showLabel()"
    >
      @if (visible()) {
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
          />
          <path
            fill="currentColor"
            d="M3.3 3.3a1 1 0 0 0 0 1.4l16 16a1 1 0 1 0 1.4-1.4l-16-16a1 1 0 0 0-1.4 0z"
          />
        </svg>
      } @else {
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
          />
        </svg>
      }
    </button>
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      .toggle {
        width: 2.6rem;
        flex: 0 0 auto;
        display: grid;
        place-items: center;
        padding: 0;
        border: 1px solid var(--pw-border-strong);
        border-radius: 8px;
        background: var(--pw-surface-2, var(--pw-surface));
        color: var(--pw-accent);
        cursor: pointer;
      }
      .toggle svg {
        display: block;
      }
    `,
  ],
})
export class PasswordVisibilityToggleComponent {
  readonly visible = input(false);
  readonly showLabel = input('Показати');
  readonly hideLabel = input('Сховати');
  readonly toggled = output<void>();
}
