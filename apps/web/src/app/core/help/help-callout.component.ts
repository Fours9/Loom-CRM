import { Component, computed, inject, input, signal } from '@angular/core';
import { HelpDismissStore } from './help-dismiss.store';

@Component({
  selector: 'loom-help-callout',
  standalone: true,
  template: `
    @if (visible()) {
      <aside class="help-callout" role="note">
        <p>{{ body() }}</p>
        <button type="button" class="dismiss" (click)="onDismiss()">Зрозуміло</button>
      </aside>
    }
  `,
  styles: [
    `
      .help-callout {
        display: grid;
        gap: 0.55rem;
        padding: 0.75rem 0.9rem;
        border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--pw-accent, #2563eb) 35%, var(--pw-border, #d0d7e2));
        background: color-mix(in srgb, var(--pw-accent, #2563eb) 10%, var(--pw-surface, #fff));
        color: var(--pw-text, #1f2328);
      }
      p {
        margin: 0;
        font-size: 0.9rem;
        line-height: 1.45;
      }
      .dismiss {
        justify-self: start;
        border: 0;
        background: transparent;
        color: var(--pw-accent, #2563eb);
        font: inherit;
        font-size: 0.85rem;
        cursor: pointer;
        padding: 0;
        text-decoration: underline;
      }
    `,
  ],
})
export class HelpCalloutComponent {
  private readonly dismissStore = inject(HelpDismissStore);

  readonly calloutId = input.required<string>();
  readonly version = input.required<number>();
  readonly body = input.required<string>();

  private readonly dismissedLocal = signal(false);

  readonly visible = computed(
    () =>
      !this.dismissedLocal() &&
      !this.dismissStore.isDismissed(this.calloutId(), this.version()),
  );

  onDismiss(): void {
    this.dismissStore.dismiss(this.calloutId(), this.version());
    this.dismissedLocal.set(true);
  }
}
