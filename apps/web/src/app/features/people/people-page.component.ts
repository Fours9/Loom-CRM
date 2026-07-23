import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import type { EmployeeSummary } from '@loom/contracts-employees';

@Component({
  selector: 'loom-people-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="page">
      <header class="page-head">
        <div>
          <h1>Працівники</h1>
          <p>Список співробітників організації в Loom CRM</p>
        </div>
        <button type="button" class="btn" (click)="create()" [disabled]="busy()">
          Додати
        </button>
      </header>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      <div class="create-card">
        <h2>Новий працівник</h2>
        <div class="form">
          <label>
            Ім'я
            <input [(ngModel)]="firstName" name="firstName" placeholder="Ім'я" />
          </label>
          <label>
            Прізвище
            <input [(ngModel)]="lastName" name="lastName" placeholder="Прізвище" />
          </label>
        </div>
      </div>

      @if (employees().length === 0) {
        <p class="empty">Працівників ще немає</p>
      } @else {
        <ul class="card-list">
          @for (e of employees(); track e.id) {
            <li class="employee-card">
              <div class="card-body">
                <strong class="card-title">{{ e.lastName }} {{ e.firstName }}</strong>
                <span class="card-meta">{{ e.employeeNumber }}</span>
                <span class="card-meta">{{ e.department?.name || '—' }}</span>
              </div>
            </li>
          }
        </ul>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ПІБ</th>
                <th>Номер</th>
                <th>Відділ</th>
              </tr>
            </thead>
            <tbody>
              @for (e of employees(); track e.id) {
                <tr>
                  <td>
                    <strong>{{ e.lastName }} {{ e.firstName }}</strong>
                  </td>
                  <td>{{ e.employeeNumber }}</td>
                  <td>{{ e.department?.name || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .page {
        display: grid;
        gap: 1rem;
      }
      .page-head {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 1rem;
        align-items: start;
      }
      .page-head h1 {
        margin: 0;
        font-size: 1.75rem;
        color: var(--pw-text-strong);
      }
      .page-head p {
        margin: 0.25rem 0 0;
        color: var(--pw-muted);
      }
      .btn {
        border: 0;
        border-radius: 8px;
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        padding: 0.65rem 1rem;
        min-height: 2.75rem;
        font-weight: 600;
        cursor: pointer;
      }
      .btn:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
      .create-card {
        display: grid;
        gap: 0.75rem;
        padding: 1rem;
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        background: var(--pw-surface);
      }
      .create-card h2 {
        margin: 0;
        font-size: 1.05rem;
        color: var(--pw-accent);
      }
      .form {
        display: grid;
        gap: 0.75rem;
      }
      label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.9rem;
        color: var(--pw-muted);
      }
      input {
        padding: 0.55rem 0.7rem;
        border: 1px solid var(--pw-border-strong);
        border-radius: 8px;
        background: var(--pw-input-bg);
        color: var(--pw-text);
        min-height: 2.75rem;
        box-sizing: border-box;
        width: 100%;
      }
      .card-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.75rem;
      }
      .employee-card {
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        background: var(--pw-surface);
        padding: 0.85rem 1rem;
      }
      .card-body {
        display: grid;
        gap: 0.2rem;
      }
      .card-title {
        color: var(--pw-text-strong);
      }
      .card-meta {
        color: var(--pw-muted);
        font-size: 0.9rem;
      }
      .table-wrap {
        display: none;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        background: var(--pw-surface);
      }
      th,
      td {
        text-align: left;
        padding: 0.75rem;
        border-bottom: 1px solid var(--pw-border);
      }
      th {
        color: var(--pw-muted);
        font-weight: 600;
        font-size: 0.9rem;
      }
      .error {
        color: var(--pw-danger);
        margin: 0;
      }
      .empty {
        padding: 1rem;
        color: var(--pw-muted);
        border: 1px dashed var(--pw-border);
        border-radius: 12px;
        background: var(--pw-surface-2);
      }
      @media (min-width: 641px) {
        .form {
          grid-template-columns: 1fr 1fr;
        }
        .card-list {
          display: none;
        }
        .table-wrap {
          display: block;
          border: 1px solid var(--pw-border);
          border-radius: 12px;
          overflow: hidden;
          background: var(--pw-surface);
        }
      }
    `,
  ],
})
export class PeoplePageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly employees = signal<EmployeeSummary[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  firstName = '';
  lastName = '';

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.http.get<EmployeeSummary[]>('/api/v1/employees').subscribe({
      next: (rows) => this.employees.set(rows),
      error: () => this.error.set('Не вдалося завантажити працівників (потрібен вхід)'),
    });
  }

  create(): void {
    if (!this.firstName.trim() || !this.lastName.trim()) return;
    this.busy.set(true);
    this.http
      .post<EmployeeSummary>('/api/v1/employees', {
        firstName: this.firstName.trim(),
        lastName: this.lastName.trim(),
      })
      .subscribe({
        next: () => {
          this.firstName = '';
          this.lastName = '';
          this.busy.set(false);
          this.reload();
        },
        error: () => {
          this.error.set('Створення не вдалося');
          this.busy.set(false);
        },
      });
  }
}
