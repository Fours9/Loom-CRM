import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { EmployeeSkillAssessmentListResponse } from '@loom/contracts-employees';
import { resolveMatrixRatingPolicy } from '@loom/questionnaire-schema';

@Component({
  selector: 'loom-employee-skills-matrix-panel',
  standalone: true,
  template: `
    <section class="panel">
      <h3>Матриця навичок</h3>
      @if (loading) {
        <p class="muted">Завантаження…</p>
      } @else if (error) {
        <p class="error">{{ error }}</p>
      } @else if (!items.length) {
        <p class="muted">Ще немає навичок у профілі працівника.</p>
      } @else {
        <ul>
          @for (row of items; track row.id) {
            <li>
              <span class="label">{{ row.skill?.name ?? row.skillId }}</span>
              <span class="level">{{ formatLevel(row) }}</span>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [
    `
      .panel {
        display: grid;
        gap: 0.75rem;
      }
      h3 {
        margin: 0;
        font-size: 1.05rem;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.5rem;
      }
      li {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.5rem 0.75rem;
        border-radius: 8px;
        border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
      }
      .muted {
        opacity: 0.75;
      }
      .error {
        color: #b42318;
      }
    `,
  ],
})
export class EmployeeSkillsMatrixPanelComponent implements OnChanges {
  private readonly http = inject(HttpClient);

  @Input({ required: true }) employeeId!: string;

  loading = false;
  error: string | null = null;
  items: EmployeeSkillAssessmentListResponse['items'] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['employeeId'] && this.employeeId) {
      this.load();
    }
  }

  formatLevel(row: EmployeeSkillAssessmentListResponse['items'][number]): string {
    if (row.level == null) return 'Без оцінки';
    const policy = resolveMatrixRatingPolicy(2, {
      scaleKind: row.skill?.scaleKind,
      scaleMin: row.skill?.scaleMin,
      scaleMax: row.skill?.scaleMax,
    });
    return policy.unit === '%'
      ? `${row.level}%`
      : `${row.level} / ${policy.max}`;
  }

  private load(): void {
    this.loading = true;
    this.error = null;
    this.http
      .get<EmployeeSkillAssessmentListResponse>(
        `/api/v1/employees/${this.employeeId}/skill-assessments`,
      )
      .subscribe({
        next: (res) => {
          this.items = res.items ?? [];
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.error = 'Не вдалося завантажити матрицю навичок';
        },
      });
  }
}
