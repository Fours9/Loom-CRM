import {
  Component,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  inject,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OverlayScrollLockService } from '../../core/overlay/overlay-scroll-lock.service';
import type {
  OrganizationCatalogDepartment,
  OrganizationCatalogPosition,
  OrganizationCatalogSnapshot,
} from '../../core/api/organization-catalog-api.service';
import {
  MultiSelectListComponent,
  type MultiSelectItem,
} from '../../shared/multi-select-list.component';
import {
  assignmentDialogSubmitLabel,
  assignmentDialogTitle,
  defaultManagedDepartmentsOnEnable,
  isArchivalNamedValue,
  type EmploymentAssignmentDialogState,
  type EmploymentAssignmentForm,
} from './employment-assignment-dialog.model';

@Component({
  selector: 'loom-employment-assignment-dialog',
  standalone: true,
  imports: [FormsModule, MultiSelectListComponent],
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
          <h2 [id]="headingId">{{ title }}</h2>
          <button
            type="button"
            class="icon-close"
            aria-label="Закрити"
            title="Закрити"
            (click)="closed.emit()"
          >
            ×
          </button>
        </div>

        <div class="body">
          @if (error) {
            <p class="error">{{ error }}</p>
          }
          <div class="fields">
            <label>
              Напрямок
              <select
                [(ngModel)]="form.directionId"
                name="assignmentDirection"
                (ngModelChange)="directionChange.emit()"
              >
                <option value="">—</option>
                @for (dir of catalog?.directions ?? []; track dir.id) {
                  <option [value]="dir.id">{{ dir.name }}</option>
                }
              </select>
            </label>
            <label>
              Відділ
              <select
                [(ngModel)]="form.departmentId"
                name="assignmentDepartment"
                (ngModelChange)="departmentChange.emit()"
              >
                <option value="">—</option>
                @for (dept of departments; track dept.id) {
                  <option [value]="dept.id">{{ dept.label || dept.name }}</option>
                }
              </select>
            </label>
            <label>
              Посада
              <select
                [(ngModel)]="form.positionId"
                name="assignmentPosition"
                (ngModelChange)="positionChange.emit()"
              >
                <option value="">—</option>
                @for (pos of positions; track pos.id) {
                  <option [value]="pos.id">{{ pos.label || pos.name }}</option>
                }
              </select>
            </label>
            <label>
              Формат роботи
              <select [(ngModel)]="form.workFormat" name="assignmentWorkFormat">
                <option value="">—</option>
                @if (isArchivalWorkFormat) {
                  <option [value]="form.workFormat">
                    {{ form.workFormat }} (архівне)
                  </option>
                }
                @for (item of catalog?.workFormats ?? []; track item.id) {
                  <option [value]="item.name">{{ item.name }}</option>
                }
              </select>
            </label>
            <label>
              Локація
              <input
                [(ngModel)]="form.workLocation"
                name="assignmentWorkLocation"
                (ngModelChange)="workLocationChange.emit($event)"
              />
            </label>
            <label>
              Тип зайнятості
              <select [(ngModel)]="form.employmentType" name="assignmentEmploymentType">
                <option value="">—</option>
                @if (isArchivalEmploymentType) {
                  <option [value]="form.employmentType">
                    {{ form.employmentType }} (архівне)
                  </option>
                }
                @for (item of catalog?.employmentTypes ?? []; track item.id) {
                  <option [value]="item.name">{{ item.name }}</option>
                }
              </select>
            </label>
            <label>
              Дата початку призначення
              <input type="date" [(ngModel)]="form.startDate" name="assignmentStartDate" />
            </label>
            @if (state.kind === 'edit') {
              <label>
                Дата кінця призначення
                <input type="date" [(ngModel)]="form.endDate" name="assignmentEndDate" />
              </label>
            }
            <label>
              Початок випроб.
              <input
                type="date"
                [(ngModel)]="form.probationStartDate"
                name="assignmentProbationStart"
              />
            </label>
            <label>
              Кінець випроб.
              <input
                type="date"
                [(ngModel)]="form.probationEndDate"
                name="assignmentProbationEnd"
              />
            </label>
            <label class="span-2">
              Коментар
              <input [(ngModel)]="form.comment" name="assignmentComment" />
            </label>
            <label class="check span-2">
              <input
                type="checkbox"
                [ngModel]="form.isDepartmentManager"
                name="assignmentIsDepartmentManager"
                (ngModelChange)="onManagerToggle($event)"
              />
              Менеджерує відділ
            </label>
            @if (form.isDepartmentManager) {
              <label class="span-2 managed-field">
                Керовані відділи
                <app-multi-select-list
                  [items]="departmentItems"
                  [selectedIds]="form.managedDepartmentIds"
                  [showSelectAll]="true"
                  placeholder="Оберіть керовані відділи"
                  (selectedIdsChange)="form.managedDepartmentIds = $event"
                />
              </label>
            }
          </div>
        </div>

        <div class="foot">
          <button
            type="button"
            class="btn"
            [disabled]="busy"
            (click)="submitted.emit()"
          >
            {{ submitLabel }}
          </button>
        </div>
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
        padding: calc(var(--shell-topbar-h, 0px) + 0.75rem) 1rem 0.75rem;
      }
      .modal {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        width: min(36rem, 100%);
        max-height: calc(100dvh - var(--shell-topbar-h, 0px) - 1.5rem);
        position: relative;
        border-radius: 12px;
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
        overflow: hidden;
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 1rem 3.4rem 0.85rem 1.15rem;
        border-bottom: 1px solid var(--pw-border);
      }
      h2 {
        margin: 0;
        font-size: 1.1rem;
      }
      .icon-close {
        position: absolute;
        top: 0.7rem;
        right: 0.75rem;
        display: inline-grid;
        place-items: center;
        width: 2.25rem;
        height: 2.25rem;
        padding: 0;
        font-size: 1.35rem;
        line-height: 1;
        background: transparent;
        color: var(--pw-text);
        border: 1px solid var(--pw-border-strong);
        border-radius: 8px;
        cursor: pointer;
      }
      .body {
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 1rem 1.15rem;
      }
      .error {
        margin: 0 0 0.75rem;
        color: var(--pw-danger, #a32d2d);
      }
      .fields {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: minmax(0, 1fr);
      }
      @media (min-width: 641px) {
        .fields {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .span-2 {
          grid-column: 1 / -1;
        }
      }
      label {
        display: grid;
        gap: 0.25rem;
        font-size: 0.9rem;
        color: var(--pw-muted);
      }
      label.check {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
        color: var(--pw-text);
      }
      label.check input[type='checkbox'] {
        width: 1rem;
        height: 1rem;
        margin: 0;
        padding: 0;
        flex: 0 0 auto;
      }
      .managed-field {
        --ms-trigger-height: 4.75rem;
      }
      input,
      select {
        border: 1px solid var(--pw-border);
        border-radius: 8px;
        padding: 0.5rem 0.65rem;
        min-height: 2.5rem;
        background: var(--pw-surface);
        color: inherit;
        font: inherit;
        width: 100%;
        box-sizing: border-box;
      }
      .foot {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        padding: 0.85rem 1.15rem 1rem;
        border-top: 1px solid var(--pw-border);
      }
      .btn {
        border: 0;
        background: var(--pw-accent);
        color: #fff;
        border-radius: 8px;
        padding: 0.45rem 0.9rem;
        min-height: 2.4rem;
        font: inherit;
        cursor: pointer;
      }
      .btn:disabled {
        opacity: 0.65;
        cursor: default;
      }
    `,
  ],
})
export class EmploymentAssignmentDialogComponent implements OnInit, OnDestroy {
  private readonly scrollLock = inject(OverlayScrollLockService);
  private backdropPress = false;

  readonly headingId = 'employment-assignment-dialog-title';

  @Input({ required: true }) state!: Exclude<
    EmploymentAssignmentDialogState,
    { kind: 'closed' }
  >;
  @Input({ required: true }) form!: EmploymentAssignmentForm;
  @Input() catalog: OrganizationCatalogSnapshot | null = null;
  @Input() departments: Array<
    OrganizationCatalogDepartment & { archived?: boolean; label?: string }
  > = [];
  @Input() positions: Array<
    OrganizationCatalogPosition & { archived?: boolean; label?: string }
  > = [];
  @Input() busy = false;
  @Input() error: string | null = null;

  readonly closed = output<void>();
  readonly submitted = output<void>();
  readonly directionChange = output<void>();
  readonly departmentChange = output<void>();
  readonly positionChange = output<void>();
  readonly workLocationChange = output<string>();

  get title(): string {
    return assignmentDialogTitle(this.state);
  }

  get submitLabel(): string {
    return assignmentDialogSubmitLabel(this.state);
  }

  get departmentItems(): MultiSelectItem[] {
    return (this.catalog?.departments ?? []).map((d) => ({
      id: d.id,
      label: d.name,
    }));
  }

  get isArchivalWorkFormat(): boolean {
    return isArchivalNamedValue(
      this.form.workFormat,
      (this.catalog?.workFormats ?? []).map((item) => item.name),
    );
  }

  get isArchivalEmploymentType(): boolean {
    return isArchivalNamedValue(
      this.form.employmentType,
      (this.catalog?.employmentTypes ?? []).map((item) => item.name),
    );
  }

  onManagerToggle(enabled: boolean): void {
    this.form.isDepartmentManager = enabled;
    if (!enabled) {
      this.form.managedDepartmentIds = [];
      return;
    }
    this.form.managedDepartmentIds = defaultManagedDepartmentsOnEnable(
      this.form.managedDepartmentIds,
      this.form.departmentId,
    );
  }

  ngOnInit(): void {
    this.scrollLock.acquire();
  }

  ngOnDestroy(): void {
    this.scrollLock.release();
  }

  onBackdropPointerDown(event: Event): void {
    this.backdropPress = event.target === event.currentTarget;
  }

  onBackdropClick(event: Event): void {
    if (this.backdropPress && event.target === event.currentTarget) {
      this.closed.emit();
    }
    this.backdropPress = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }
}
