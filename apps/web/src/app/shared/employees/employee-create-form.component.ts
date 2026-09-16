import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  resolveEmployeeNumberPrefixFromAccountRole,
  type AssignableAccountRoleOption,
} from '@loom/contracts-access-control';
import { ScheduleEditorComponent } from '../schedule/public-api';
import { PasswordVisibilityToggleComponent } from '../password-visibility-toggle.component';
import {
  generateTemporaryPassword,
  type EmployeeCreateDraft,
} from './employee-create-draft';
import {
  reduceEmploymentOrgFilter,
  filterDepartmentsForSelection,
  filterPositionsForSelection,
  type EmploymentOrgFilterState,
} from '../organization/employment-org-filter.policy';
import {
  ACCOUNT_ROLE_LABELS,
  type AccountRoleCode,
  type ManagementKind,
} from '../organization/labels';
import type {
  OrganizationCatalogDepartment,
  OrganizationCatalogDirection,
  OrganizationCatalogPosition,
} from '../../core/api/organization-catalog-api.service';

@Component({
  selector: 'loom-employee-create-form',
  standalone: true,
  imports: [
    FormsModule,
    ScheduleEditorComponent,
    PasswordVisibilityToggleComponent,
  ],
  template: `
    <div class="layout">
      <form id="create-employee" class="card" (ngSubmit)="submitted.emit()">
        <div class="section-block section-static">
          <h3>Загальна інформація</h3>
          <div class="row row-3">
            <label
              >Прізвище
              <input [(ngModel)]="draft.lastName" name="lastName" required
            /></label>
            <label
              >Ім'я
              <input [(ngModel)]="draft.firstName" name="firstName" required
            /></label>
            <label
              >По батькові
              <input [(ngModel)]="draft.middleName" name="middleName"
            /></label>
          </div>
          <div class="row row-1">
            <label class="color-field">
              Колір календаря
              <div class="color-edit">
                <input
                  type="color"
                  [(ngModel)]="draft.calendarColor"
                  name="calendarColorPicker"
                />
                <input
                  type="text"
                  [(ngModel)]="draft.calendarColor"
                  name="calendarColorText"
                  placeholder="#2A6FDB"
                  maxlength="7"
                />
              </div>
            </label>
          </div>
          @if (canAssignAccountRole) {
            <div class="row row-1">
              <label>
                Роль
                <select
                  [(ngModel)]="draft.accountRoleId"
                  name="accountRoleId"
                >
                  <option value="">{{ autoAccountRoleLabel }}</option>
                  @for (role of accountRoles; track role.id) {
                    <option [value]="role.id">
                      {{ roleOptionLabel(role) }}
                    </option>
                  }
                </select>
              </label>
            </div>
            @if (!canCreateAccountAtCreate) {
              <p class="muted hint">
                Акаунт не буде створено. Вибрана роль використовується лише для
                префікса номера працівника.
              </p>
            }
          }

          @if (canCreateAccountAtCreate) {
            @if (!canAssignAccountRole) {
              <p class="muted hint">
                Роль акаунта буде визначена за посадою (Працівник / Менеджер).
              </p>
            }
            <div class="row row-1">
              <label class="toggle-field">
                <span>Створити обліковий запис</span>
                <input
                  type="checkbox"
                  [(ngModel)]="draft.createAccount"
                  name="createAccount"
                  (ngModelChange)="onCreateAccountChange()"
                />
              </label>
            </div>
            @if (draft.createAccount) {
              <div class="row row-1">
                <label>
                  Email для входу
                  <input
                    type="email"
                    [(ngModel)]="draft.email"
                    name="email"
                    required
                    maxlength="254"
                    autocomplete="username"
                  />
                </label>
              </div>
              <div class="row row-1">
                <label>
                  Тимчасовий пароль
                  <div class="password-row">
                    <input
                      [type]="showTemporaryPassword ? 'text' : 'password'"
                      [(ngModel)]="draft.temporaryPassword"
                      name="temporaryPassword"
                      required
                      minlength="8"
                      autocomplete="new-password"
                    />
                    <app-password-visibility-toggle
                      [visible]="showTemporaryPassword"
                      showLabel="Показати"
                      hideLabel="Сховати"
                      (toggled)="showTemporaryPassword = !showTemporaryPassword"
                    />
                    <button
                      type="button"
                      class="ghost"
                      (click)="fillGeneratedPassword()"
                    >
                      Згенерувати
                    </button>
                  </div>
                </label>
              </div>
            }
          }
        </div>

        <details class="section-block disclose" open>
          <summary>Контакти</summary>
          <div class="disclose-body">
            <div class="row row-1">
              <label>
                Робочий email
                <input
                  type="email"
                  [(ngModel)]="draft.workEmail"
                  name="workEmail"
                  maxlength="254"
                />
              </label>
            </div>
            <div class="row row-2">
              <label
                >Телефон
                <input
                  type="tel"
                  [(ngModel)]="draft.phoneNumber"
                  name="phoneNumber"
                  maxlength="64"
              /></label>
              <label
                >Telegram
                <input
                  [(ngModel)]="draft.telegram"
                  name="telegram"
                  placeholder="@username"
                  maxlength="128"
              /></label>
            </div>

            @if (canEditPersonal) {
              <details class="nested-panel" open>
                <summary>Особисті контакти</summary>
                <div class="nested-panel-body">
                  <div class="row row-1">
                    <label>
                      Email
                      <input
                        type="email"
                        [(ngModel)]="draft.personalEmail"
                        name="personalEmail"
                        maxlength="254"
                      />
                    </label>
                  </div>
                  <div class="row row-2">
                    <label>
                      Телефон
                      <input
                        type="tel"
                        [(ngModel)]="draft.personalPhoneNumber"
                        name="personalPhoneNumber"
                        maxlength="64"
                      />
                    </label>
                    <label>
                      Telegram
                      <input
                        [(ngModel)]="draft.personalTelegram"
                        name="personalTelegram"
                        placeholder="@username"
                        maxlength="128"
                      />
                    </label>
                  </div>
                </div>
              </details>
            }
          </div>
        </details>

        <details class="section-block disclose" open>
          <summary>Посада</summary>
          <div class="disclose-body">
            <div class="row row-1">
              <label>
                Напрямок
                <select
                  [(ngModel)]="draft.directionId"
                  name="directionId"
                  (ngModelChange)="onDirectionChange()"
                >
                  <option value="">Не вказано</option>
                  @for (d of directions; track d.id) {
                    <option [value]="d.id">{{ d.name }}</option>
                  }
                </select>
              </label>
            </div>
            <div class="row row-2">
              <label>
                Відділ
                <select
                  [(ngModel)]="draft.departmentId"
                  name="departmentId"
                  (ngModelChange)="onDepartmentChange()"
                >
                  <option value="">Не вказано</option>
                  @for (d of filteredDepartments; track d.id) {
                    <option [value]="d.id">{{ d.name }}</option>
                  }
                </select>
              </label>
              <label>
                Посада
                <select
                  [(ngModel)]="draft.positionId"
                  name="positionId"
                  (ngModelChange)="onPositionChange()"
                >
                  <option value="">Не вказано</option>
                  @for (p of filteredPositions; track p.id) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                </select>
              </label>
            </div>
          </div>
        </details>
      </form>

      <aside class="card schedule-card">
        <h2>Робочий графік</h2>
        <app-schedule-editor [days]="draft.schedule" namePrefix="create_" />
      </aside>
    </div>
  `,
  styles: [
    `
      .layout {
        display: grid;
        gap: 1rem;
        grid-template-columns: 1fr;
        align-items: stretch;
        width: 100%;
      }
      @media (min-width: 900px) {
        .layout {
          grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
        }
      }
      .card {
        background: var(--pw-surface, #fff);
        border: 1px solid var(--pw-border, #ddd);
        border-radius: 12px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-width: 0;
        height: 100%;
      }
      .schedule-card h2 {
        margin: 0 0 0.35rem;
        font-size: 1.1rem;
        color: var(--pw-accent, #2a6fdb);
      }
      .section-block {
        margin: 0;
        padding-top: 0.95rem;
        border-top: 1px solid
          color-mix(in srgb, var(--pw-muted, #888) 55%, transparent);
        display: grid;
        gap: 0.75rem;
      }
      .section-static {
        padding-top: 0;
        border-top: 0;
      }
      .section-block h3 {
        margin: 0;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--pw-accent, #2a6fdb);
      }
      .disclose > summary {
        list-style: none;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--pw-accent, #2a6fdb);
      }
      .disclose > summary::-webkit-details-marker {
        display: none;
      }
      .disclose-body,
      .nested-panel-body {
        display: grid;
        gap: 0.75rem;
        margin-top: 0.75rem;
      }
      .nested-panel {
        border: 1px solid var(--pw-border, #ddd);
        border-radius: 8px;
        padding: 0.65rem 0.75rem;
      }
      .row {
        display: grid;
        gap: 0.75rem;
      }
      .row-1 {
        grid-template-columns: 1fr;
      }
      .row-2 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .row-3 {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      @media (max-width: 700px) {
        .row-2,
        .row-3 {
          grid-template-columns: 1fr;
        }
      }
      .row > label {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        min-width: 0;
      }
      .row > label.toggle-field {
        flex-direction: row;
        align-items: center;
        gap: 0.65rem;
        cursor: pointer;
        user-select: none;
        min-height: 2.4rem;
        width: fit-content;
      }
      .row > label.toggle-field input[type='checkbox'] {
        width: 1.15rem;
        height: 1.15rem;
        margin: 0;
        padding: 0;
        border: 0;
        border-radius: 0;
        accent-color: var(--pw-accent, #2a6fdb);
        cursor: pointer;
        flex-shrink: 0;
      }
      .row > label.toggle-field span {
        font-weight: 500;
        line-height: 1.3;
      }
      .password-row {
        display: flex;
        gap: 0.5rem;
        align-items: stretch;
      }
      .password-row input {
        flex: 1;
        min-width: 0;
      }
      input,
      select,
      button {
        width: 100%;
        box-sizing: border-box;
        padding: 0.55rem 0.7rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border-strong, #ccc);
      }
      input[type='color'] {
        width: 3rem;
        height: 2.4rem;
        padding: 0.2rem;
      }
      .color-edit {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }
      .color-edit input[type='text'] {
        width: 7.5rem;
      }
      .ghost {
        width: auto;
        background: transparent;
        color: var(--pw-accent, #2a6fdb);
        border: 0;
        cursor: pointer;
        white-space: nowrap;
      }
      .value {
        padding: 0.55rem 0;
        color: var(--pw-muted, #666);
      }
      .muted.hint {
        margin: 0;
        font-size: 0.9rem;
        color: var(--pw-muted, #666);
        line-height: 1.4;
      }
    `,
  ],
})
export class EmployeeCreateFormComponent {
  @Input({ required: true }) draft!: EmployeeCreateDraft;
  @Input() directions: OrganizationCatalogDirection[] = [];
  @Input() departments: OrganizationCatalogDepartment[] = [];
  @Input() positions: OrganizationCatalogPosition[] = [];
  @Input() accountRoles: AssignableAccountRoleOption[] = [];
  @Input() canCreateAccountAtCreate = false;
  @Input() canAssignAccountRole = false;
  @Input() canEditPersonal = false;
  @Output() readonly submitted = new EventEmitter<void>();

