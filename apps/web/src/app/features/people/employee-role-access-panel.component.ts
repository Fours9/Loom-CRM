import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  EmployeeAccessSection,
  EmployeeProfileCapabilities,
  UpdateEmployeeAccessSettingsRequest,
} from '@loom/contracts-employees';
import {
  ABSENCE_OVERRIDE_UI,
  ABSENCE_TYPE_DETAIL_OVERRIDE_UI,
  COMPUTED_ROLE_LABELS,
  VISIBILITY_OVERRIDE_UI,
  fromAbsenceTypeDetailOverride,
  fromVisibilityOverride,
  toAbsenceTypeDetailOverride,
  toVisibilityOverride,
  type AbsenceTypeDetailOverrideUi,
  type VisibilityOverrideUi,
} from '../../shared/organization/labels';
import { EmployeeRoleAccessApiService } from './employee-role-access-api.service';

@Component({
  selector: 'loom-employee-role-access-panel',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="role-access-panel">
      @if (message()) {
        <p class="ok">{{ message() }}</p>
      }
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      @if (caps().canEditAdminAccess) {
        <section class="card">
          <h3>Роль</h3>
          <label class="check-row">
            <input
              type="checkbox"
              name="adminAccess"
              [(ngModel)]="adminAccess"
              [disabled]="busy()"
            />
            Адміністратор
          </label>
          <div class="computed-role">
            <span class="label">Ефективна роль</span>
            <strong>{{ computedRoleLabel() }}</strong>
            <p class="muted hint">Визначається активною посадою</p>
          </div>
        </section>
      }

      @if (caps().canEditVisibilityOverrides) {
        <section class="card">
          <h3>Індивідуальні права</h3>
          <p class="muted">
            Регулює лише peer-видимість чужих даних. Не скасовує admin-, owner-
            або manager-scope.
          </p>

          <label>
            Чужі анкети
            <select
              name="profileOverride"
              [(ngModel)]="profileOverride"
              [disabled]="busy()"
            >
              @for (opt of profileOverrideOptions; track opt.value) {
                <option [value]="opt.value">{{ opt.label }}</option>
              }
            </select>
          </label>

          <label>
            Чужі відсутності
            <select
              name="absencesOverride"
              [(ngModel)]="absencesOverride"
              [disabled]="busy()"
              (ngModelChange)="onAbsencesOverrideChange()"
            >
              @for (opt of absenceOverrideOptions; track opt.value) {
                <option [value]="opt.value">{{ opt.label }}</option>
              }
            </select>
          </label>

          @if (absencesOverride !== 'deny') {
            <label>
              Деталі (тип / причина)
              <select
                name="absenceTypeDetailOverride"
                [(ngModel)]="absenceTypeDetailOverride"
                [disabled]="busy()"
              >
                @for (opt of absenceTypeDetailOptions; track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </label>
          }
        </section>
      }

      @if (caps().canEditAdminAccess || caps().canEditVisibilityOverrides) {
        <button type="button" (click)="save()" [disabled]="busy()">
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
      .check-row {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        grid-template-columns: none;
      }
      .check-row input {
        width: auto;
      }
      select {
        padding: 0.55rem 0.7rem;
        border: 1px solid var(--pw-border);
        border-radius: 8px;
        background: var(--pw-surface-2, var(--pw-surface));
        color: var(--pw-text);
      }
      .computed-role {
        display: grid;
        gap: 0.2rem;
      }
      .computed-role .label {
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
      button {
        justify-self: start;
        padding: 0.55rem 0.9rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border-strong, var(--pw-border));
        background: var(--pw-accent-soft, color-mix(in srgb, var(--pw-accent) 18%, transparent));
        color: var(--pw-text);
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
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

  readonly employeeId = input.required<string>();
  readonly access = input<EmployeeAccessSection | null | undefined>(null);
  readonly caps = input.required<EmployeeProfileCapabilities>();

  readonly changed = output<void>();

  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal('');

  adminAccess = false;
  profileOverride: VisibilityOverrideUi = 'inherit';
  absencesOverride: VisibilityOverrideUi = 'inherit';
  absenceTypeDetailOverride: AbsenceTypeDetailOverrideUi = 'inherit';

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
      this.adminAccess = section.adminAccess;
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

    if (caps.canEditAdminAccess) {
      body.adminAccess = this.adminAccess;
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
        this.changed.emit();
      },
      error: (err) => this.fail(err, 'Не вдалося зберегти права доступу'),
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
