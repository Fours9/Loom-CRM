import { Component, ElementRef, inject, input } from '@angular/core';
import { HelpTourService } from './help-tour.service';
import type { HelpTourId } from './help-tour.models';

@Component({
  selector: 'loom-help-trigger',
  standalone: true,
  template: `
    <button
      type="button"
      class="help-trigger"
      [attr.aria-label]="ariaLabel()"
      [title]="ariaLabel()"
      (click)="onClick($event)"
    >
      ?
    </button>
  `,
  styles: [
    `
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
    `,
  ],
})
export class HelpTriggerComponent {
  private readonly help = inject(HelpTourService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly tourId = input.required<HelpTourId>();
  readonly ariaLabel = input('Довідка');

  onClick(event: Event): void {
    event.stopPropagation();
    const btn = (event.currentTarget as HTMLElement) ?? this.host.nativeElement;
    this.help.start(this.tourId(), btn);
  }
}
