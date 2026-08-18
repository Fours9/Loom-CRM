import { Component, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PositionManagementFacade } from './position-management.facade';

@Component({
  selector: 'loom-skill-edit-dialog',
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
            {{ vm.editingSkillId() ? 'Редагувати навичку' : 'Нова навичка' }}
          </h2>
          <div class="head-actions">
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
            <button
              type="button"
              class="icon-close"
              aria-label="Закрити"
              title="Закрити"
              (click)="vm.closeSkillDialog()"
            >
              ×
            </button>
          </div>
        </div>

        @if (vm.error()) {
          <p class="error">{{ vm.error() }}</p>
        }

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
              <option value="">Оберіть групу</option>
              @for (g of vm.skillFormGroupOptions(); track g.id) {
                <option [value]="g.id">{{ g.name }}</option>
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
        max-height: calc(100dvh - var(--shell-topbar-h, 0px) - 1.75rem);
        overflow: auto;
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
export class SkillEditDialogComponent {
  readonly vm = inject(PositionManagementFacade);
  readonly headingId = 'skill-edit-dialog-title';
  private backdropPress = false;

  onBackdropPointerDown(event: Event): void {
    this.backdropPress = event.target === event.currentTarget;
  }

  onBackdropClick(event: Event): void {
    if (this.backdropPress && event.target === event.currentTarget) {
      this.vm.closeSkillDialog();
    }
    this.backdropPress = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.vm.closeSkillDialog();
  }
}
