import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  type EmploymentCatalogItem,
  SettingsOrgApiService,
} from '../settings/settings-org-api.service';

@Component({
  selector: 'loom-position-settings-tab',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="settings">
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      <article class="card">
        <div class="head">
          <h2>Формати роботи</h2>
          <button type="button" class="btn" (click)="saveWorkFormat()">
            {{ editingWorkFormatId() ? 'Зберегти' : 'Додати' }}
          </button>
        </div>
        <div class="form">
          <label>
            Назва
            <input [(ngModel)]="workFormatName" name="workFormatName" maxlength="64" />
          </label>
          <label>
            Порядок
            <input [(ngModel)]="workFormatSortOrder" name="workFormatSortOrder" type="number" />
          </label>
        </div>
        <ul class="rows">
          @for (item of workFormats(); track item.id) {
            <li>
              <span>{{ item.name }} <small>порядок {{ item.sortOrder }}</small></span>
              <span class="actions">
                <label class="toggle">
                  <input
                    type="checkbox"
                    [checked]="item.isActive"
                    (change)="toggleWorkFormat(item, $any($event.target).checked)"
                  />
                </label>
                <button type="button" class="btn ghost" (click)="editWorkFormat(item)">
                  Редагувати
                </button>
                <button type="button" class="btn ghost danger" (click)="deleteWorkFormat(item)">
                  Видалити
                </button>
              </span>
            </li>
          }
        </ul>
      </article>

      <article class="card">
        <div class="head">
          <h2>Типи зайнятості</h2>
          <button type="button" class="btn" (click)="saveEmploymentType()">
            {{ editingEmploymentTypeId() ? 'Зберегти' : 'Додати' }}
          </button>
        </div>
        <div class="form">
          <label>
            Назва
            <input
              [(ngModel)]="employmentTypeName"
              name="employmentTypeName"
              maxlength="64"
            />
          </label>
          <label>
            Порядок
            <input
              [(ngModel)]="employmentTypeSortOrder"
              name="employmentTypeSortOrder"
              type="number"
            />
          </label>
        </div>
        <ul class="rows">
          @for (item of employmentTypes(); track item.id) {
            <li>
              <span>{{ item.name }} <small>порядок {{ item.sortOrder }}</small></span>
              <span class="actions">
                <label class="toggle">
                  <input
                    type="checkbox"
                    [checked]="item.isActive"
                    (change)="toggleEmploymentType(item, $any($event.target).checked)"
                  />
                </label>
                <button type="button" class="btn ghost" (click)="editEmploymentType(item)">
                  Редагувати
                </button>
                <button type="button" class="btn ghost danger" (click)="deleteEmploymentType(item)">
                  Видалити
                </button>
              </span>
            </li>
          }
        </ul>
      </article>
    </section>
  `,
  styles: [
    `
      .settings {
        display: grid;
        gap: 1rem;
      }
      .card {
        display: grid;
        gap: 0.85rem;
        padding: 1rem;
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        background: var(--pw-surface);
      }
      .head,
      .actions,
      li {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        justify-content: space-between;
      }
      .form {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }
      .form label {
        display: grid;
        gap: 0.25rem;
      }
      input,
      button {
        padding: 0.5rem 0.7rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border-strong);
        font: inherit;
      }
      .rows {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.5rem;
      }
      li {
        border: 1px solid var(--pw-border);
        border-radius: 10px;
        padding: 0.75rem;
      }
      .btn {
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        border: 0;
        cursor: pointer;
      }
      .btn.ghost {
        background: var(--pw-accent-soft);
        color: var(--pw-accent);
      }
      .btn.danger {
        color: var(--pw-danger);
      }
      .error {
        color: var(--pw-danger);
        margin: 0;
      }
    `,
  ],
})
export class PositionSettingsTabComponent implements OnInit {
  private readonly api = inject(SettingsOrgApiService);

  readonly workFormats = signal<EmploymentCatalogItem[]>([]);
  readonly employmentTypes = signal<EmploymentCatalogItem[]>([]);
  readonly error = signal('');
  readonly editingWorkFormatId = signal<string | null>(null);
  readonly editingEmploymentTypeId = signal<string | null>(null);

  workFormatName = '';
  workFormatSortOrder = 0;
  employmentTypeName = '';
  employmentTypeSortOrder = 0;

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.api.getWorkFormats(true).subscribe({
      next: (rows) => this.workFormats.set(rows),
      error: () => this.error.set('Не вдалося завантажити формати роботи'),
    });
    this.api.getEmploymentTypes(true).subscribe({
      next: (rows) => this.employmentTypes.set(rows),
      error: () => this.error.set('Не вдалося завантажити типи зайнятості'),
    });
  }

  saveWorkFormat(): void {
    if (!this.workFormatName.trim()) {
      this.error.set('Вкажіть назву формату роботи');
      return;
    }
    const id = this.editingWorkFormatId();
    const request = id
      ? this.api.updateWorkFormat(id, {
          name: this.workFormatName.trim(),
          sortOrder: Number(this.workFormatSortOrder),
        })
      : this.api.createWorkFormat({
          name: this.workFormatName.trim(),
          sortOrder: Number(this.workFormatSortOrder),
        });
    request.subscribe({
      next: () => {
        this.editingWorkFormatId.set(null);
        this.workFormatName = '';
        this.workFormatSortOrder = 0;
        this.error.set('');
        this.reload();
      },
      error: () => this.error.set('Не вдалося зберегти формат роботи'),
    });
  }

  editWorkFormat(item: EmploymentCatalogItem): void {
    this.editingWorkFormatId.set(item.id);
    this.workFormatName = item.name;
    this.workFormatSortOrder = item.sortOrder;
  }

  toggleWorkFormat(item: EmploymentCatalogItem, isActive: boolean): void {
    this.api.updateWorkFormat(item.id, { isActive }).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('Не вдалося змінити стан формату роботи'),
    });
  }

  deleteWorkFormat(item: EmploymentCatalogItem): void {
    if (!confirm(`Видалити формат роботи «${item.name}»?`)) return;
    this.api.deleteWorkFormat(item.id).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('Не вдалося видалити формат роботи'),
    });
  }

  saveEmploymentType(): void {
    if (!this.employmentTypeName.trim()) {
      this.error.set('Вкажіть назву типу зайнятості');
      return;
    }
    const id = this.editingEmploymentTypeId();
    const request = id
      ? this.api.updateEmploymentType(id, {
          name: this.employmentTypeName.trim(),
          sortOrder: Number(this.employmentTypeSortOrder),
        })
      : this.api.createEmploymentType({
          name: this.employmentTypeName.trim(),
          sortOrder: Number(this.employmentTypeSortOrder),
        });
    request.subscribe({
      next: () => {
        this.editingEmploymentTypeId.set(null);
        this.employmentTypeName = '';
        this.employmentTypeSortOrder = 0;
        this.error.set('');
        this.reload();
      },
      error: () => this.error.set('Не вдалося зберегти тип зайнятості'),
    });
  }

  editEmploymentType(item: EmploymentCatalogItem): void {
    this.editingEmploymentTypeId.set(item.id);
    this.employmentTypeName = item.name;
    this.employmentTypeSortOrder = item.sortOrder;
  }

  toggleEmploymentType(item: EmploymentCatalogItem, isActive: boolean): void {
    this.api.updateEmploymentType(item.id, { isActive }).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('Не вдалося змінити стан типу зайнятості'),
    });
  }

  deleteEmploymentType(item: EmploymentCatalogItem): void {
    if (!confirm(`Видалити тип зайнятості «${item.name}»?`)) return;
    this.api.deleteEmploymentType(item.id).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('Не вдалося видалити тип зайнятості'),
    });
  }
}
