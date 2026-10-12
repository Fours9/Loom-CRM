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
  sortEmployeeDirectoryItems,
  toggleDirectorySort,
  type EmployeeDirectorySortDir,
  type EmployeeDirectorySortKey,
} from '../../shared/employees/employee-directory-sort';
import { canOpenEmployeeCreate } from '../../shared/employees/can-open-employee-create';
import { peopleDirectoryLoadErrorMessage } from './people-directory-load-error';
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
    <section class="page pw-stage" data-help-id="people.directory">
      <span class="pw-stage__glow" aria-hidden="true"></span>
      <header class="page-head pw-page-head pw-rise">
        <div>
          <p class="pw-eyebrow">Організація</p>
          <h1>Працівники</h1>
          <p class="pw-lead">Кадровий список і профілі команди</p>
        </div>
        @if (canCreate()) {
          <a routerLink="/people/new" class="btn pw-btn" data-help-id="people.directory.add">Додати</a>
        }
      </header>

      @if (error()) {
        <p class="error pw-rise" style="--pw-delay: 60ms">{{ error() }}</p>
      }

      <div class="filters-shell pw-panel pw-filters pw-rise" style="--pw-delay: 80ms">
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
      </div>

      <div class="list-shell pw-rise" style="--pw-delay: 140ms">
        <loom-employee-directory-table
          data-help-id="people.directory.table"
          [items]="items()"
          [loading]="loading()"
          [sortBy]="sortBy()"
          [sortDir]="sortDir()"
          (sortToggle)="onSortToggle($event)"
        />
      </div>
    </section>
  `,
  styles: [
    `
      .page-head {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 1rem;
        align-items: start;
      }
      .filters-shell {
        position: relative;
        z-index: 4;
        isolation: isolate;
        padding: 1rem 1.05rem;
        overflow: visible;
      }
      .list-shell {
        position: relative;
        z-index: 0;
        isolation: isolate;
        min-width: 0;
      }
      .error {
        color: var(--pw-danger);
        margin: 0;
        font-weight: 600;
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
              catchError((err: unknown) => {
                this.error.set(peopleDirectoryLoadErrorMessage(err));
                return of([]);
              }),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => {
        const vms = rows.map((e) => toEmployeeDirectoryItemVm(e));
        this.items.set(
          sortEmployeeDirectoryItems(vms, this.sortBy(), this.sortDir()),
        );
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

  /** Sort is in-memory — list has no pagination; avoid refetch races. */
  onSortToggle(key: EmployeeDirectorySortKey): void {
    const next = toggleDirectorySort(this.sortBy(), this.sortDir(), key);
    this.sortBy.set(next.sortBy);
    this.sortDir.set(next.sortDir);
    this.resortItems();
  }

  onPhoneSortBy(key: EmployeeDirectorySortKey): void {
    this.sortBy.set(key);
    this.resortItems();
  }

  onToggleSortDir(): void {
    this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    this.resortItems();
  }

  private resortItems(): void {
    this.items.set(
      sortEmployeeDirectoryItems(this.items(), this.sortBy(), this.sortDir()),
    );
    this.error.set(null);
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
