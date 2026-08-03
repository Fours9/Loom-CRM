import { Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of, Subject } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  switchMap,
} from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { QuestionnaireAttachConstraint } from '@loom/contracts-questionnaires';
import type { EmployeeListItem } from '@loom/contracts-employees';

/**
 * Private modal for attaching an unattached/detached assignment to an
 * employee. Not exported via public-api — directory page only.
 *
 * - `any_employee` (status 'new'): free-text search over employees.
 * - `same_employee` (status 'cancelled'): locked to the previously
 *   detached employee, just a confirm step (server also enforces this).
 */
@Component({
  selector: 'loom-questionnaire-attach-picker',
  standalone: true,
  template: `
    <div class="backdrop" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
        <h2>Прикріпити анкету</h2>

        @if (constraint()?.kind === 'same_employee') {
          <p class="muted">
            Цю анкету можна повторно прикріпити лише до працівника, від якого
            її було відкріплено:
          </p>
          <p class="preselected">{{ sameEmployeeName() }}</p>
        } @else {
          <label class="search-label">
            Працівник
            <input
              type="text"
              placeholder="Пошук за іменем…"
              [value]="query()"
              (input)="onQueryInput($any($event.target).value)"
              autocomplete="off"
            />
          </label>

          @if (searching()) {
            <p class="muted">Пошук…</p>
          } @else if (query().trim() && !results().length) {
            <p class="muted">Нікого не знайдено.</p>
          } @else if (results().length) {
            <ul class="results">
              @for (emp of results(); track emp.id) {
                <li>
                  <button
                    type="button"
                    class="result-btn"
                    [class.selected]="selectedEmployeeId() === emp.id"
                    (click)="selectedEmployeeId.set(emp.id)"
                  >
                    {{ emp.fullName }}
                  </button>
                </li>
              }
            </ul>
          }
        }

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <div class="actions">
          <button type="button" class="btn" [disabled]="busy()" (click)="close.emit()">
            Скасувати
          </button>
          <button
            type="button"
            class="btn primary"
            [disabled]="busy() || !canConfirm()"
            (click)="onConfirm()"
          >
            {{ busy() ? 'Прикріплення…' : 'Прикріпити' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: 50;
        display: grid;
        place-items: center;
        background: color-mix(in srgb, #0f172a 45%, transparent);
        padding: 1rem;
      }
      .modal {
        display: grid;
        gap: 0.75rem;
        width: min(28rem, 100%);
        max-height: 80vh;
        overflow-y: auto;
        padding: 1.1rem 1.2rem 1.25rem;
        border-radius: 12px;
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
      }
      h2 {
        margin: 0;
        font-size: 1.1rem;
      }
      .muted {
        margin: 0;
        color: var(--pw-muted);
        font-size: 0.9rem;
      }
      .preselected {
        margin: 0;
        font-weight: 600;
      }
      .search-label {
        display: grid;
        gap: 0.3rem;
        font-size: 0.8rem;
        color: var(--pw-muted);
      }
      input {
        border: 1px solid var(--pw-border);
        border-radius: 8px;
        padding: 0.45rem 0.6rem;
        background: var(--pw-bg, #fff);
        font-size: 0.95rem;
      }
      .results {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.3rem;
        max-height: 14rem;
        overflow-y: auto;
      }
      .result-btn {
        width: 100%;
        text-align: left;
        border: 1.5px solid var(--pw-border);
        border-radius: 8px;
        padding: 0.45rem 0.6rem;
        background: var(--pw-surface);
        cursor: pointer;
      }
      .result-btn:hover {
        border-color: var(--pw-accent);
      }
      .result-btn.selected {
        border-color: var(--pw-accent);
        background: color-mix(in srgb, var(--pw-accent) 14%, var(--pw-surface));
      }
      .error {
        margin: 0;
        color: #b42318;
        font-size: 0.9rem;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 0.25rem;
      }
      .btn {
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        padding: 0.4rem 0.85rem;
        background: var(--pw-surface);
        cursor: pointer;
      }
      .btn.primary {
        background: var(--pw-accent);
        border-color: var(--pw-accent);
        color: #fff;
      }
      .btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
    `,
  ],
})
export class QuestionnaireAttachPickerComponent {
  private readonly http = inject(HttpClient);

  readonly constraint = input<QuestionnaireAttachConstraint>(null);
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly confirm = output<string>();
  readonly close = output<void>();

  readonly query = signal('');
  readonly results = signal<EmployeeListItem[]>([]);
  readonly searching = signal(false);
  readonly selectedEmployeeId = signal<string | null>(null);

  private readonly queryChanges = new Subject<string>();

  readonly sameEmployeeName = computed(() => {
    const c = this.constraint();
    return c?.kind === 'same_employee' ? c.employeeDisplayName : '';
  });

  readonly canConfirm = computed(() => {
    const c = this.constraint();
    if (!c) return false;
    if (c.kind === 'same_employee') return true;
    return !!this.selectedEmployeeId();
  });

  constructor() {
    this.queryChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => {
          const term = q.trim();
          if (!term) return of<EmployeeListItem[]>([]);
          this.searching.set(true);
          return this.http
            .get<EmployeeListItem[]>('/api/v1/employees', {
              params: { q: term, sortBy: 'fullName', sortDir: 'asc' },
            })
            .pipe(catchError(() => of<EmployeeListItem[]>([])));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((rows) => {
        this.results.set(rows);
        this.searching.set(false);
      });
  }

  onQueryInput(value: string): void {
    this.query.set(value);
    this.selectedEmployeeId.set(null);
    this.queryChanges.next(value);
  }

  onConfirm(): void {
    const c = this.constraint();
    if (!c) return;
    const employeeId =
      c.kind === 'same_employee' ? c.employeeId : this.selectedEmployeeId();
    if (!employeeId) return;
    this.confirm.emit(employeeId);
  }
}
