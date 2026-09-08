import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MultiSelectItem,
  MultiSelectListComponent,
} from '../multi-select-list.component';
import {
  EMPTY_DIRECTORY_FILTERS,
  type EmployeeDirectoryFilterOptions,
  type EmployeeDirectoryFilters,
} from './normalize-directory-filters';
import type {
  EmployeeDirectorySortDir,
  EmployeeDirectorySortKey,
} from './employee-directory-sort';

@Component({
  selector: 'loom-employee-directory-filters',
  standalone: true,
  imports: [FormsModule, MultiSelectListComponent],
  template: `
    <div class="filters">
      <input
        [ngModel]="draftQ"
        (ngModelChange)="onQChange($event)"
        placeholder="Пошук ПІБ / номер / email"
      />
      <label class="filter-block">
        <span>Напрямки</span>
        <app-multi-select-list
          [items]="directionItems"
          [selectedIds]="filters.directionIds"
          placeholder="Усі напрямки"
          (selectedIdsChange)="onDirectionIds($event)"
        />
      </label>
      <label class="filter-block">
        <span>Відділи</span>
        <app-multi-select-list
          [items]="departmentItems"
          [selectedIds]="filters.departmentIds"
          placeholder="Усі відділи"
          (selectedIdsChange)="onDepartmentIds($event)"
        />
      </label>
      <label class="filter-block">
        <span>Посади</span>
        <app-multi-select-list
          [items]="positionItems"
          [selectedIds]="filters.positionIds"
          placeholder="Усі посади"
          (selectedIdsChange)="onPositionIds($event)"
        />
      </label>
      <label class="filter-block narrow phone-sort">
        <span>Сортування</span>
        <select [ngModel]="sortBy" (ngModelChange)="onPhoneSortKey($event)">
          <option value="fullName">ПІБ</option>
          <option value="employeeNumber">Номер</option>
          <option value="direction">Напрямок</option>
          <option value="department">Відділ</option>
          <option value="position">Посада</option>
          <option value="role">Роль</option>
          <option value="status">Статус</option>
        </select>
        <button
          type="button"
          class="sort-dir-btn"
          (click)="toggleSortDir.emit()"
          [attr.aria-label]="'Напрямок: ' + sortDir"
        >
          {{ sortDir === 'asc' ? '↑' : '↓' }}
        </button>
      </label>
    </div>
  `,
  styles: [
    `
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: end;
      }
      .filter-block {
        display: grid;
        gap: 0.35rem;
        font-size: 0.9rem;
        color: var(--pw-text);
        width: 100%;
        flex: 1 1 100%;
        min-width: 0;
      }
      .filter-block.narrow {
        width: 100%;
        flex: 1 1 100%;
      }
      .filters > input {
        width: 100%;
        flex: 1 1 100%;
        align-self: end;
        padding: 0.55rem 0.7rem;
        border: 1px solid var(--pw-border-strong);
        border-radius: 8px;
        background: var(--pw-input-bg);
        color: var(--pw-text);
        min-height: 2.75rem;
        box-sizing: border-box;
      }
      .phone-sort {
        grid-template-columns: 1fr auto;
        align-items: end;
      }
      .phone-sort > span {
        grid-column: 1 / -1;
      }
      .sort-dir-btn {
        min-width: 2.75rem;
        min-height: 2.75rem;
        border: 1px solid var(--pw-border-strong);
        border-radius: 8px;
        background: var(--pw-surface);
        cursor: pointer;
      }
      select {
        padding: 0.55rem 0.7rem;
        border: 1px solid var(--pw-border-strong);
        border-radius: 8px;
        background: var(--pw-input-bg);
        color: var(--pw-text);
        min-height: 2.75rem;
      }
      @media (min-width: 641px) {
        .filter-block {
          width: 220px;
          flex: 0 0 220px;
        }
        .filter-block.narrow {
          width: 200px;
          flex: 0 0 200px;
        }
        .filters > input {
          width: 240px;
          flex: 0 0 240px;
        }
        .phone-sort {
          display: none;
        }
      }
    `,
  ],
})
export class EmployeeDirectoryFiltersComponent implements OnChanges {
  @Input() filters: EmployeeDirectoryFilters = EMPTY_DIRECTORY_FILTERS;
  @Input() options: EmployeeDirectoryFilterOptions = {
    directions: [],
    departments: [],
    positions: [],
  };
  @Input() sortBy: EmployeeDirectorySortKey = 'fullName';
  @Input() sortDir: EmployeeDirectorySortDir = 'asc';

  @Output() readonly filtersChange = new EventEmitter<EmployeeDirectoryFilters>();
  @Output() readonly sortByChange = new EventEmitter<EmployeeDirectorySortKey>();
  @Output() readonly toggleSortDir = new EventEmitter<void>();

  draftQ = '';
  private qTimer: ReturnType<typeof setTimeout> | null = null;

  get directionItems(): MultiSelectItem[] {
    return this.options.directions;
  }
  get departmentItems(): MultiSelectItem[] {
    return this.options.departments;
  }
  get positionItems(): MultiSelectItem[] {
    return this.options.positions;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filters']) {
      this.draftQ = this.filters.q ?? '';
    }
  }

  onQChange(value: string): void {
    this.draftQ = value;
    if (this.qTimer) clearTimeout(this.qTimer);
    this.qTimer = setTimeout(() => {
      this.emitFilters({ ...this.filters, q: this.draftQ });
    }, 250);
  }

  onDirectionIds(ids: string[]): void {
    this.emitFilters({ ...this.filters, directionIds: ids });
  }

  onDepartmentIds(ids: string[]): void {
    this.emitFilters({ ...this.filters, departmentIds: ids });
  }

  onPositionIds(ids: string[]): void {
    this.emitFilters({ ...this.filters, positionIds: ids });
  }

  onPhoneSortKey(value: string): void {
    this.sortByChange.emit(value as EmployeeDirectorySortKey);
  }

  private emitFilters(next: EmployeeDirectoryFilters): void {
    this.filtersChange.emit(next);
  }
}
