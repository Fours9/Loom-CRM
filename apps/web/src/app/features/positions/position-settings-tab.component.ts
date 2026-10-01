import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  type EmploymentCatalogItem,
  SettingsOrgApiService,
} from '../settings/settings-org-api.service';
import { CatalogEditDialogComponent } from './catalog-edit-dialog.component';
import { EmploymentCatalogListComponent } from './employment-catalog-list.component';

type CatalogKind = 'workFormat' | 'employmentType';
type SettingsPanel = 'workFormats' | 'employmentTypes';

type CatalogDialogState =
  | { kind: CatalogKind; mode: 'create' }
  | { kind: CatalogKind; mode: 'edit'; item: EmploymentCatalogItem };

@Component({
  selector: 'loom-position-settings-tab',
  standalone: true,
  imports: [FormsModule, CatalogEditDialogComponent, EmploymentCatalogListComponent],
  template: `
    <section class="settings" data-help-id="positions.formats">
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      <div class="catalog-rail" data-help-id="positions.formats.list">
        <article
          class="card panel"
          [class.collapsed]="!panelOpen().workFormats"
          [attr.aria-expanded]="panelOpen().workFormats"
        >
          <button
            type="button"
            class="panel-toggle"
            [attr.title]="
              panelOpen().workFormats ? 'Згорнути: Формати роботи' : 'Формати роботи'
            "
            [attr.aria-label]="
              panelOpen().workFormats
                ? 'Згорнути формати роботи'
                : 'Розгорнути формати роботи'
            "
            (click)="togglePanel('workFormats')"
          >
            @if (panelOpen().workFormats) {
              <h3>Формати роботи</h3>
              <span class="panel-caret" aria-hidden="true"></span>
            } @else {
              <svg class="panel-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M4 6h16a1 1 0 0 1 1 1v9H3V7a1 1 0 0 1 1-1zm-2 12h20v2H2v-2z"
                />
              </svg>
            }
          </button>
          <div class="panel-body">
            <button type="button" class="btn" (click)="openCreate('workFormat')">
              Додати
            </button>
            <loom-employment-catalog-list
              [items]="workFormats()"
              emptyLabel="Форматів роботи ще немає."
              (reordered)="onWorkFormatsReordered($event)"
              (edit)="openEdit('workFormat', $event)"
              (remove)="deleteWorkFormat($event)"
              (toggled)="toggleWorkFormat($event.item, $event.isActive)"
            />
          </div>
        </article>

        <article
          class="card panel"
          [class.collapsed]="!panelOpen().employmentTypes"
          [attr.aria-expanded]="panelOpen().employmentTypes"
        >
          <button
            type="button"
            class="panel-toggle"
            [attr.title]="
              panelOpen().employmentTypes
                ? 'Згорнути: Типи зайнятості'
                : 'Типи зайнятості'
            "
            [attr.aria-label]="
              panelOpen().employmentTypes
                ? 'Згорнути типи зайнятості'
                : 'Розгорнути типи зайнятості'
            "
            (click)="togglePanel('employmentTypes')"
          >
            @if (panelOpen().employmentTypes) {
              <h3>Типи зайнятості</h3>
              <span class="panel-caret" aria-hidden="true"></span>
            } @else {
              <svg class="panel-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M20 6h-4V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm-10-2h4v2h-4V4z"
                />
              </svg>
            }
          </button>
          <div class="panel-body">
            <button type="button" class="btn" (click)="openCreate('employmentType')">
              Додати
            </button>
            <loom-employment-catalog-list
              [items]="employmentTypes()"
              emptyLabel="Типів зайнятості ще немає."
              (reordered)="onEmploymentTypesReordered($event)"
              (edit)="openEdit('employmentType', $event)"
              (remove)="deleteEmploymentType($event)"
              (toggled)="toggleEmploymentType($event.item, $event.isActive)"
            />
          </div>
        </article>
      </div>
    </section>

    @if (dialog(); as d) {
      <loom-catalog-edit-dialog
        [headingId]="dialogHeadingId"
        [title]="dialogTitle(d)"
        [error]="dialogError()"
        (closed)="closeDialog()"
      >
        <div catalogHeadActions class="head-actions-slot">
          @if (d.mode === 'edit') {
            <label class="check toggle-active">
              <input type="checkbox" [(ngModel)]="formIsActive" name="catalogItemActive" />
              Увімкнено
            </label>
          }
          <button type="button" (click)="saveDialog()">
            {{ d.mode === 'edit' ? 'Зберегти' : 'Створити' }}
          </button>
        </div>

        <form class="catalog-form" novalidate (submit)="$event.preventDefault(); saveDialog()">
          <label>
            Назва
            <input [(ngModel)]="formName" name="catalogItemName" maxlength="64" />
          </label>
          <label>
            Опис
            <textarea
              [(ngModel)]="formDescription"
              name="catalogItemDescription"
              rows="3"
              maxlength="500"
            ></textarea>
          </label>
        </form>
      </loom-catalog-edit-dialog>
    }
  `,
  styles: [
    `
      .settings {
        display: grid;
        gap: 1rem;
        min-width: 0;
      }
      .catalog-rail {
        display: flex;
        flex-wrap: nowrap;
        gap: 1rem;
        align-items: stretch;
        min-width: 0;
        overflow-x: auto;
      }
      .card {
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        padding: 1rem;
        display: grid;
        gap: 0.75rem;
        align-content: start;
        min-width: 0;
      }
      .card.panel {
        flex: 1 1 0;
        min-width: 14rem;
        max-width: 100%;
        transition:
          flex-basis 0.22s ease,
          min-width 0.22s ease,
          max-width 0.22s ease,
          padding 0.22s ease;
      }
      .card.panel.collapsed {
        flex: 0 0 3.25rem;
        min-width: 3.25rem;
        max-width: 3.25rem;
        padding: 0.65rem 0.35rem;
        overflow: hidden;
      }
      .panel-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        width: 100%;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        text-align: left;
        min-height: 2rem;
      }
      .panel-toggle h3 {
        margin: 0;
        font-size: 1.05rem;
      }
      .panel-toggle .panel-caret {
        flex: 0 0 auto;
        width: 1.6rem;
        height: 1.6rem;
        display: grid;
        place-items: center;
        border-radius: 6px;
        border: 1px solid color-mix(in srgb, var(--pw-muted) 55%, transparent);
        background: var(--pw-surface-2, color-mix(in srgb, var(--pw-muted) 8%, var(--pw-surface)));
        color: var(--pw-text-strong, inherit);
        font-size: 1.05rem;
        line-height: 1;
        transform: rotate(90deg);
        transition:
          transform 0.15s ease,
          background 0.15s ease,
          border-color 0.15s ease,
          color 0.15s ease;
      }
      .panel-toggle .panel-caret::before {
        content: '▾';
      }
      .panel-toggle:hover .panel-caret {
        background: var(--pw-accent-soft);
        border-color: var(--pw-accent);
        color: var(--pw-accent);
      }
      .card.panel.collapsed .panel-toggle {
        justify-content: center;
        padding: 0.25rem 0;
      }
      .panel-icon {
        display: block;
        color: var(--pw-accent);
      }
      .panel-body {
        display: grid;
        gap: 0.75rem;
        min-width: 0;
        overflow: hidden;
      }
      .card.panel.collapsed .panel-body {
        display: none;
      }
      .btn {
        justify-self: start;
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        border: 0;
        border-radius: 8px;
        padding: 0.5rem 0.7rem;
        font: inherit;
        cursor: pointer;
      }
      .error {
        color: var(--pw-danger);
        margin: 0;
      }
      .head-actions-slot {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      }
      .catalog-form {
        display: grid;
        gap: 0.75rem;
      }
      .catalog-form label {
        display: grid;
        gap: 0.3rem;
        font-size: 0.9rem;
      }
      .catalog-form input,
      .catalog-form textarea,
      .head-actions-slot button {
        padding: 0.5rem 0.7rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border-strong);
        box-sizing: border-box;
        font: inherit;
      }
      .catalog-form textarea {
        resize: vertical;
        min-height: 4.5rem;
      }
      .head-actions-slot button {
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        border: 0;
        cursor: pointer;
      }
      .check {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
      }
      .toggle-active {
        white-space: nowrap;
      }
      .check input[type='checkbox'] {
        width: 1rem;
        height: 1rem;
        margin: 0;
        padding: 0;
        border: none;
        flex: 0 0 auto;
      }
      @media (prefers-reduced-motion: reduce) {
        .card.panel {
          transition: none;
        }
      }
      @media (max-width: 640px) {
        .catalog-rail {
          flex-wrap: wrap;
        }
        .card.panel,
        .card.panel.collapsed {
          flex: 1 1 100%;
          min-width: 0;
          max-width: none;
        }
        .card.panel.collapsed {
          flex-basis: 3.25rem;
          max-width: 3.25rem;
          min-width: 3.25rem;
        }
      }
    `,
  ],
})
export class PositionSettingsTabComponent implements OnInit {
  private readonly api = inject(SettingsOrgApiService);

