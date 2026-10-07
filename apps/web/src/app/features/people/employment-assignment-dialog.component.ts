import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  inject,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OverlayScrollLockService } from '../../core/overlay/overlay-scroll-lock.service';
import { HelpTriggerComponent } from '../../core/help/help-trigger.component';
import { attachPwDialogHostToBody } from '../../shared/ui/pw-dialog-host';
import {
  PwSelectComponent,
  type PwSelectOption,
} from '../../shared/ui/pw-select.component';
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
  MANAGEMENT_KIND_OPTIONS,
  managementKindUsesDepartments,
  type ManagementKind,
} from '../../shared/organization/labels';
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
  imports: [
    FormsModule,
    MultiSelectListComponent,
    HelpTriggerComponent,
    PwSelectComponent,
  ],
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
          <div class="head-title">
            <h2 [id]="headingId">{{ title }}</h2>
            <loom-help-trigger
              tourId="people.dialog.assignment"
              ariaLabel="Підказка про цю форму"
            />
          </div>
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
              <loom-pw-select
                data-help-id="people.dialog.assignment.direction"
                [value]="form.directionId"
                [options]="directionOptions"
                (valueChange)="onDirectionSelected($event)"
              />
            </label>
            <label>
              Відділ
              <loom-pw-select
                data-help-id="people.dialog.assignment.department"
                [value]="form.departmentId"
                [options]="departmentOptions"
                (valueChange)="onDepartmentSelected($event)"
              />
            </label>
            <label>
              Посада
              <loom-pw-select
                data-help-id="people.dialog.assignment.position"
                [value]="form.positionId"
                [options]="positionOptions"
                (valueChange)="onPositionSelected($event)"
              />
            </label>
            <label>
              Формат роботи
              <loom-pw-select
                [value]="form.workFormat"
                [options]="workFormatOptions"
                (valueChange)="onWorkFormatSelected($event)"
              />
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
              <loom-pw-select
                [value]="form.employmentType"
                [options]="employmentTypeOptions"
                (valueChange)="onEmploymentTypeSelected($event)"
              />
            </label>
            <label>
              Дата початку призначення
              <input
                type="date"
                data-help-id="people.dialog.assignment.dates"
                [(ngModel)]="form.startDate"
                name="assignmentStartDate"
              />
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
            <label class="span-2">
              Керівництво
              <loom-pw-select
                [value]="form.managementKind"
                [options]="managementKindSelectOptions"
                (valueChange)="onManagementKindSelected($event)"
              />
            </label>
            @if (usesManagedDepartments) {
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
            class="btn pw-btn pw-btn--ghost"
            [disabled]="busy"
            (click)="closed.emit()"
          >
            Скасувати
          </button>
          <button
            type="button"
            class="btn pw-btn"
            data-help-id="people.dialog.assignment.save"
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
      :host {
        display: block;
      }
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
        grid-template-rows: auto minmax(0, 1fr) auto;
        width: min(36rem, 100%);
        max-height: calc(100dvh - var(--shell-topbar-h, 0px) - 1.5rem);
        position: relative;
        border-radius: 12px;
        background: var(--pw-surface, #1e293b);
        border: 1px solid var(--pw-border, #334155);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
        /* Shell stays open so loom-pw-select menus (direction/dept/position/…)
           are not clipped by the rounded corners; .body is the only scroller. */
        overflow: visible;
      }
      .head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 1rem 3.4rem 0.85rem 1.15rem;
        border-bottom: 1px solid var(--pw-border);
      }
      .head-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
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
      input {
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
      .btn:disabled {
        opacity: 0.65;
        cursor: default;
      }
    `,
  ],
})
export class EmploymentAssignmentDialogComponent implements OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
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

  readonly managementKindOptions = MANAGEMENT_KIND_OPTIONS;

  get usesManagedDepartments(): boolean {
    return managementKindUsesDepartments(this.form.managementKind);
  }

  // --- loom-pw-select option lists (empty value '' == "—" / null on submit) ---

  get directionOptions(): PwSelectOption[] {
    return [
      { value: '', label: '—' },
      ...(this.catalog?.directions ?? []).map((dir) => ({
        value: dir.id,
        label: dir.name,
      })),
    ];
  }

  get departmentOptions(): PwSelectOption[] {
    return [
      { value: '', label: '—' },
      ...this.departments.map((dept) => ({
        value: dept.id,
        label: dept.label || dept.name,
      })),
    ];
  }

  get positionOptions(): PwSelectOption[] {
    return [
      { value: '', label: '—' },
      ...this.positions.map((pos) => ({
        value: pos.id,
        label: pos.label || pos.name,
      })),
    ];
  }

  get workFormatOptions(): PwSelectOption[] {
    const options: PwSelectOption[] = [{ value: '', label: '—' }];
    if (this.isArchivalWorkFormat) {
      options.push({
        value: this.form.workFormat,
        label: `${this.form.workFormat} (архівне)`,
      });
    }
    options.push(
      ...(this.catalog?.workFormats ?? []).map((item) => ({
        value: item.name,
        label: item.name,
      })),
    );
    return options;
  }

  get employmentTypeOptions(): PwSelectOption[] {
    const options: PwSelectOption[] = [{ value: '', label: '—' }];
    if (this.isArchivalEmploymentType) {
      options.push({
        value: this.form.employmentType,
        label: `${this.form.employmentType} (архівне)`,
      });
    }
    options.push(
      ...(this.catalog?.employmentTypes ?? []).map((item) => ({
        value: item.name,
        label: item.name,
      })),
    );
    return options;
  }

  get managementKindSelectOptions(): PwSelectOption[] {
    return this.managementKindOptions.map((opt) => ({
      value: opt.value,
      label: opt.label,
    }));
  }

  // --- loom-pw-select handlers (assign-then-handler: model is set before any
  // cascade/orphan side-effect runs) ---

  onDirectionSelected(next: string): void {
    this.form.directionId = next;
    this.directionChange.emit();
  }

  onDepartmentSelected(next: string): void {
    this.form.departmentId = next;
    this.departmentChange.emit();
  }

  onPositionSelected(next: string): void {
    this.form.positionId = next;
    this.positionChange.emit();
  }

  onWorkFormatSelected(next: string): void {
    this.form.workFormat = next;
  }

  onEmploymentTypeSelected(next: string): void {
    this.form.employmentType = next;
  }

  onManagementKindSelected(next: string): void {
    this.onManagementKindChange(next as ManagementKind);
  }

  onManagementKindChange(kind: ManagementKind): void {
    this.form.managementKind = kind;
    if (!managementKindUsesDepartments(kind)) {
      this.form.managedDepartmentIds = [];
      return;
    }
    this.form.managedDepartmentIds = defaultManagedDepartmentsOnEnable(
      this.form.managedDepartmentIds,
      this.form.departmentId,
    );
  }

  ngOnInit(): void {
    attachPwDialogHostToBody(this.host);
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
