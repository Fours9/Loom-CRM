import {
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of, Subject } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  switchMap,
} from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { EmployeeListItem } from '@loom/contracts-employees';

@Component({
  selector: 'loom-questionnaire-employee-typeahead',
  standalone: true,
  template: `
    <div class="field">
      <label class="search-label" [attr.for]="inputId">{{ label() }}</label>
      <div class="control">
        <input
          [id]="inputId"
          type="text"
          [placeholder]="placeholder()"
          [value]="query()"
          (input)="onQueryInput($any($event.target).value)"
          (focus)="onFocus()"
          (keydown.escape)="closeDropdown()"
          autocomplete="off"
          role="combobox"
          [attr.aria-expanded]="dropdownOpen()"
          aria-autocomplete="list"
          [attr.aria-controls]="listboxId"
        />

        @if (dropdownOpen()) {
          <div class="dropdown" role="listbox" [id]="listboxId">
            @if (searching()) {
              <p class="dropdown-status">Пошук…</p>
            } @else if (!results().length) {
              <p class="dropdown-status">Нікого не знайдено.</p>
            } @else {
              <ul class="results">
                @for (emp of results(); track emp.id) {
                  <li role="option">
                    <button
                      type="button"
                      class="result-btn"
                      (mousedown)="$event.preventDefault()"
                      (click)="pick(emp)"
                    >
                      <span class="result-name">{{ emp.fullName }}</span>
                      @if (emp.departmentName || emp.positionName) {
                        <span class="result-meta">
                          {{ empMeta(emp) }}
                        </span>
                      }
                    </button>
                  </li>
                }
              </ul>
            }
          </div>
        }
      </div>

      @if (selected(); as emp) {
        <div class="selected-row">
          <span>Обрано: {{ emp.fullName }}</span>
          @if (clearable()) {
            <button type="button" class="linkish" (click)="clearSelection()">
              Очистити
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .field {
        display: grid;
        gap: 0.35rem;
      }
      .search-label {
        font-size: 0.8rem;
        color: var(--pw-muted);
      }
      .control {
        position: relative;
      }
      input {
        box-sizing: border-box;
        width: 100%;
        border: 1px solid var(--pw-border);
        border-radius: 8px;
        padding: 0.5rem 0.7rem;
        background: var(--pw-bg, #fff);
        font-size: 0.95rem;
      }
      input:focus {
        outline: 2px solid color-mix(in srgb, var(--pw-accent) 45%, transparent);
        outline-offset: 1px;
        border-color: var(--pw-accent);
      }
      .dropdown {
        position: absolute;
        z-index: 40;
        top: calc(100% + 0.25rem);
        left: 0;
        right: 0;
        max-height: 14rem;
        overflow: auto;
        border: 1px solid var(--pw-border);
        border-radius: 10px;
        background: var(--pw-surface, #fff);
        box-shadow:
          0 10px 28px color-mix(in srgb, #0f172a 18%, transparent),
          0 2px 6px color-mix(in srgb, #0f172a 8%, transparent);
      }
      .dropdown-status {
        margin: 0;
        padding: 0.7rem 0.85rem;
        color: var(--pw-muted);
        font-size: 0.9rem;
      }
      .results {
        list-style: none;
        margin: 0;
        padding: 0.25rem;
      }
      .result-btn {
        width: 100%;
        display: grid;
        gap: 0.1rem;
        text-align: left;
        border: none;
        border-radius: 7px;
        padding: 0.5rem 0.65rem;
        background: transparent;
        cursor: pointer;
        color: inherit;
      }
      .result-btn:hover,
      .result-btn:focus-visible {
        background: color-mix(in srgb, var(--pw-accent) 12%, transparent);
        outline: none;
      }
      .result-name {
        font-size: 0.95rem;
        font-weight: 600;
      }
      .result-meta {
        font-size: 0.78rem;
        color: var(--pw-muted);
      }
      .selected-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        font-size: 0.85rem;
        color: var(--pw-muted);
      }
      .linkish {
        border: none;
        background: transparent;
        color: var(--pw-accent);
        cursor: pointer;
        font-size: 0.85rem;
        padding: 0;
      }
    `,
  ],
})
export class QuestionnaireEmployeeTypeaheadComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private static nextId = 0;
  readonly inputId = `q-emp-typeahead-${QuestionnaireEmployeeTypeaheadComponent.nextId++}`;
  readonly listboxId = `${this.inputId}-listbox`;

  readonly label = input('Працівник');
  readonly placeholder = input('Пошук за іменем…');
  readonly clearable = input(true);
  readonly initialEmployee = input<Pick<EmployeeListItem, 'id' | 'fullName'> | null>(
    null,
  );

  readonly employeeChange = output<Pick<EmployeeListItem, 'id' | 'fullName'> | null>();

  readonly query = signal('');
  readonly results = signal<EmployeeListItem[]>([]);
  readonly searching = signal(false);
  readonly selected = signal<Pick<EmployeeListItem, 'id' | 'fullName'> | null>(
    null,
  );
  readonly open = signal(false);

  private readonly queryChanges = new Subject<string>();

  dropdownOpen(): boolean {
    return this.open() && !this.selected() && !!this.query().trim();
  }

  constructor() {
    this.queryChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => {
          const term = q.trim();
          if (!term) {
            this.searching.set(false);
            return of<EmployeeListItem[]>([]);
          }
          this.searching.set(true);
          this.open.set(true);
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

  ngOnInit(): void {
    const initial = this.initialEmployee();
    if (initial) {
      this.selected.set(initial);
      this.query.set(initial.fullName);
    }
  }

  empMeta(emp: EmployeeListItem): string {
    return [emp.positionName, emp.departmentName].filter(Boolean).join(' · ');
  }

  onFocus(): void {
    if (this.query().trim() && !this.selected()) {
      this.open.set(true);
    }
  }

  closeDropdown(): void {
    this.open.set(false);
  }

  onQueryInput(value: string): void {
    this.query.set(value);
    if (this.selected()) {
      this.selected.set(null);
      this.employeeChange.emit(null);
    }
    if (!value.trim()) {
      this.results.set([]);
      this.open.set(false);
      this.searching.set(false);
      return;
    }
    this.open.set(true);
    this.queryChanges.next(value);
  }

  pick(emp: Pick<EmployeeListItem, 'id' | 'fullName'>): void {
    this.selected.set({ id: emp.id, fullName: emp.fullName });
    this.query.set(emp.fullName);
    this.results.set([]);
    this.open.set(false);
    this.employeeChange.emit({ id: emp.id, fullName: emp.fullName });
  }

  clearSelection(): void {
    this.selected.set(null);
    this.query.set('');
    this.results.set([]);
    this.open.set(false);
    this.employeeChange.emit(null);
  }
}
