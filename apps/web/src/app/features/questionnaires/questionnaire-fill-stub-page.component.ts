import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'loom-questionnaire-fill-stub-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <article class="stub">
      <p class="eyebrow">Анкета</p>
      <h1>Форма заповнення — окремий UI</h1>
      <p class="muted">
        Маршрут
        <code>/questionnaires/{{ assignmentId() }}</code>
        зарезервовано. Майстер заповнення (PR-4) підключається окремо.
      </p>
      <a class="btn" routerLink="/people">До працівників</a>
    </article>
  `,
  styles: [
    `
      .stub {
        max-width: 40rem;
        display: grid;
        gap: 0.75rem;
        padding: 1.25rem;
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        background: var(--pw-surface);
      }
      h1 {
        margin: 0;
        font-size: 1.4rem;
      }
      .eyebrow {
        margin: 0;
        color: var(--pw-muted);
        font-size: 0.85rem;
      }
      .muted {
        color: var(--pw-muted);
      }
      .btn {
        display: inline-flex;
        width: fit-content;
        padding: 0.45rem 0.8rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        text-decoration: none;
        color: inherit;
      }
    `,
  ],
})
export class QuestionnaireFillStubPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly assignmentId = signal('');

  ngOnInit(): void {
    this.assignmentId.set(this.route.snapshot.paramMap.get('id') ?? '');
  }
}
