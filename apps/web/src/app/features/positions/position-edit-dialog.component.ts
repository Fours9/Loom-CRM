import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MultiSelectListComponent,
  type MultiSelectItem,
} from '../../shared/multi-select-list.component';
import { OverlayScrollLockService } from '../../core/overlay/overlay-scroll-lock.service';
import { HelpTriggerComponent } from '../../core/help/help-trigger.component';
import { attachPwDialogHostToBody } from '../../shared/ui/pw-dialog-host';
import { PositionManagementFacade } from './position-management.facade';

@Component({
  selector: 'loom-position-edit-dialog',
  standalone: true,
  imports: [FormsModule, MultiSelectListComponent, HelpTriggerComponent],
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
          <div class="head-title">
            <h2 [id]="headingId">
              {{ heading() }}
            </h2>
            <loom-help-trigger
              tourId="positions.dialog.position"
              ariaLabel="Підказка про цю форму"
            />
          </div>
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
              data-help-id="positions.dialog.position.save"
              (click)="vm.savePosition()"
              [disabled]="vm.saveLocked()"
            >
              {{ vm.editingId() ? 'Зберегти' : 'Створити' }}
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
              data-help-id="positions.dialog.position.name"
              [(ngModel)]="vm.formName"
              name="formName"
              placeholder="Назва посади"
              [disabled]="vm.saveLocked()"
            />
          </label>
          <div class="org-row">
            <label>
              Напрямок
              <select
                data-help-id="positions.dialog.position.direction"
                [(ngModel)]="vm.formDirectionId"
                name="formDirectionId"
                (ngModelChange)="vm.onFormDirectionChange()"
                [disabled]="vm.saveLocked() || !vm.canEditPositionDirection()"
              >
                @if (vm.canCreateGlobalPosition()) {
                  <option [ngValue]="''">Без напрямку</option>
                }
                @for (dir of vm.formPositionDirectionOptions(); track dir.id) {
                  <option [ngValue]="dir.id">{{ dir.name }}</option>
                }
              </select>
            </label>
            <label>
              Відділ
              <select
                data-help-id="positions.dialog.position.department"
                [(ngModel)]="vm.formDepartmentId"
                name="formDepartmentId"
                (ngModelChange)="vm.onFormDepartmentChange()"
                [disabled]="vm.saveLocked()"
              >
                <option [ngValue]="''">Без відділу</option>
                @for (d of vm.formDepartmentOptions(); track d.id) {
                  <option [ngValue]="d.id">{{ d.name }}</option>
                }
              </select>
            </label>
          </div>
          @if (vm.formDirectionId) {
            <p class="hint">Відділи показуються лише для вибраного напрямку.</p>
          }
          @if (!vm.canEditPositionDirection()) {
            <p class="hint">Напрямок закріплений вашою областю керування.</p>
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
          @if (vm.canManagePositions()) {
            <label>
              Керівництво
              <select
                [ngModel]="vm.formManagementKindTemplate"
                name="formManagementKindTemplate"
                [disabled]="vm.saveLocked()"
                (ngModelChange)="vm.onManagementKindTemplateChange($event)"
              >
                @for (opt of vm.managementKindOptions; track opt.value) {
                  <option [ngValue]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </label>
            @if (vm.managementKindUsesDepartments()) {
              <label class="skills-field">
                Керовані відділи
                <app-multi-select-list
                  [items]="vm.managedDepartmentPickerItems()"
                  [selectedIds]="vm.formManagedDepartmentIds"
                  [disabled]="vm.saveLocked()"
                  [showSelectAll]="true"
                  placeholder="Оберіть керовані відділи"
                  (selectedIdsChange)="vm.onManagedDepartmentsChange($event)"
                />
              </label>
            }
            <label class="skills-field">
              Навички
              <app-multi-select-list
                [items]="pickerItems()"
                [selectedIds]="vm.selectedSkillIds()"
                [disabled]="vm.skillsEditingLocked()"
                [searchable]="true"
                placeholder="Оберіть або знайдіть навичку"
                searchPlaceholder="Пошук…"
                (selectedIdsChange)="vm.onSkillPickerChange($event)"
              />
            </label>
          }
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: var(--pw-z-modal, 250);
        display: grid;
        place-items: center;
        background: color-mix(in srgb, #0f172a 45%, transparent);
        padding: calc(var(--shell-topbar-h, 0px) + 0.75rem) 1rem 0.75rem;
      }
      .modal {
        display: grid;
        gap: 0.85rem;
        width: min(40rem, 100%);
        margin: 0.35rem auto 0;
        position: relative;
        padding: 3.25rem 1.2rem 1.1rem;
        border-radius: 12px;
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
        overflow: visible;
      }
      .head {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
      }
      .head-title {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        min-width: 0;
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
      .hint {
        margin: 0;
        font-size: 0.85rem;
        color: var(--pw-muted);
      }
      .position-form {
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
      .skills-field {
        margin-top: 0.55rem;
        gap: 0.65rem;
        --ms-trigger-height: 4.75rem;
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
        position: absolute;
        top: 0.55rem;
        right: 0.7rem;
        z-index: 1;
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
export class PositionEditDialogComponent implements OnInit, OnDestroy {
  readonly vm = inject(PositionManagementFacade);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly scrollLock = inject(OverlayScrollLockService);
  readonly headingId = 'position-edit-dialog-title';
  private backdropPress = false;

  ngOnInit(): void {
    attachPwDialogHostToBody(this.host);
    this.scrollLock.acquire();
  }

  ngOnDestroy(): void {
    this.scrollLock.release();
  }

  heading(): string {
    if (this.vm.dialogMode() === 'create' || this.vm.dialogMode() === 'creating-position') {
      return 'Нова посада';
    }
    if (this.vm.dialogMode() === 'unresolved-create') {
      return 'Створення не підтверджено';
    }
    return 'Редагувати посаду';
  }

  pickerItems(): MultiSelectItem[] {
    return this.vm.pickerSkillOptions().map((s) => ({ id: s.id, label: s.name }));
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
