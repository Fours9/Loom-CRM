import { Component, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PositionManagementFacade } from './position-management.facade';

@Component({
  selector: 'loom-department-edit-dialog',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div
      class="backdrop"
      (mousedown)="onBackdropPointerDown($event)"
      (click)="onBackdropClick($event)"
    >
      <div
        class="modal"
        (mousedown)="$event.stopPropagation()"
        (click)="$event.stopPropagation()"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="headingId"
      >
        <div class="head">
          <h2 [id]="headingId">
            {{ vm.editingDepartmentId() ? 'Редагувати відділ' : 'Новий відділ' }}
          </h2>
          <div class="head-actions">
            @if (vm.editingDepartmentId()) {
              <label class="check toggle-active">
                <input
                  type="checkbox"
                  [(ngModel)]="vm.formDepartmentIsActive"
                  name="formDepartmentIsActive"
                />
                Увімкнено
              </label>
            }
            <button type="button" (click)="vm.saveDepartment()">
              {{ vm.editingDepartmentId() ? 'Зберегти' : 'Створити' }}
            </button>
            <button
              type="button"
              class="icon-close"
              aria-label="Закрити"
              title="Закрити"
              (click)="vm.closeDepartmentDialog()"
            >
              ×
            </button>
          </div>
        </div>

        @if (vm.error()) {
          <p class="error">{{ vm.error() }}</p>
        }

        <form class="catalog-form" novalidate (submit)="$event.preventDefault()">
          <label>
            Назва
            <input
              [(ngModel)]="vm.newDepartment"
              name="newDepartment"
              placeholder="Назва відділу"
            />
          </label>
          <label>
            Напрямок
            <select [(ngModel)]="vm.newDepartmentDirectionId" name="newDepartmentDirectionId">
              <option value="">Без напрямку</option>
              @for (dir of vm.formDirectionOptions(); track dir.id) {
                <option [value]="dir.id">{{ dir.name }}</option>
              }
            </select>
          </label>
        </form>
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
        align-items: start;
        background: color-mix(in srgb, #0f172a 45%, transparent);
        padding: calc(var(--shell-topbar-h, 0px) + 1rem) 1rem 0.75rem;
        overflow-y: auto;
      }
      .modal {
        display: grid;
        gap: 0.85rem;
        width: min(28rem, 100%);
        margin: auto;
        padding: 1.1rem 1.2rem 1.25rem;
        border-radius: 12px;
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
      }
      .head {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
      }
      .head-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
        justify-content: flex-end;
      }
      h2 {
        margin: 0;
        font-size: 1.1rem;
      }
      .error {
        margin: 0;
        color: var(--pw-danger);
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
      .check {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
      }
      input,
      select,
      button {
        padding: 0.5rem 0.7rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border-strong);
        box-sizing: border-box;
        font: inherit;
      }
      button {
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        border: 0;
        cursor: pointer;
      }
      .icon-close {
        display: inline-grid;
        place-items: center;
        width: 2.25rem;
        min-width: 2.25rem;
        height: 2.25rem;
        padding: 0;
        font-size: 1.35rem;
        line-height: 1;
        background: transparent;
        color: var(--pw-text);
        border: 1px solid var(--pw-border-strong);
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
    `,
  ],
})
export class DepartmentEditDialogComponent {
  readonly vm = inject(PositionManagementFacade);
  readonly headingId = 'department-edit-dialog-title';
  private backdropPress = false;

  onBackdropPointerDown(event: Event): void {
    this.backdropPress = event.target === event.currentTarget;
  }

  onBackdropClick(event: Event): void {
    if (this.backdropPress && event.target === event.currentTarget) {
      this.vm.closeDepartmentDialog();
    }
    this.backdropPress = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.vm.closeDepartmentDialog();
  }
}
