import { Component, Input } from '@angular/core';

export type ProfileAuditItem = {
  id: string;
  action: string;
  createdAt: string;
};

@Component({
  selector: 'loom-employee-history-panel',
  standalone: true,
  template: `
    <h2>Історія</h2>
    @if (!canViewHistory) {
      <p class="muted">Немає доступу до історії.</p>
    } @else if (!items.length) {
      <p class="muted">Подій ще немає.</p>
    } @else {
      <ul class="timeline">
        @for (a of items; track a.id) {
          <li>
            <strong>{{ a.action }}</strong>
            <span class="muted">{{ formatDate(a.createdAt) }}</span>
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
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.55rem 0;
        border-bottom: 1px solid var(--pw-border);
      }
    `,
  ],
})
export class EmployeeHistoryPanelComponent {
  @Input() canViewHistory = false;
  @Input() items: ProfileAuditItem[] = [];

  formatDate(value: string): string {
    try {
      return new Date(value).toLocaleString('uk-UA');
    } catch {
      return value;
    }
  }
}
