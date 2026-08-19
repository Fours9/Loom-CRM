import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogEditDialogComponent } from './catalog-edit-dialog.component';
import { PositionManagementFacade } from './position-management.facade';

@Component({
  selector: 'loom-skill-edit-dialog',
  standalone: true,
  imports: [FormsModule, CatalogEditDialogComponent],
  template: `
    <loom-catalog-edit-dialog
      [headingId]="headingId"
      [title]="vm.editingSkillId() ? 'Редагувати навичку' : 'Нова навичка'"
      [error]="vm.error()"
      (closed)="vm.closeSkillDialog()"
    >
      <div catalogHeadActions class="head-actions-slot">
        @if (vm.editingSkillId()) {
          <label class="check toggle-active">
            <input
              type="checkbox"
              [(ngModel)]="vm.formSkillIsActive"
              name="formSkillIsActive"
            />
            Увімкнено
          </label>
        }
        <button type="button" (click)="vm.saveCatalogSkill()">
          {{ vm.editingSkillId() ? 'Зберегти' : 'Створити' }}
        </button>
      </div>

      <form class="skill-form" novalidate (submit)="$event.preventDefault()">
        <label>
          Назва
          <input
            [(ngModel)]="vm.newSkillName"
            name="newSkillName"
            placeholder="Назва навички"
          />
        </label>
        <label>
          Група
          <select [(ngModel)]="vm.newSkillGroupId" name="newSkillGroupId">
            <option [ngValue]="null">Без групи</option>
            @for (g of vm.skillFormGroupOptions(); track g.id) {
              <option [ngValue]="g.id">{{ g.name }}</option>
            }
          </select>
        </label>
        <label>
          Тип шкали
          <select [(ngModel)]="vm.newSkillScaleKind" name="newSkillScaleKind">
            <option value="range">Від–до</option>
            <option value="percent">Відсотки</option>
          </select>
        </label>
        <div class="bounds">
          <label>
            Від
            <input type="number" [(ngModel)]="vm.newSkillScaleMin" name="newSkillScaleMin" />
          </label>
          <label>
            До
            <input type="number" [(ngModel)]="vm.newSkillScaleMax" name="newSkillScaleMax" />
          </label>
        </div>
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
      .skill-form {
        display: grid;
        gap: 0.55rem;
      }
      .skill-form label,
      .bounds label {
        display: grid;
        gap: 0.3rem;
        font-size: 0.9rem;
      }
      .bounds {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
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
export class SkillEditDialogComponent {
  readonly vm = inject(PositionManagementFacade);
  readonly headingId = 'skill-edit-dialog-title';
}