  showTemporaryPassword = false;

  private get orgState(): EmploymentOrgFilterState {
    return {
      directionId: this.draft.directionId || null,
      departmentId: this.draft.departmentId || null,
      positionId: this.draft.positionId || null,
    };
  }

  private get catalogs() {
    return {
      directions: this.directions,
      departments: this.departments,
      positions: this.positions,
    };
  }

  get filteredDepartments(): OrganizationCatalogDepartment[] {
    return filterDepartmentsForSelection(this.orgState, this.departments);
  }

  get filteredPositions(): OrganizationCatalogPosition[] {
    return filterPositionsForSelection(this.orgState, this.positions);
  }

  get selectedPosition(): OrganizationCatalogPosition | undefined {
    if (!this.draft.positionId) return undefined;
    return this.positions.find((p) => p.id === this.draft.positionId);
  }

  get selectedManagementKind(): ManagementKind {
    return this.draft.managementKind;
  }

  get autoAccountRoleLabel(): string {
    const autoCode: AccountRoleCode =
      this.selectedManagementKind === 'none'
        ? 'employee'
        : 'department_manager';
    const prefix = this.selectedManagementKind === 'none' ? 'E' : 'M';
    return `Автоматично за посадою → ${ACCOUNT_ROLE_LABELS[autoCode]} (номер ${prefix}-…)`;
  }

