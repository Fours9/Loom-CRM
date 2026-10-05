import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogEditDialogComponent } from './catalog-edit-dialog.component';
import { PositionManagementFacade } from './position-management.facade';

@Component({
  selector: 'loom-direction-edit-dialog',
  standalone: true,
  imports: [FormsModule, CatalogEditDialogComponent],
  template: `
    <loom-catalog-edit-dialog
      [headingId]="headingId"
      [title]="vm.editingDirectionId() ? 'Редагувати напрямок' : 'Новий напрямок'"
      tourId="positions.dialog.direction"
      [error]="vm.error()"
      (closed)="vm.closeDirectionDialog()"
    >
      <div catalogHeadActions class="head-actions-slot">
        @if (vm.editingDirectionId()) {
          <label class="check toggle-active">
            <input
              type="checkbox"
              [(ngModel)]="vm.formDirectionIsActive"
              name="formDirectionIsActive"
            />
            Увімкнено
          </label>
        }
        <button
          type="button"
          data-help-id="positions.dialog.direction.save"
          (click)="vm.saveDirection()"
        >
          {{ vm.editingDirectionId() ? 'Зберегти' : 'Створити' }}
        </button>
      </div>

      <form class="catalog-form" novalidate (submit)="$event.preventDefault()">
        <label>
          Назва
          <input
            data-help-id="positions.dialog.direction.name"
            [(ngModel)]="vm.newDirection"
            name="newDirection"
            placeholder="Назва напрямку"
          />
        </label>
      </form>
    </loom-catalog-edit-dialog>
  `,
  styles: [
    `
      .head-actions-slot {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
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
export class DirectionEditDialogComponent {
  readonly vm = inject(PositionManagementFacade);
  readonly headingId = 'direction-edit-dialog-title';
}
