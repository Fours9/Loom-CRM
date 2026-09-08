import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  Subject,
  catchError,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { Permission } from '@loom/contracts-auth';
import { SessionStore } from '../../core/auth/session.store';
import {
  OrganizationCatalogApiService,
  type OrganizationCatalogSnapshot,
} from '../../core/api/organization-catalog-api.service';
import { EmployeeDirectoryFiltersComponent } from '../../shared/employees/employee-directory-filters.component';
import { EmployeeDirectoryTableComponent } from '../../shared/employees/employee-directory-table.component';
import {
  toEmployeeDirectoryItemVm,
  type EmployeeDirectoryItemVm,
} from '../../shared/employees/employee-directory-item.vm';
import {
  EMPTY_DIRECTORY_FILTERS,
  normalizeDirectoryFilters,
  type EmployeeDirectoryFilterOptions,
  type EmployeeDirectoryFilters,
} from '../../shared/employees/normalize-directory-filters';
import {
  toggleDirectorySort,
  type EmployeeDirectorySortDir,
  type EmployeeDirectorySortKey,
} from '../../shared/employees/employee-directory-sort';
import { PeopleEmployeesApiService } from './people-employees-api.service';

@Component({
  selector: 'loom-people-page',
  standalone: true,
  imports: [
    FormsModule,
    EmployeeDirectoryFiltersComponent,
    EmployeeDirectoryTableComponent,
  ],
  template: `
    <section class="page">
      <header class="page-head">
        <div>
          <h1>Працівники</h1>
          <p>Кадровий список Loom CRM · профіль: /people/:id</p>
        </div>
        @if (canCreate()) {
          <button
            type="button"
            class="btn"
            (click)="showCreate.set(!showCreate())"
            [disabled]="busy()"
          >
            {{ showCreate() ? 'Скасувати' : 'Додати' }}
          </button>
        }
      </header>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      @if (canCreate() && showCreate()) {
        <div class="create-card">
          <h2>Новий працівник</h2>
          <div class="form">
            <label>
              Імʼя
              <input [(ngModel)]="firstName" autocomplete="given-name" />
            </label>
            <label>
              Прізвище
              <input [(ngModel)]="lastName" autocomplete="family-name" />
            </label>
          </div>
          <button
            type="button"
            class="btn"
            (click)="create()"
            [disabled]="busy() || !firstName.trim() || !lastName.trim()"
          >
            Створити
          </button>
        </div>
      }

      <loom-employee-directory-filters
        [filters]="filters()"
        [options]="filterOptions()"
        [sortBy]="sortBy()"
        [sortDir]="sortDir()"
        (filtersChange)="onFiltersChange($event)"
        (sortByChange)="onPhoneSortBy($event)"
        (toggleSortDir)="onToggleSortDir()"
      />

      <loom-employee-directory-table
        [items]="items()"
        [loading]="loading()"
        [sortBy]="sortBy()"
        [sortDir]="sortDir()"
        (sortToggle)="onSortToggle($event)"
      />
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
      .error {
        color: var(--pw-danger);
        margin: 0;
      }
      @media (min-width: 641px) {
        .form {
          grid-template-columns: 1fr 1fr;
        }
      }
    `,
  ],
})
export class PeoplePageComponent implements OnInit {
  private readonly api = inject(PeopleEmployeesApiService);
  private readonly catalogApi = inject(OrganizationCatalogApiService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly load$ = new Subject<void>();
  private catalog: OrganizationCatalogSnapshot | null = null;

  readonly filters = signal<EmployeeDirectoryFilters>({
    ...EMPTY_DIRECTORY_FILTERS,
  });
  readonly filterOptions = signal<EmployeeDirectoryFilterOptions>({
    directions: [],
    departments: [],
    positions: [],
  });
  readonly sortBy = signal<EmployeeDirectorySortKey>('fullName');
  readonly sortDir = signal<EmployeeDirectorySortDir>('asc');
  readonly items = signal<EmployeeDirectoryItemVm[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly showCreate = signal(false);
  firstName = '';
  lastName = '';

  readonly canCreate = computed(() =>
    this.session.hasPermission(Permission.EmployeesCreate),
  );

  ngOnInit(): void {
    this.load$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(() => {
          const f = this.filters();
          return this.api
            .getEmployees({
              ...f,
              sortBy: this.sortBy(),
              sortDir: this.sortDir(),
            })
            .pipe(
              catchError(() => {
                this.error.set(
                  'Не вдалося завантажити працівників (потрібен вхід)',
                );
                return of([]);
              }),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => {
        this.items.set(rows.map((e) => toEmployeeDirectoryItemVm(e)));
        this.loading.set(false);
      });

    this.catalogApi
      .getSnapshot()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (snapshot) => {
          this.catalog = snapshot;
          this.applyNormalized(this.filters());
          this.load$.next();
        },
        error: () => {
          this.error.set('Не вдалося завантажити довідники');
          this.load$.next();
        },
      });
  }

  onFiltersChange(requested: EmployeeDirectoryFilters): void {
    this.applyNormalized(requested);
    this.load$.next();
  }

  onSortToggle(key: EmployeeDirectorySortKey): void {
    const next = toggleDirectorySort(this.sortBy(), this.sortDir(), key);
    this.sortBy.set(next.sortBy);
    this.sortDir.set(next.sortDir);
    this.load$.next();
  }

  onPhoneSortBy(key: EmployeeDirectorySortKey): void {
    this.sortBy.set(key);
    this.load$.next();
  }

  onToggleSortDir(): void {
    this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    this.load$.next();
  }

  create(): void {
    if (!this.canCreate()) return;
    if (!this.firstName.trim() || !this.lastName.trim()) return;
    this.busy.set(true);
    this.api
      .createEmployee({
        firstName: this.firstName.trim(),
        lastName: this.lastName.trim(),
      })
      .subscribe({
        next: (created) => {
          this.firstName = '';
          this.lastName = '';
          this.showCreate.set(false);
          this.busy.set(false);
          void this.router.navigate(['/people', created.id]);
        },
        error: () => {
          this.error.set('Створення не вдалося');
          this.busy.set(false);
        },
      });
  }

  private applyNormalized(requested: EmployeeDirectoryFilters): void {
    const { filters, options } = normalizeDirectoryFilters(
      requested,
      this.catalog,
    );
    this.filters.set(filters);
    this.filterOptions.set(options);
  }
}
