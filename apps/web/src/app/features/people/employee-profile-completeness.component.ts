import { Component, Input } from '@angular/core';
import type { ProfileCompleteness } from '@loom/contracts-employees';
import { formatIncompleteSections } from './profile-completeness-labels';

@Component({
  selector: 'loom-employee-profile-completeness',
  standalone: true,
  template: `
    <div class="completeness">
      <div class="bar">
        <span [style.width.%]="completeness.core.percent"></span>
      </div>
      <p>
        Кадровий профіль:
        <strong>{{ completeness.core.percent }}%</strong>
        @if (coreGaps) {
          · {{ coreGaps }}
        }
      </p>
      @if (completeness.extended; as extended) {
        <div class="bar secondary">
          <span [style.width.%]="extended.percent"></span>
        </div>
        <p class="muted">
          Розширений профіль: <strong>{{ extended.percent }}%</strong>
          @if (extendedGaps) {
            · {{ extendedGaps }}
          }
        </p>
      }
    </div>
  `,
  styles: [
    `
      .completeness {
        display: grid;
        gap: 0.35rem;
      }
      .bar {
        height: 8px;
        background: var(--pw-border);
        border-radius: 99px;
        overflow: hidden;
      }
      .bar span {
        display: block;
        height: 100%;
        background: var(--pw-accent);
      }
      .bar.secondary span {
        background: color-mix(in srgb, var(--pw-muted) 55%, var(--pw-accent));
      }
      .muted {
        color: var(--pw-muted);
      }
      p {
        margin: 0;
      }
    `,
  ],
})
export class EmployeeProfileCompletenessComponent {
  @Input({ required: true }) completeness!: ProfileCompleteness;

  get coreGaps(): string {
    return formatIncompleteSections(
      this.completeness.core.incompleteSections,
      'core',
    );
  }

  get extendedGaps(): string {
    const ext = this.completeness.extended;
    if (!ext) return '';
    return formatIncompleteSections(ext.incompleteSections, 'extended');
  }
}
