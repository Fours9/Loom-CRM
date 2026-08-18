import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogEditDialogComponent } from './catalog-edit-dialog.component';
import { PositionManagementFacade } from './position-management.facade';

@Component({
  selector: 'loom-skill-group-edit-dialog',
  standalone: true,
  imports: [FormsModule, CatalogEditDialogComponent],
  template: `
    <loom-catalog-edit-dialog
      [headingId]="headingId"
      [title]="vm.editingGroupId() ? 'Редагувати групу' : 'Нова група'"
      [error]="vm.error()"
      (closed)="vm.closeGroupDialog()"
    >
      <div catalogHeadActions class="head-actions-slot">
        @if (vm.editingGroupId()) {
          <label class="check toggle-active">
            <input
              type="checkbox"
              [(ngModel)]="vm.formGroupIsActive"
              name="formGroupIsActive"
            />
            Увімкнено
          </label>
        }
        <button type="button" (click)="vm.saveCatalogGroup()">
          {{ vm.editingGroupId() ? 'Зберегти' : 'Створити' }}
        </button>
      </div>

      <form class="group-form" novalidate (submit)="$event.preventDefault()">
        <label>
          Назва
          <input
            [(ngModel)]="vm.newGroupName"
            name="newGroupName"
            placeholder="Назва групи"
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
      .group-form label {
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
export class SkillGroupEditDialogComponent {
  readonly vm = inject(PositionManagementFacade);
  readonly headingId = 'skill-group-edit-dialog-title';
}
