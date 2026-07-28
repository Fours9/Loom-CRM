import { Component, Input } from '@angular/core';
import type { EmployeeProfileHistoryItem } from '@loom/contracts-employees';

@Component({
  selector: 'loom-employee-history-panel',
  standalone: true,
  template: `
    <h2>Історія</h2>
    @if (!items.length) {
      <p class="muted">Подій ще немає.</p>
    } @else {
      <ul class="timeline">
        @for (a of items; track a.id) {
          <li>
            <div class="row">
              <span class="when">{{ formatDate(a.createdAt) }}</span>
              <span class="what">
                <strong>{{ a.actor?.label || 'Система' }}</strong>
                · {{ a.summary }}
              </span>
            </div>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      h2 {
        margin: 0 0 0.5rem;
      }
      .muted {
        color: var(--pw-muted);
      }
      .timeline {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.5rem;
      }
      .timeline li {
        padding: 0.55rem 0;
        border-bottom: 1px solid var(--pw-border);
      }
      .row {
        display: grid;
        gap: 0.2rem;
      }
      .when {
        color: var(--pw-muted);
        font-size: 0.85rem;
      }
      .what {
        color: var(--pw-text);
      }
    `,
  ],
})
export class EmployeeHistoryPanelComponent {
  @Input({ required: true }) items: EmployeeProfileHistoryItem[] = [];

  formatDate(value: string): string {
    try {
      return new Date(value).toLocaleString('uk-UA');
    } catch {
      return value;
    }
  }
}
