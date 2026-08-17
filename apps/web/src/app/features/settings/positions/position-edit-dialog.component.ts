import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PositionManagementFacade } from './position-management.facade';

@Component({
  selector: 'loom-position-edit-dialog',
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
            {{ vm.editingId() ? 'Редагувати посаду' : 'Нова посада' }}
          </h2>
          <button type="button" class="ghost-neutral" (click)="vm.closePositionDialog()">
            Закрити
          </button>
        </div>

        @if (vm.error()) {
          <p class="error">{{ vm.error() }}</p>
        }

        <form class="position-form" novalidate (submit)="$event.preventDefault()">
          <label>
            Назва
            <input
              [(ngModel)]="vm.formName"
              name="formName"
              placeholder="Назва посади"
            />
          </label>
          <label>
            Відділ
            <select
              [(ngModel)]="vm.formDepartmentId"
              name="formDepartmentId"
              (ngModelChange)="vm.onFormDepartmentChange()"
            >
              <option value="">Без відділу</option>
              @for (d of vm.formDepartmentOptions(); track d.id) {
                <option [value]="d.id">{{ d.name }}</option>
              }
            </select>
          </label>
          @if (vm.formDepartmentId) {
            <p class="hint">
              @if (vm.inheritedDirectionLabel()) {
                Напрямок від відділу: {{ vm.inheritedDirectionLabel() }}
              } @else {
                Відділ без напрямку — посада успадковує відсутність напрямку.
              }
            </p>
          } @else {
            <label>
              Напрямок
              <select [(ngModel)]="vm.formDirectionId" name="formDirectionId">
                <option value="">Без напрямку</option>
                @for (dir of vm.formPositionDirectionOptions(); track dir.id) {
                  <option [value]="dir.id">{{ dir.name }}</option>
                }
              </select>
            </label>
          }
          <label>
            Опис
            <textarea
              [(ngModel)]="vm.formDescription"
              name="formDescription"
              rows="2"
              placeholder="Опис посади (необовʼязково)"
            ></textarea>
          </label>
          @if (vm.editingId()) {
            <label class="check">
              <input type="checkbox" [(ngModel)]="vm.formIsActive" name="formIsActive" />
              Увімкнено
            </label>
          }
          <div class="form-actions">
            <button type="button" (click)="vm.savePosition()">
              {{ vm.editingId() ? 'Зберегти посаду' : 'Створити посаду' }}
            </button>
          </div>
        </form>

        <section class="reqs" [class.disabled]="!vm.editingId()">
          <h3>Вимоги до навичок</h3>
          @if (!vm.editingId()) {
            <p class="hint">Спочатку створіть посаду — тоді можна додавати навички.</p>
          }
          @if (vm.canManagePositions()) {
            <form class="inline add-row" (ngSubmit)="vm.addSkillRequirement()">
              <select
                [(ngModel)]="vm.reqSkillId"
                name="reqSkillId"
                [disabled]="!vm.editingId()"
                (ngModelChange)="vm.onReqSkillChange()"
              >
                <option value="">Оберіть навичку</option>
                @for (s of vm.availableSkills(); track s.id) {
                  <option [value]="s.id">{{ s.group?.name || '' }} — {{ s.name }}</option>
                }
              </select>
              <label class="level">
                Ціль
                <input
                  type="number"
                  [(ngModel)]="vm.reqTargetLevel"
                  name="reqTargetLevel"
                  [disabled]="!vm.editingId()"
                />
              </label>
              <label class="check">
                <input
                  type="checkbox"
                  [(ngModel)]="vm.reqRequired"
                  name="reqRequired"
                  [disabled]="!vm.editingId()"
                />
                Обовʼязкова
              </label>
              <button type="submit" [disabled]="!vm.editingId()">Додати</button>
            </form>
          }
          <ul>
            @for (r of vm.skillRequirements(); track r.id) {
              <li>
                <span>
                  <strong>{{ r.skillName || r.skillCode }}</strong>
                  <small>{{ vm.formatNativeTarget(r) }}</small>
                  @if (r.required) {
                    <small class="badge">обовʼязкова</small>
                  }
                </span>
                @if (vm.canManagePositions()) {
                  <span class="row-actions">
                    <button
                      type="button"
                      class="ghost-neutral"
                      (click)="vm.bumpRequirementLevel(r, -1)"
                      [disabled]="!vm.editingId() || r.targetLevel <= (r.skillScaleMin ?? 0)"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      class="ghost-neutral"
                      (click)="vm.bumpRequirementLevel(r, 1)"
                      [disabled]="
                        !vm.editingId() || r.targetLevel >= (r.skillScaleMax ?? r.targetLevel)
                      "
                    >
                      +
                    </button>
                    <button
                      type="button"
                      class="ghost"
                      (click)="vm.removeSkillRequirement(r)"
                      [disabled]="!vm.editingId()"
                    >
                      Прибрати
                    </button>
                  </span>
                }
              </li>
            } @empty {
              <li class="muted-row">Немає вимог до навичок</li>
            }
          </ul>
        </section>
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
        background: color-mix(in srgb, #0f172a 45%, transparent);
        padding: 1rem;
        overflow-y: auto;
      }
      .modal {
        display: grid;
        gap: 0.85rem;
        width: min(40rem, 100%);
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
      h2,
      h3 {
        margin: 0;
        font-size: 1.1rem;
      }
      h3 {
        font-size: 1rem;
      }
      .error {
        margin: 0;
        color: var(--pw-danger);
      }
      .hint {
        margin: 0;
        font-size: 0.85rem;
        color: var(--pw-muted);
      }
      .position-form,
      .reqs {
        display: grid;
        gap: 0.55rem;
      }
      .position-form label,
      .add-row .level {
        display: grid;
        gap: 0.3rem;
        font-size: 0.9rem;
      }
      .position-form label.check,
      .add-row .check {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
      }
      .inline {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      }
      .inline input,
      .inline select {
        flex: 1 1 120px;
        min-width: 0;
      }
      .add-row .level {
        display: flex;
        gap: 0.35rem;
        align-items: center;
        font-size: 0.9rem;
      }
      .add-row .level input {
        width: 4.5rem;
        flex: 0 0 auto;
      }
      .form-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      input,
      select,
      textarea,
      button {
        padding: 0.5rem 0.7rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border-strong);
        box-sizing: border-box;
        font: inherit;
      }
      textarea {
        resize: vertical;
        min-height: 2.5rem;
      }
      button {
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        border: 0;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .ghost {
        background: transparent;
        color: var(--pw-danger);
        border: 1px solid #f3d1d1;
      }
      .ghost-neutral {
        background: transparent;
        color: var(--pw-text);
        border: 1px solid var(--pw-border-strong);
      }
      ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.45rem;
      }
      li {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
        padding: 0.35rem 0;
        border-bottom: 1px solid #eef2f7;
      }
      .row-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        flex-shrink: 0;
        align-items: center;
      }
      small {
        color: var(--pw-muted);
      }
      .badge {
        background: #fef3c7;
        color: #92400e;
        padding: 0.1rem 0.4rem;
        border-radius: 999px;
        margin-left: 0.35rem;
      }
      .muted-row {
        color: var(--pw-muted);
        border: 0;
      }
      .reqs.disabled {
        opacity: 0.72;
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
export class PositionEditDialogComponent {
  readonly vm = inject(PositionManagementFacade);
  readonly headingId = 'position-edit-dialog-title';
  private backdropPress = false;

  onBackdropPointerDown(event: Event): void {
    this.backdropPress = event.target === event.currentTarget;
  }

  onBackdropClick(event: Event): void {
    if (this.backdropPress && event.target === event.currentTarget) {
      this.vm.closePositionDialog();
    }
    this.backdropPress = false;
  }
}
