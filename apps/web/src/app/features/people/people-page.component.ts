import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';
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
import { canOpenEmployeeCreate } from '../../shared/employees/can-open-employee-create';
import { PeopleEmployeesApiService } from './people-employees-api.service';

@Component({
  selector: 'loom-people-page',
  standalone: true,
  imports: [
    RouterLink,
    EmployeeDirectoryFiltersComponent,
    EmployeeDirectoryTableComponent,
  ],
  template: `
    <section class="page" data-help-id="people.directory">
      <header class="page-head">
        <div>
          <h1>Працівники</h1>
          <p>Кадровий список Loom CRM · профіль: /people/:id</p>
        </div>
        @if (canCreate()) {
          <a routerLink="/people/new" class="btn" data-help-id="people.directory.add">Додати</a>
        }
      </header>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      <loom-employee-directory-filters
        data-help-id="people.directory.filters"
        [filters]="filters()"
        [options]="filterOptions()"
        [sortBy]="sortBy()"
        [sortDir]="sortDir()"
        (filtersChange)="onFiltersChange($event)"
        (sortByChange)="onPhoneSortBy($event)"
        (toggleSortDir)="onToggleSortDir()"
      />

      <loom-employee-directory-table
        data-help-id="people.directory.table"
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
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 8px;
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        padding: 0.65rem 1rem;
        min-height: 2.75rem;
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
      }
      .error {
        color: var(--pw-danger);
        margin: 0;
      }
    `,
  ],
})
export class PeoplePageComponent implements OnInit {
  private readonly api = inject(PeopleEmployeesApiService);
  private readonly catalogApi = inject(OrganizationCatalogApiService);
  private readonly session = inject(SessionStore);
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
  readonly error = signal<string | null>(null);

  readonly canCreate = computed(() => canOpenEmployeeCreate(this.session));

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

  private applyNormalized(requested: EmployeeDirectoryFilters): void {
    const { filters, options } = normalizeDirectoryFilters(
      requested,
      this.catalog,
    );
    this.filters.set(filters);
    this.filterOptions.set(options);
  }
}
