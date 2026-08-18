import { Component, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PositionManagementFacade } from './position-management.facade';
import type { RequirementRowVm } from './position-dialog.models';

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
            {{ heading() }}
          </h2>
          <div class="head-actions">
            @if (vm.editingId()) {
              <label class="check toggle-active">
                <input
                  type="checkbox"
                  [(ngModel)]="vm.formIsActive"
                  name="formIsActive"
                  [disabled]="vm.saveLocked()"
                />
                Увімкнено
              </label>
            }
            <button
              type="button"
              (click)="vm.savePosition()"
              [disabled]="vm.saveLocked()"
            >
              {{ vm.editingId() ? 'Зберегти' : 'Створити' }}
            </button>
            <button
              type="button"
              class="icon-close"
              aria-label="Закрити"
              title="Закрити"
              (click)="vm.requestClose()"
              [disabled]="vm.closeLocked()"
            >
              ×
            </button>
          </div>
        </div>

        @if (vm.error()) {
          <p class="error">{{ vm.error() }}</p>
        }
        @if (vm.dialogMode() === 'unresolved-create') {
          <p class="error">
            Не вдалося підтвердити результат створення. Перед повторним створенням
            перевірте список посад.
          </p>
        }
        @if (vm.dialogMode() === 'applying-drafts') {
          <p class="hint">Додаємо вимоги до навичок…</p>
        }
        @if (vm.dialogMode() === 'edit-with-failed-drafts') {
          <p class="hint">
            Посаду створено. Деякі вимоги не додано.
            <button
              type="button"
              class="ghost-neutral"
              (click)="vm.retryFailedDrafts()"
              [disabled]="vm.saveLocked()"
            >
              Повторити невдалі
            </button>
          </p>
        }

        <form class="position-form" novalidate (submit)="$event.preventDefault(); vm.savePosition()">
          <label>
            Назва
            <input
              [(ngModel)]="vm.formName"
              name="formName"
              placeholder="Назва посади"
              [disabled]="vm.saveLocked()"
            />
          </label>
          <div class="org-row">
            <label>
              Відділ
              <select
                [(ngModel)]="vm.formDepartmentId"
                name="formDepartmentId"
                (ngModelChange)="vm.onFormDepartmentChange()"
                [disabled]="vm.saveLocked()"
              >
                <option [ngValue]="''">Без відділу</option>
                @for (d of vm.formDepartmentOptions(); track d.id) {
                  <option [value]="d.id">{{ d.name }}</option>
                }
              </select>
            </label>
            <label>
              Напрямок
              <select
                [(ngModel)]="vm.formDirectionId"
                name="formDirectionId"
                [disabled]="!!vm.formDepartmentId || vm.saveLocked()"
              >
                <option value="">Без напрямку</option>
                @for (dir of vm.formPositionDirectionOptions(); track dir.id) {
                  <option [value]="dir.id">{{ dir.name }}</option>
                }
              </select>
            </label>
          </div>
          @if (vm.formDepartmentId) {
            <p class="hint">Напрямок успадковується від вибраного відділу.</p>
          }
          <label>
            Опис
            <textarea
              [(ngModel)]="vm.formDescription"
              name="formDescription"
              rows="2"
              placeholder="Опис посади (необовʼязково)"
              [disabled]="vm.saveLocked()"
            ></textarea>
          </label>
        </form>

        <section class="reqs" [class.disabled]="vm.skillsEditingLocked()">
          <h3>Вимоги до навичок</h3>
          <p class="hint">
            {{ vm.requirementRows().length }} / {{ vm.maxPositionSkills }}
          </p>
          @if (vm.canManagePositions()) {
            <div class="picker">
              <button
                type="button"
                class="ghost-neutral"
                (click)="vm.togglePicker()"
                [disabled]="vm.skillsEditingLocked() || vm.skillsQuotaReached()"
              >
                {{ vm.pickerOpen() ? 'Сховати список' : 'Додати навички' }}
              </button>
              @if (vm.pickerOpen()) {
                <div class="picker-list">
                  @for (s of vm.pickerCandidateSkills(); track s.id) {
                    <label class="check">
                      <input
                        type="checkbox"
                        [checked]="vm.isPickerSelected(s.id)"
                        (change)="vm.togglePickerSkill(s.id)"
                      />
                      {{ s.group?.name || '' }} — {{ s.name }}
                    </label>
                  } @empty {
                    <p class="hint">Немає доступних навичок</p>
                  }
                  <button
                    type="button"
                    (click)="vm.confirmPickerSkills()"
                    [disabled]="vm.pickerSelectedIds().length === 0"
                  >
                    Додати вибрані
                  </button>
                </div>
              }
            </div>
          }
          <ul>
            @for (r of vm.requirementRows(); track rowTrack(r)) {
              <li [class.failed]="r.kind === 'draft' && r.state === 'failed'">
                <span>
                  <strong>{{ r.skillName || r.skillCode }}</strong>
                  <small>{{ vm.formatNativeTarget(r) }}</small>
                  @if (r.required) {
                    <small class="badge">обовʼязкова</small>
                  }
                  @if (r.kind === 'draft') {
                    <small class="badge draft">{{ vm.rowStateLabel(r) }}</small>
                  }
                  @if (r.kind === 'draft' && r.error) {
                    <small class="error-inline">{{ r.error }}</small>
                  }
                </span>
                @if (vm.canManagePositions()) {
                  <span class="row-actions">
                    <button
                      type="button"
                      class="ghost-neutral"
                      (click)="vm.bumpRequirementLevel(r, -1)"
                      [disabled]="
                        vm.skillsEditingLocked() ||
                        r.targetLevel <= (r.skillScaleMin ?? 0)
                      "
                    >
                      −
                    </button>
                    <button
                      type="button"
                      class="ghost-neutral"
                      (click)="vm.bumpRequirementLevel(r, 1)"
                      [disabled]="
                        vm.skillsEditingLocked() ||
                        r.targetLevel >= (r.skillScaleMax ?? r.targetLevel)
                      "
                    >
                      +
                    </button>
                    <label class="check">
                      <input
                        type="checkbox"
                        [checked]="r.required"
                        [disabled]="vm.skillsEditingLocked()"
                        (change)="
                          vm.changeRequired(r, $any($event.target).checked)
                        "
                      />
                      Обовʼязкова
                    </label>
                    <button
                      type="button"
                      class="ghost"
                      (click)="vm.removeRequirement(r)"
                      [disabled]="vm.skillsEditingLocked()"
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
        align-items: start;
        background: color-mix(in srgb, #0f172a 45%, transparent);
        padding: calc(var(--shell-topbar-h, 0px) + 1rem) 1rem 0.75rem;
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
      .error-inline {
        display: block;
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
      .org-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
      }
      .position-form label {
        display: grid;
        gap: 0.3rem;
        font-size: 0.9rem;
      }
      .position-form label.check,
      .check {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
      }
      .picker {
        display: grid;
        gap: 0.45rem;
      }
      .picker-list {
        display: grid;
        gap: 0.35rem;
        padding: 0.6rem;
        border: 1px solid var(--pw-border);
        border-radius: 8px;
        max-height: 14rem;
        overflow: auto;
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
      li.failed {
        background: color-mix(in srgb, var(--pw-danger) 8%, transparent);
        margin: 0 -0.35rem;
        padding-left: 0.35rem;
        padding-right: 0.35rem;
        border-radius: 8px;
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
      .badge.draft {
        background: #e0e7ff;
        color: #3730a3;
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
      @media (max-width: 720px) {
        .head {
          align-items: start;
        }
        .org-row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class PositionEditDialogComponent {
  readonly vm = inject(PositionManagementFacade);
  readonly headingId = 'position-edit-dialog-title';
  private backdropPress = false;

  heading(): string {
    if (this.vm.dialogMode() === 'create' || this.vm.dialogMode() === 'creating-position') {
      return 'Нова посада';
    }
    if (this.vm.dialogMode() === 'unresolved-create') {
      return 'Створення не підтверджено';
    }
    return 'Редагувати посаду';
  }

  rowTrack(row: RequirementRowVm): string {
    return row.kind === 'draft' ? row.clientId : row.id;
  }

  onBackdropPointerDown(event: Event): void {
    this.backdropPress = event.target === event.currentTarget;
  }

  onBackdropClick(event: Event): void {
    if (this.backdropPress && event.target === event.currentTarget) {
      this.vm.requestClose();
    }
    this.backdropPress = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.vm.requestClose();
  }
}