  roleOptionLabel(role: AssignableAccountRoleOption): string {
    const prefix = resolveEmployeeNumberPrefixFromAccountRole({
      code: role.code,
      isAdminEquivalent: role.isAdminEquivalent,
    });
    return prefix ? `${role.name} (номер ${prefix}-…)` : role.name;
  }

  onCreateAccountChange(): void {
    if (!this.draft.createAccount) {
      this.draft.email = '';
      this.draft.temporaryPassword = '';
      this.showTemporaryPassword = false;
      // Keep accountRoleId — drives employee-number prefix without User.
    }
  }

  fillGeneratedPassword(): void {
    this.draft.temporaryPassword = generateTemporaryPassword();
    this.showTemporaryPassword = true;
  }

  onDirectionChange(): void {
    this.applyOrgAction({
      type: 'selectDirection',
      directionId: this.draft.directionId || null,
    });
  }

  onDepartmentChange(): void {
    this.applyOrgAction({
      type: 'selectDepartment',
      departmentId: this.draft.departmentId || null,
    });
  }

  onPositionChange(): void {
    this.applyOrgAction({
      type: 'selectPosition',
      positionId: this.draft.positionId || null,
    });
  }

  private syncManagementKindFromPosition(): void {
    const position = this.selectedPosition;
    this.draft.managementKind = position?.managementKindTemplate ?? 'none';
  }

  private applyOrgAction(
    action: Parameters<typeof reduceEmploymentOrgFilter>[1],
  ): void {
    const prevPositionId = this.draft.positionId;
    const next = reduceEmploymentOrgFilter(
      this.orgState,
      action,
      this.catalogs,
    );
    this.draft.directionId = next.directionId ?? '';
    this.draft.departmentId = next.departmentId ?? '';
    this.draft.positionId = next.positionId ?? '';
    if (
      action.type === 'selectPosition' ||
      (next.positionId ?? '') !== prevPositionId
    ) {
      this.syncManagementKindFromPosition();
    }
  }
}
