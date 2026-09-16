import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  AccountRole,
  AppSurface,
  CreateAccountRoleBody,
  PermissionPreset,
} from './account-roles-api.service';
import {
  PERMISSION_PRESET_OPTIONS,
  groupSurfaces,
  type SurfaceGroupVm,
} from './surface-catalog';
import { OverlayScrollLockService } from '../../../core/overlay/overlay-scroll-lock.service';

const CONFIDENTIAL_VIEW = 'confidential.view';
const EMPLOYEES_CREATE = 'employees.create';
const EMPLOYEES_MANAGE_PROFILES = 'employees.manage_profiles';
const EMPLOYEES_ASSIGN_ACCOUNT_ROLE = 'employees.assign_account_role';
const EMPLOYEES_CREATE_ACCOUNT_AT_CREATE =
  'employees.create_account_at_create';

const TOGGLE_EXTRAS = [
  CONFIDENTIAL_VIEW,
  EMPLOYEES_CREATE,
  EMPLOYEES_MANAGE_PROFILES,
  EMPLOYEES_ASSIGN_ACCOUNT_ROLE,
  EMPLOYEES_CREATE_ACCOUNT_AT_CREATE,
] as const;

@Component({
  selector: 'loom-account-role-edit-dialog',
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
          <h2 [id]="headingId">{{ heading() }}</h2>
          <div class="head-actions">
            @if (role()?.isSystem) {
              <span class="badge">Системна роль</span>
            }
            <button type="button" class="ghost-neutral" (click)="closed.emit()" [disabled]="busy()">
              Скасувати
            </button>
            <button type="button" (click)="submit()" [disabled]="busy() || !name.trim()">
              {{ role() ? 'Зберегти' : 'Створити' }}
            </button>
          </div>
        </div>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <form class="role-form" novalidate (submit)="$event.preventDefault(); submit()">
          <label>
            Назва
            <input
              [(ngModel)]="name"
              name="roleName"
              placeholder="Назва ролі"
              maxlength="120"
              [disabled]="busy()"
            />
          </label>

          <label>
            Набір прав
            <select
              [(ngModel)]="permissionPreset"
              name="rolePreset"
              [disabled]="busy() || presetLocked()"
              (ngModelChange)="onPresetChange()"
            >
              @for (opt of presetOptions; track opt.value) {
                <option [ngValue]="opt.value">{{ opt.label }}</option>
              }
            </select>
          </label>

          <label class="check">
            <input
              type="checkbox"
              name="roleAdminEquivalent"
              [(ngModel)]="isAdminEquivalent"
              [disabled]="busy() || adminEquivalentLocked()"
              (ngModelChange)="onAdminEquivalentChange()"
            />
            Повний доступ (рівень адміністратора)
          </label>

          <label class="check">
            <input
              type="checkbox"
              name="roleConfidentialView"
              [(ngModel)]="grantsConfidential"
              [disabled]="busy() || !canEditConfidential()"
            />
            Може бачити конфіденційну інформацію
          </label>
          @if (isAdminEquivalent) {
            <p class="hint">
              Входить до повного адміністративного доступу — окремий дозвіл не знімається.
            </p>
          }

          <label class="check">
            <input
              type="checkbox"
              name="roleCreateEmployees"
              [(ngModel)]="grantsCreateEmployees"
              [disabled]="busy() || !canEditCreateEmployees()"
            />
            Може створювати працівників
          </label>

          <label class="check">
            <input
              type="checkbox"
              name="roleManageProfiles"
              [(ngModel)]="grantsManageProfiles"
              [disabled]="busy() || !canEditManageProfiles()"
            />
            Може редагувати профілі працівників
          </label>

          <label class="check">
            <input
              type="checkbox"
              name="roleAssignAccountRole"
              [(ngModel)]="grantsAssignAccountRole"
              [disabled]="busy() || !canEditAssignAccountRole()"
            />
            Може призначати ролі акаунта
          </label>

          <label class="check">
            <input
              type="checkbox"
              name="roleCreateAccountAtCreate"
              [(ngModel)]="grantsCreateAccountAtCreate"
              [disabled]="busy() || !canEditCreateAccountAtCreate()"
            />
            Може створювати обліковий запис при створенні працівника
          </label>
          <p class="hint">
            Дозволяє створити акаунт одразу разом із карткою. Створення акаунта
            пізніше регулюється окремою політикою attach.
          </p>

          @if (presetLocked()) {
            <p class="hint">
              Набір прав і рівень адміністратора системної ролі змінити не можна — доступні
              лише назва та перелік екранів.
            </p>
          }
          @if (isAdminEquivalent) {
            <p class="hint">
              Роль з повним доступом бачить усі екрани незалежно від переліку нижче.
            </p>
          }

          <fieldset class="surfaces">
            <legend>Доступні екрани</legend>
            @if (!surfaceGroups().length) {
              <p class="hint">Каталог екранів недоступний.</p>
            }
            @for (group of surfaceGroups(); track group.group) {
              <section class="surface-group">
                <h3>{{ group.label }}</h3>
                @for (surface of group.surfaces; track surface.id) {
                  <label class="check">
                    <input
                      type="checkbox"
                      [name]="'surface_' + surface.id"
                      [checked]="isSurfaceSelected(surface.id)"
                      [disabled]="busy()"
                      (change)="toggleSurface(surface.id)"
                    />
                    {{ surface.label }}
                  </label>
                }
              </section>
            }
          </fieldset>
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
        place-items: start center;
        background: color-mix(in srgb, #0f172a 45%, transparent);
        padding: calc(var(--shell-topbar-h, 0px) + 0.35rem) 1rem 0.75rem;
        overflow: auto;
      }
      .modal {
        display: grid;
        gap: 0.85rem;
        width: min(42rem, 100%);
        margin: 0.35rem auto 0;
        padding: 1.1rem 1.2rem;
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
        flex-wrap: wrap;
      }
      .head-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      }
      h2 {
        margin: 0;
        font-size: 1.1rem;
      }
      h3 {
        margin: 0;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--pw-muted);
      }
      .badge {
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        border: 1px solid var(--pw-border-strong);
        background: var(--pw-surface-2, var(--pw-surface));
        color: var(--pw-muted);
        font-size: 0.8rem;
      }
      .role-form {
        display: grid;
        gap: 0.7rem;
      }
      .role-form label {
        display: grid;
        gap: 0.3rem;
        font-size: 0.9rem;
      }
      .role-form label.check {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
      }
      .check input[type='checkbox'] {
        width: 1rem;
        height: 1rem;
        margin: 0;
        padding: 0;
        border: none;
        flex: 0 0 auto;
      }
      .surfaces {
        display: grid;
        gap: 0.9rem;
        margin: 0;
        padding: 0.8rem 0.9rem;
        border: 1px solid var(--pw-border);
        border-radius: 10px;
      }
      .surfaces legend {
        padding: 0 0.35rem;
        font-size: 0.9rem;
        color: var(--pw-text);
      }
      .surface-group {
        display: grid;
        gap: 0.35rem;
      }
      .hint {
        margin: 0;
        font-size: 0.85rem;
        color: var(--pw-muted);
      }
      .error {
        margin: 0;
        color: var(--pw-danger, #a32d2d);
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
      .ghost-neutral {
        background: transparent;
        color: var(--pw-text);
        border: 1px solid var(--pw-border-strong);
      }
      button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
    `,
  ],
})
export class AccountRoleEditDialogComponent implements OnInit, OnDestroy {
  private readonly scrollLock = inject(OverlayScrollLockService);
  /** null = create a custom role. */
  readonly role = input<AccountRole | null>(null);
  readonly surfaces = input<readonly AppSurface[]>([]);
  readonly busy = input(false);
  readonly error = input('');

  readonly saved = output<CreateAccountRoleBody>();
  readonly closed = output<void>();

  readonly headingId = 'account-role-edit-dialog-title';
  readonly presetOptions = PERMISSION_PRESET_OPTIONS;

  name = '';
  permissionPreset: PermissionPreset = 'employee';
  isAdminEquivalent = false;
  grantsConfidential = false;
  grantsCreateEmployees = false;
  grantsManageProfiles = false;
  grantsAssignAccountRole = false;
  grantsCreateAccountAtCreate = false;

  private readonly selectedSurfaceIds = signal<readonly string[]>([]);
  private backdropPress = false;

  readonly surfaceGroups = computed<SurfaceGroupVm[]>(() =>
    groupSurfaces(this.surfaces()),
  );

  /** System roles keep their permission bundle; only name + surfaces are editable. */
  readonly presetLocked = computed(() => Boolean(this.role()?.isSystem));
  readonly adminEquivalentLocked = computed(
    () => this.presetLocked() || this.permissionPreset === 'admin',
  );

  /** Editable confidential extra: actor can edit grant and target is not adminEq. */
  canEditConfidential(): boolean {
    if (this.isAdminEquivalent) return false;
    const role = this.role();
    if (!role) return true;
    return role.canEditConfidentialGrant;
  }

  canEditCreateEmployees(): boolean {
    if (this.isAdminEquivalent) return false;
    const role = this.role();
    if (!role) return true;
    return role.canEditCreateEmployeesGrant;
  }

  canEditManageProfiles(): boolean {
    if (this.isAdminEquivalent) return false;
    const role = this.role();
    if (!role) return true;
    return role.canEditManageProfilesGrant;
  }

  canEditAssignAccountRole(): boolean {
    if (this.isAdminEquivalent) return false;
    const role = this.role();
    if (!role) return true;
    return role.canEditAssignAccountRoleGrant;
  }

  canEditCreateAccountAtCreate(): boolean {
    if (this.isAdminEquivalent) return false;
    const role = this.role();
    if (!role) return true;
    return role.canEditCreateAccountAtCreateGrant;
  }

  ngOnInit(): void {
    this.scrollLock.acquire();
  }

  ngOnDestroy(): void {
    this.scrollLock.release();
  }

  constructor() {
    effect(() => {
      const role = this.role();
      this.name = role?.name ?? '';
      this.permissionPreset = role?.permissionPreset ?? 'employee';
      this.isAdminEquivalent = role?.isAdminEquivalent ?? false;
      this.grantsConfidential = role
        ? role.isAdminEquivalent || role.grantsConfidentialExplicitly
        : false;
      this.grantsCreateEmployees = role
        ? role.isAdminEquivalent || role.grantsCreateEmployeesExplicitly
        : false;
      this.grantsManageProfiles = role
        ? role.isAdminEquivalent || role.grantsManageProfilesExplicitly
        : false;
      this.grantsAssignAccountRole = role
        ? role.isAdminEquivalent || role.grantsAssignAccountRoleExplicitly
        : false;
      this.grantsCreateAccountAtCreate = role
        ? role.isAdminEquivalent || role.grantsCreateAccountAtCreateExplicitly
        : false;
      this.selectedSurfaceIds.set([...(role?.surfaceIds ?? [])]);
    });
  }

  heading(): string {
    return this.role() ? 'Редагувати роль' : 'Нова роль';
  }

  isSurfaceSelected(surfaceId: string): boolean {
    return this.selectedSurfaceIds().includes(surfaceId);
  }

  toggleSurface(surfaceId: string): void {
    const current = this.selectedSurfaceIds();
    this.selectedSurfaceIds.set(
      current.includes(surfaceId)
        ? current.filter((id) => id !== surfaceId)
        : [...current, surfaceId],
    );
  }

  /** `admin` preset is meaningless without adminEquivalent (API rejects the pair). */
  onPresetChange(): void {
    if (this.permissionPreset === 'admin') {
      this.isAdminEquivalent = true;
      this.lockAdminTogglesOn();
    }
  }

  onAdminEquivalentChange(): void {
    if (this.isAdminEquivalent) {
      this.lockAdminTogglesOn();
    }
  }

  private lockAdminTogglesOn(): void {
    this.grantsConfidential = true;
    this.grantsCreateEmployees = true;
    this.grantsManageProfiles = true;
    this.grantsAssignAccountRole = true;
    this.grantsCreateAccountAtCreate = true;
  }

  submit(): void {
    const name = this.name.trim();
    if (!name || this.busy()) return;

    const extras = new Set(
      (this.role()?.extraPermissions ?? []).filter(
        (p) => !(TOGGLE_EXTRAS as readonly string[]).includes(p),
      ),
    );
    if (!this.isAdminEquivalent) {
      if (this.grantsConfidential) extras.add(CONFIDENTIAL_VIEW);
      if (this.grantsCreateEmployees) extras.add(EMPLOYEES_CREATE);
      if (this.grantsManageProfiles) extras.add(EMPLOYEES_MANAGE_PROFILES);
      if (this.grantsAssignAccountRole) extras.add(EMPLOYEES_ASSIGN_ACCOUNT_ROLE);
      if (this.grantsCreateAccountAtCreate)
        extras.add(EMPLOYEES_CREATE_ACCOUNT_AT_CREATE);
    }

    this.saved.emit({
      name,
      permissionPreset: this.permissionPreset,
      isAdminEquivalent: this.isAdminEquivalent,
      extraPermissions: [...extras],
      surfaceIds: [...this.selectedSurfaceIds()],
    });
  }

  onBackdropPointerDown(event: Event): void {
    this.backdropPress = event.target === event.currentTarget;
  }

  onBackdropClick(event: Event): void {
    if (this.backdropPress && event.target === event.currentTarget && !this.busy()) {
      this.closed.emit();
    }
    this.backdropPress = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.busy()) this.closed.emit();
  }
}
