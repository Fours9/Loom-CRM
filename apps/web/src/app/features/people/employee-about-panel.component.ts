import { Component } from '@angular/core';
import {
  PLANNED_ABOUT_SUBTABS,
  visiblePeopleAboutSubtabs,
} from './people-about-subtabs';

/**
 * Shell for People «Про себе».
 * Subtabs are planned in `people-about-subtabs.ts` but not rendered yet.
 */
@Component({
  selector: 'loom-employee-about-panel',
  standalone: true,
  template: `
    <section class="about" aria-label="Про себе">
      <p class="lead">
        Мʼякий контекст про працівника (хобі, сімʼя, стиль роботи) — окремо від
        кадрових «Даних працівника».
      </p>
      @if (visibleSubtabs().length === 0) {
        <p class="muted">
          Підрозділи ще в підготовці. Плановані розділи:
          {{ plannedLabels }}.
        </p>
      }
    </section>
  `,
  styles: [
    `
      .about {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 0.25rem 0 1rem;
      }
      .lead {
        margin: 0;
        max-width: 42rem;
        line-height: 1.45;
      }
      .muted {
        margin: 0;
        color: var(--loom-muted, #667085);
        max-width: 42rem;
        line-height: 1.45;
      }
    `,
  ],
})
export class EmployeeAboutPanelComponent {
  readonly visibleSubtabs = visiblePeopleAboutSubtabs;

  readonly plannedLabels = PLANNED_ABOUT_SUBTABS.map((t) => t.label).join(
    ' · ',
  );
}
