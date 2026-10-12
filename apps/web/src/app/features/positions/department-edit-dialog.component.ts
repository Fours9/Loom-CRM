import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PwDialogHostDirective } from '../../shared/ui/pw-dialog-host.directive';
import { CatalogEditDialogComponent } from './catalog-edit-dialog.component';
import { PositionManagementFacade } from './position-management.facade';

@Component({
  selector: 'loom-department-edit-dialog',
  standalone: true,
  imports: [FormsModule, CatalogEditDialogComponent],
  hostDirectives: [PwDialogHostDirective],
  template: `
    <loom-catalog-edit-dialog
      [headingId]="headingId"
      [title]="vm.editingDepartmentId() ? 'Редагувати відділ' : 'Новий відділ'"
      tourId="positions.dialog.department"
      [error]="vm.error()"
      (closed)="vm.closeDepartmentDialog()"
    >
      <div catalogHeadActions class="head-actions-slot">
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
        <button
          type="button"
          data-help-id="positions.dialog.department.save"
          (click)="vm.saveDepartment()"
        >
          {{ vm.editingDepartmentId() ? 'Зберегти' : 'Створити' }}
        </button>
      </div>

      <form class="catalog-form" novalidate (submit)="$event.preventDefault()">
        <label>
          Назва
          <input
            data-help-id="positions.dialog.department.name"
            [(ngModel)]="vm.newDepartment"
            name="newDepartment"
            placeholder="Назва відділу"
          />
        </label>
        <label>
          Напрямок
          <select
            data-help-id="positions.dialog.department.direction"
            [(ngModel)]="vm.newDepartmentDirectionId"
            name="newDepartmentDirectionId"
          >
            <option value="">Без напрямку</option>
            @for (dir of vm.formDirectionOptions(); track dir.id) {
              <option [value]="dir.id">{{ dir.name }}</option>
            }
          </select>
        </label>
        <label>
          Локація відділу
          <input
            [(ngModel)]="vm.newDepartmentLocation"
            name="newDepartmentLocation"
            placeholder="Наприклад, Київ / Офіс 2"
            maxlength="255"
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
}