  readonly workFormats = signal<EmploymentCatalogItem[]>([]);
  readonly employmentTypes = signal<EmploymentCatalogItem[]>([]);
  readonly error = signal('');
  readonly dialog = signal<CatalogDialogState | null>(null);
  readonly dialogError = signal('');
  readonly dialogHeadingId = 'employment-catalog-edit-dialog-title';
  readonly panelOpen = signal<Record<SettingsPanel, boolean>>({
    workFormats: true,
    employmentTypes: true,
  });

  formName = '';
  formDescription = '';
  formIsActive = true;

  ngOnInit(): void {
    this.reload();
  }

  togglePanel(panel: SettingsPanel): void {
    this.panelOpen.update((state) => ({ ...state, [panel]: !state[panel] }));
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

  dialogTitle(state: CatalogDialogState): string {
    const create = state.mode === 'create';
    if (state.kind === 'workFormat') {
      return create ? 'Новий формат роботи' : 'Редагувати формат роботи';
    }
    return create ? 'Новий тип зайнятості' : 'Редагувати тип зайнятості';
  }

  openCreate(kind: CatalogKind): void {
    this.formName = '';
    this.formDescription = '';
    this.formIsActive = true;
    this.dialogError.set('');
    this.error.set('');
    this.panelOpen.update((state) => ({
      ...state,
      [kind === 'workFormat' ? 'workFormats' : 'employmentTypes']: true,
    }));
    this.dialog.set({ kind, mode: 'create' });
  }

  openEdit(kind: CatalogKind, item: EmploymentCatalogItem): void {
    this.formName = item.name;
    this.formDescription = item.description ?? '';
    this.formIsActive = item.isActive;
    this.dialogError.set('');
    this.error.set('');
    this.dialog.set({ kind, mode: 'edit', item });
  }

  closeDialog(): void {
    this.dialog.set(null);
    this.dialogError.set('');
  }

  saveDialog(): void {
    const state = this.dialog();
    if (!state) return;
    const name = this.formName.trim();
    if (!name) {
      this.dialogError.set(
        state.kind === 'workFormat'
          ? 'Вкажіть назву формату роботи'
          : 'Вкажіть назву типу зайнятості',
      );
      return;
    }

    const description = this.formDescription.trim() || null;
    const payload =
      state.mode === 'edit'
        ? { name, description, isActive: this.formIsActive }
        : { name, description };

    const request =
      state.kind === 'workFormat'
        ? state.mode === 'edit'
          ? this.api.updateWorkFormat(state.item.id, payload)
          : this.api.createWorkFormat(payload)
        : state.mode === 'edit'
          ? this.api.updateEmploymentType(state.item.id, payload)
          : this.api.createEmploymentType(payload);

    request.subscribe({
      next: () => {
        this.closeDialog();
        this.reload();
      },
      error: () =>
        this.dialogError.set(
          state.kind === 'workFormat'
            ? 'Не вдалося зберегти формат роботи'
            : 'Не вдалося зберегти тип зайнятості',
        ),
    });
  }

  onWorkFormatsReordered(next: EmploymentCatalogItem[]): void {
    const previous = this.workFormats();
    this.workFormats.set(next);
    this.api.reorderWorkFormats(next.map((row) => row.id)).subscribe({
      next: (rows) => this.workFormats.set(rows),
      error: () => {
        this.workFormats.set(previous);
        this.error.set('Не вдалося змінити порядок форматів роботи');
      },
    });
  }

  onEmploymentTypesReordered(next: EmploymentCatalogItem[]): void {
    const previous = this.employmentTypes();
    this.employmentTypes.set(next);
    this.api.reorderEmploymentTypes(next.map((row) => row.id)).subscribe({
      next: (rows) => this.employmentTypes.set(rows),
      error: () => {
        this.employmentTypes.set(previous);
        this.error.set('Не вдалося змінити порядок типів зайнятості');
      },
    });
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
