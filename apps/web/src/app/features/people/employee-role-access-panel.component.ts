import { Component, effect, inject, input, output, signal } from '@angular/core';
import type {
  EmployeeAccessSection,
  EmployeeAccountRoleRef,
  EmployeeProfileCapabilities,
  UpdateEmployeeAccessSettingsRequest,
} from '@loom/contracts-employees';
import {
  ABSENCE_OVERRIDE_UI,
  ABSENCE_TYPE_DETAIL_OVERRIDE_UI,
  COMPUTED_ROLE_LABELS,
  VISIBILITY_OVERRIDE_UI,
  accountRoleLabel,
  fromAbsenceTypeDetailOverride,
  fromVisibilityOverride,
  toAbsenceTypeDetailOverride,
  toVisibilityOverride,
  type AbsenceTypeDetailOverrideUi,
  type VisibilityOverrideUi,
} from '../../shared/organization/labels';
import {
  EmployeeRoleAccessApiService,
} from './employee-role-access-api.service';
import { AccountRolesApiService } from '../settings/access-roles/account-roles-api.service';
import type { AssignableAccountRoleOption } from '@loom/contracts-access-control';
import {
  PwSelectComponent,
  type PwSelectOption,
} from '../../shared/ui/pw-select.component';

@Component({
  selector: 'loom-employee-role-access-panel',
  standalone: true,
  imports: [PwSelectComponent],
  template: `
    <div class="role-access-panel">
      @if (message()) {
        <p class="ok">{{ message() }}</p>
      }
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      @if (caps().canEditAdminAccess) {
        <section class="card" data-help-id="people.admin.roleAccess.role">
          <h3>Роль акаунта</h3>
          <p class="muted hint">
            Визначає права в API та перелік екранів. Керівництво у структурі задається
            посадою, а не роллю акаунта.
          </p>

          @if (rolesError()) {
            <p class="error">{{ rolesError() }}</p>
          }

          <label>
            Роль
            <loom-pw-select
              [value]="accountRoleId"
              [options]="roleSelectOptions()"
              [disabled]="busy() || rolesLoading() || !roles().length"
              placeholder="Не призначено"
              (valueChange)="onAccountRoleSelected($event)"
            />
          </label>

          @if (requestedRole(); as requested) {
            <div class="role-resolution">
              <span class="label">Призначена роль</span>
              <strong>{{ roleRefLabel(requested) }}</strong>
            </div>
          }
          @if (effectiveRole(); as effective) {
            <div class="role-resolution">
              <span class="label">Ефективна роль</span>
              <strong>{{ roleRefLabel(effective) }}</strong>
            </div>
          }

          <div class="role-resolution">
            <span class="label">Керівництво зі структури</span>
            <strong>{{ computedRoleLabel() }}</strong>
            <p class="muted hint">
              Org leadership з активного призначення (scope). Не змінює роль
              акаунта.
            </p>
          </div>
        </section>
      }

      @if (caps().canEditVisibilityOverrides) {
        <section class="card" data-help-id="people.admin.roleAccess.overrides">
          <h3>Індивідуальні права</h3>
          <p class="muted">
            Регулює лише peer-видимість чужих даних. Не скасовує admin-, owner-
            або manager-scope.
          </p>

          <label>
            Чужі анкети
            <loom-pw-select
              [value]="profileOverride"
              [options]="profileOverrideOptions"
              [disabled]="busy()"
              (valueChange)="onProfileOverrideSelected($event)"
            />
          </label>

          <label>
            Чужі відсутності
            <loom-pw-select
              [value]="absencesOverride"
              [options]="absenceOverrideOptions"
              [disabled]="busy()"
              (valueChange)="onAbsencesOverrideSelected($event)"
            />
          </label>

          @if (absencesOverride !== 'deny') {
            <label>
              Деталі (тип / причина)
              <loom-pw-select
                [value]="absenceTypeDetailOverride"
                [options]="absenceTypeDetailOptions"
                [disabled]="busy()"
                (valueChange)="onAbsenceTypeDetailOverrideSelected($event)"
              />
            </label>
          }
        </section>
      }

      @if (caps().canEditAdminAccess || caps().canEditVisibilityOverrides) {
        <button
          type="button"
          class="btn pw-btn"
          data-help-id="people.admin.roleAccess.save"
          (click)="save()"
          [disabled]="busy()"
        >
          Зберегти
        </button>
      }
    </div>
  `,
  styles: [
    `
      .role-access-panel {
        display: grid;
        gap: 1rem;
      }
      .card {
        display: grid;
        gap: 0.75rem;
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        padding: 0.75rem 1rem;
        background: var(--pw-surface);
      }
      h3 {
        margin: 0;
        font-size: 1rem;
      }
      label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.9rem;
      }
      .role-resolution {
        display: grid;
        gap: 0.2rem;
      }
      .role-resolution .label {
        color: var(--pw-muted);
        font-size: 0.85rem;
      }
      .muted {
        color: var(--pw-muted);
        margin: 0;
      }
      .hint {
        font-size: 0.85rem;
      }
      .pw-btn {
        justify-self: start;
      }
      .ok {
        color: var(--pw-success, #1f6b3a);
        margin: 0;
      }
      .error {
        color: var(--pw-danger, #a32d2d);
        margin: 0;
      }
    `,
  ],
})
export class EmployeeRoleAccessPanelComponent {
  private readonly api = inject(EmployeeRoleAccessApiService);
  private readonly accountRolesApi = inject(AccountRolesApiService);

