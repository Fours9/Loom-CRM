import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { EmployeeListItem } from '@loom/contracts-employees';

type CompletenessFilter = '' | '25' | '50' | '75' | '99';
type SortBy = 'fullName' | 'completeness';

@Component({
  selector: 'loom-people-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="page">
      <header class="page-head">
        <div>
          <h1>Працівники</h1>
          <p>Кадровий список Loom CRM · профіль: /people/:id</p>
        </div>
        <button type="button" class="btn" (click)="create()" [disabled]="busy()">
          Додати
        </button>
      </header>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      <div class="filters">
        <label>
          Повнота профілю
          <select
            [ngModel]="maxCompleteness()"
            (ngModelChange)="onMaxCompleteness($event)"
            name="maxCompleteness"
          >
            <option value="">Усі</option>
            <option value="25">До 25%</option>
            <option value="50">До 50%</option>
            <option value="75">До 75%</option>
            <option value="99">Менше 100%</option>
          </select>
        </label>
        <label>
          Сортування
          <select
            [ngModel]="sortBy()"
            (ngModelChange)="onSortBy($event)"
            name="sortBy"
          >
            <option value="fullName">ПІБ</option>
            <option value="completeness">Повнота профілю</option>
          </select>
        </label>
        <label>
          Напрямок
          <select
            [ngModel]="sortDir()"
            (ngModelChange)="onSortDir($event)"
            name="sortDir"
          >
            <option value="asc">За зростанням</option>
            <option value="desc">За спаданням</option>
          </select>
        </label>
      </div>

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
              <a class="card-body" [routerLink]="['/people', e.id]">
                <strong class="card-title">{{ e.fullName }}</strong>
                <span class="card-meta">{{ e.employeeNumber }}</span>
                <span class="card-meta">{{ e.departmentName || '—' }}</span>
                <span class="badge">Профіль {{ e.completenessPercent }}%</span>
              </a>
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
                <th>Повнота</th>
              </tr>
            </thead>
            <tbody>
              @for (e of employees(); track e.id) {
                <tr class="clickable" (click)="open(e.id)">
                  <td>
                    <strong>{{ e.fullName }}</strong>
                  </td>
                  <td>{{ e.employeeNumber }}</td>
                  <td>{{ e.departmentName || '—' }}</td>
                  <td>{{ e.completenessPercent }}%</td>
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
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }
      .filters label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.9rem;
        color: var(--pw-muted);
        min-width: 10rem;
      }
      .filters select {
        padding: 0.45rem 0.6rem;
        border: 1px solid var(--pw-border-strong);
        border-radius: 8px;
        background: var(--pw-input-bg);
        color: var(--pw-text);
        min-height: 2.5rem;
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
        text-decoration: none;
        color: inherit;
        display: grid;
        gap: 0.25rem;
      }
      .card-title {
        color: var(--pw-text-strong);
      }
      .card-meta {
        color: var(--pw-muted);
        font-size: 0.9rem;
      }
      .badge {
        display: inline-flex;
        width: fit-content;
        border-radius: 999px;
        padding: 0.15rem 0.55rem;
        font-size: 0.8rem;
        border: 1px solid color-mix(in srgb, var(--pw-accent) 40%, var(--pw-border));
        color: var(--pw-accent);
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
      tr.clickable {
        cursor: pointer;
      }
      tr.clickable:hover {
        background: color-mix(in srgb, var(--pw-accent) 8%, transparent);
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
  private readonly router = inject(Router);
  readonly employees = signal<EmployeeListItem[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly maxCompleteness = signal<CompletenessFilter>('');
  readonly sortBy = signal<SortBy>('fullName');
  readonly sortDir = signal<'asc' | 'desc'>('asc');
  firstName = '';
  lastName = '';

  ngOnInit(): void {
    this.reload();
  }

  onMaxCompleteness(value: CompletenessFilter): void {
    this.maxCompleteness.set(value);
    this.reload();
  }

  onSortBy(value: SortBy): void {
    this.sortBy.set(value);
    this.reload();
  }

  onSortDir(value: 'asc' | 'desc'): void {
    this.sortDir.set(value);
    this.reload();
  }

  reload(): void {
    let params = new HttpParams()
      .set('sortBy', this.sortBy())
      .set('sortDir', this.sortDir());
    const max = this.maxCompleteness();
    if (max) {
      params = params.set('maxCompleteness', max);
    }
    this.http.get<EmployeeListItem[]>('/api/v1/employees', { params }).subscribe({
      next: (rows) => this.employees.set(rows),
      error: () =>
        this.error.set('Не вдалося завантажити працівників (потрібен вхід)'),
    });
  }

  open(id: string): void {
    void this.router.navigate(['/people', id]);
  }

  create(): void {
    if (!this.firstName.trim() || !this.lastName.trim()) return;
    this.busy.set(true);
    this.http
      .post<{ id: string }>('/api/v1/employees', {
        firstName: this.firstName.trim(),
        lastName: this.lastName.trim(),
      })
      .subscribe({
        next: (created) => {
          this.firstName = '';
          this.lastName = '';
          this.busy.set(false);
          void this.router.navigate(['/people', created.id]);
        },
        error: () => {
          this.error.set('Створення не вдалося');
          this.busy.set(false);
        },
      });
  }
}
