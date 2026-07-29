import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import type { QuestionnaireSnapshotSummary } from '@loom/contracts-questionnaires';
import { QuestionnairesApiService } from './core/questionnaires-api.service';

@Component({
  selector: 'loom-questionnaire-snapshot-summary',
  standalone: true,
  template: `
    <section class="summary">
      <h3>Підсумок анкети</h3>
      @if (loading()) {
        <p class="muted">Завантаження…</p>
      } @else if (!summary()?.submittedAt) {
        <p class="muted">Ще немає надісланої анкети.</p>
      } @else {
        <p class="meta">Надіслано: {{ formatDate(summary()!.submittedAt) }}</p>
        @for (block of blocks(); track block.key) {
          <div class="block">
            <h4>{{ block.label }}</h4>
            @if (!block.data) {
              <p class="muted">Немає даних</p>
            } @else {
              <dl>
                @for (entry of entries(block.data); track entry[0]) {
                  <div class="row">
                    <dt>{{ entry[0] }}</dt>
                    <dd>{{ formatValue(entry[1]) }}</dd>
                  </div>
                }
              </dl>
            }
          </div>
        }
      }
    </section>
  `,
  styles: [
    `
      .summary {
        display: grid;
        gap: 0.75rem;
      }
      h3,
      h4 {
        margin: 0;
      }
      .meta,
      .muted {
        color: var(--pw-muted);
        margin: 0;
      }
      .block {
        padding: 0.75rem;
        border: 1px solid var(--pw-border);
        border-radius: 10px;
        background: var(--pw-surface);
      }
      dl {
        margin: 0.5rem 0 0;
        display: grid;
        gap: 0.35rem;
      }
      .row {
        display: grid;
        grid-template-columns: minmax(8rem, 12rem) 1fr;
        gap: 0.5rem;
      }
      dt {
        color: var(--pw-muted);
        font-size: 0.85rem;
      }
      dd {
        margin: 0;
        white-space: pre-wrap;
      }
    `,
  ],
})
export class QuestionnaireSnapshotSummaryComponent implements OnChanges {
  private readonly api = inject(QuestionnairesApiService);

  @Input({ required: true }) employeeId!: string;

  readonly loading = signal(false);
  readonly summary = signal<QuestionnaireSnapshotSummary | null>(null);

  readonly blocks = () => {
    const s = this.summary();
    return [
      { key: 'experience', label: 'Досвід', data: s?.experience ?? null },
      { key: 'education', label: 'Освіта', data: s?.education ?? null },
      { key: 'strengths', label: 'Сильні сторони', data: s?.strengths ?? null },
      { key: 'hobbies', label: 'Хобі', data: s?.hobbies ?? null },
      { key: 'workStyle', label: 'Стиль роботи', data: s?.workStyle ?? null },
    ];
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['employeeId'] && this.employeeId) {
      this.reload();
    }
  }

  entries(data: Record<string, unknown>): Array<[string, unknown]> {
    return Object.entries(data);
  }

  formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('uk-UA');
  }

  formatValue(value: unknown): string {
    if (value == null) return '—';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return JSON.stringify(value, null, 2);
  }

  private reload(): void {
    this.loading.set(true);
    this.api.snapshotSummary(this.employeeId).subscribe({
      next: (summary: QuestionnaireSnapshotSummary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: () => {
        this.summary.set(null);
        this.loading.set(false);
      },
    });
  }
}