  readonly employeeId = input.required<string>();
  readonly access = input<EmployeeAccessSection | null | undefined>(null);
  readonly caps = input.required<EmployeeProfileCapabilities>();

  readonly changed = output<void>();

  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal('');

  readonly roles = signal<AssignableAccountRoleOption[]>([]);
  readonly rolesLoading = signal(false);
  readonly rolesError = signal('');

  /** '' = no account role assigned. */
  accountRoleId = '';
  profileOverride: VisibilityOverrideUi = 'inherit';
  absencesOverride: VisibilityOverrideUi = 'inherit';
  absenceTypeDetailOverride: AbsenceTypeDetailOverrideUi = 'inherit';

  private baselineAccountRoleId = '';

  readonly profileOverrideOptions = (
    Object.keys(VISIBILITY_OVERRIDE_UI) as VisibilityOverrideUi[]
  ).map((value) => ({ value, label: VISIBILITY_OVERRIDE_UI[value] }));

  readonly absenceOverrideOptions = (
    Object.keys(ABSENCE_OVERRIDE_UI) as VisibilityOverrideUi[]
  ).map((value) => ({ value, label: ABSENCE_OVERRIDE_UI[value] }));

  readonly absenceTypeDetailOptions = (
    Object.keys(
      ABSENCE_TYPE_DETAIL_OVERRIDE_UI,
    ) as AbsenceTypeDetailOverrideUi[]
  ).map((value) => ({
    value,
    label: ABSENCE_TYPE_DETAIL_OVERRIDE_UI[value],
  }));

  constructor() {
    effect(() => {
      const section = this.access();
      if (!section) return;
      const assigned =
        section.accountRoleId ?? section.requestedAccountRole?.id ?? '';
      this.accountRoleId = assigned;
      this.baselineAccountRoleId = assigned;
      this.profileOverride = fromVisibilityOverride(
        section.profileVisibilityOverride,
      );
      this.absencesOverride = fromVisibilityOverride(
        section.absenceVisibilityOverride,
      );
      this.absenceTypeDetailOverride = fromAbsenceTypeDetailOverride(
        section.showAbsenceTypeToPeersOverride,
      );
    });

    effect(() => {
      if (!this.caps().canEditAdminAccess || this.roles().length) return;
      this.loadRoles();
    });
  }

  roleSelectOptions(): PwSelectOption[] {
    return this.roles().map((role) => ({ value: role.id, label: role.name }));
  }

  onAccountRoleSelected(next: string): void {
    this.accountRoleId = next;
  }

  onProfileOverrideSelected(next: string): void {
    this.profileOverride = next as VisibilityOverrideUi;
  }

  onAbsencesOverrideSelected(next: string): void {
    this.absencesOverride = next as VisibilityOverrideUi;
    this.onAbsencesOverrideChange();
  }

  onAbsenceTypeDetailOverrideSelected(next: string): void {
    this.absenceTypeDetailOverride = next as AbsenceTypeDetailOverrideUi;
  }

  requestedRole(): EmployeeAccountRoleRef | null {
    return this.access()?.requestedAccountRole ?? null;
  }

  effectiveRole(): EmployeeAccountRoleRef | null {
    return this.access()?.effectiveAccountRole ?? null;
  }

  roleRefLabel(role: EmployeeAccountRoleRef): string {
    return accountRoleLabel(role.code, role.name);
  }

  computedRoleLabel(): string {
    const role = this.access()?.computedRole ?? 'employee';
    return COMPUTED_ROLE_LABELS[role] ?? role;
  }

  onAbsencesOverrideChange(): void {
    if (this.absencesOverride === 'deny') {
      this.absenceTypeDetailOverride = 'inherit';
    }
  }

  save(): void {
    this.clearFeedback();
    const caps = this.caps();
    const body: UpdateEmployeeAccessSettingsRequest = {};

    // Send the role only when it actually changed — never an empty assignment.
    if (
      caps.canEditAdminAccess &&
      this.accountRoleId &&
      this.accountRoleId !== this.baselineAccountRoleId
    ) {
      body.accountRoleId = this.accountRoleId;
    }
    if (caps.canEditVisibilityOverrides) {
      body.profileVisibilityOverride = toVisibilityOverride(
        this.profileOverride,
      );
      body.absenceVisibilityOverride = toVisibilityOverride(
        this.absencesOverride,
      );
      body.showAbsenceTypeToPeersOverride =
        this.absencesOverride === 'deny'
          ? null
          : toAbsenceTypeDetailOverride(this.absenceTypeDetailOverride);
    }

    this.busy.set(true);
    this.api.updateAccessSettings(this.employeeId(), body).subscribe({
      next: () => {
        this.message.set('Збережено');
        this.busy.set(false);
        this.baselineAccountRoleId = this.accountRoleId;
        this.changed.emit();
      },
      error: (err) => this.fail(err, 'Не вдалося зберегти права доступу'),
    });
  }

  private loadRoles(): void {
    this.rolesLoading.set(true);
    this.rolesError.set('');
    this.accountRolesApi.getAssignableRoles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.rolesLoading.set(false);
      },
      error: () => {
        this.rolesLoading.set(false);
        this.rolesError.set('Не вдалося завантажити перелік ролей');
      },
    });
  }

  private clearFeedback(): void {
    this.message.set('');
    this.error.set('');
  }

  private fail(
    err: { error?: { message?: string | string[] } },
    fallback: string,
  ): void {
    const msg = err?.error?.message;
    this.error.set(Array.isArray(msg) ? msg.join(', ') : msg || fallback);
    this.busy.set(false);
  }
}
