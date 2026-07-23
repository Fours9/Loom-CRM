import { Component, Input } from '@angular/core';
import type { FeatureStateKind } from './feature-state';

@Component({
  selector: 'loom-feature-state',
  standalone: true,
  template: `
    <div class="fs" [attr.data-kind]="kind">
      @switch (kind) {
        @case ('loading') {
          <p>{{ message || 'Завантаження…' }}</p>
        }
        @case ('empty') {
          <p>{{ message || 'Немає даних' }}</p>
        }
        @case ('forbidden') {
          <p class="warn">{{ message || 'Немає доступу' }}</p>
        }
        @case ('not-found') {
          <p class="warn">{{ message || 'Не знайдено' }}</p>
        }
        @case ('error') {
          <p class="err">{{ message || 'Сталася помилка' }}</p>
        }
      }
    </div>
  `,
  styles: [
    `
      .fs {
        padding: 1.25rem;
        border-radius: 12px;
        border: 1px dashed var(--loom-border, #2a3544);
        color: var(--loom-muted, #9aa8b8);
      }
      .warn {
        color: #e6b35a;
        margin: 0;
      }
      .err {
        color: #ff8f8f;
        margin: 0;
      }
      p {
        margin: 0;
      }
    `,
  ],
})
export class FeatureStateComponent {
  @Input({ required: true }) kind!: FeatureStateKind;
  @Input() message?: string;
}
