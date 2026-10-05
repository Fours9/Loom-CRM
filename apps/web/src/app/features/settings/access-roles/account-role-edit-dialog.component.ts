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
import { HelpTriggerComponent } from '../../../core/help/help-trigger.component';
import {
  MultiSelectListComponent,
  type MultiSelectItem,
} from '../../../shared/multi-select-list.component';

const CONFIDENTIAL_VIEW = 'confidential.view';
const EMPLOYEES_CREATE = 'employees.create';
const EMPLOYEES_MANAGE_PROFILES = 'employees.manage_profiles';
const EMPLOYEES_ASSIGN_ACCOUNT_ROLE = 'employees.assign_account_role';
const EMPLOYEES_CREATE_ACCOUNT_AT_CREATE =
  'employees.create_account_at_create';
const QUESTIONNAIRES_ASSIGN = 'questionnaires.assign';
const QUESTIONNAIRES_MANAGE_LIFECYCLE = 'questionnaires.manage_lifecycle';
const QUESTIONNAIRES_DELETE = 'questionnaires.delete';
const QUESTIONNAIRES_APPLY_PROFILE_CHANGES =
  'questionnaires.apply_profile_changes';

const TOGGLE_EXTRAS = [
  CONFIDENTIAL_VIEW,
  EMPLOYEES_CREATE,
  EMPLOYEES_MANAGE_PROFILES,
  EMPLOYEES_ASSIGN_ACCOUNT_ROLE,
  EMPLOYEES_CREATE_ACCOUNT_AT_CREATE,
  QUESTIONNAIRES_ASSIGN,
  QUESTIONNAIRES_MANAGE_LIFECYCLE,
  QUESTIONNAIRES_DELETE,
  QUESTIONNAIRES_APPLY_PROFILE_CHANGES,
] as const;

export type PublishedQuestionnaireTemplate = {
  code: string;
  title: string;
};

@Component({
  selector: 'loom-account-role-edit-dialog',
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
          <div class="head-title">
            <h2 [id]="headingId">{{ heading() }}</h2>
            <loom-help-trigger
              tourId="settings.dialog.role"
              ariaLabel="Підказка про цю форму"
            />
          </div>
          <div class="head-actions">
            @if (role()?.isSystem) {
              <span class="badge">Системна роль</span>
            }
            <button type="button" class="ghost-neutral" (click)="closed.emit()" [disabled]="busy()">
              Скасувати
            </button>
            <button
              type="button"
              data-help-id="settings.dialog.role.save"
              (click)="submit()"
              [disabled]="busy() || !name.trim()"
            >
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
              data-help-id="settings.dialog.role.name"
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
              data-help-id="settings.dialog.role.preset"
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

          <fieldset class="permission-group">
            <legend>Доступ</legend>
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
                Повний доступ включає всі дозволи нижче; окремі галочки
                не знімаються.
              </p>
            }
          </fieldset>

          <fieldset class="permission-group">
            <legend>Працівники</legend>
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
            <div class="check-with-hint">
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
                Акаунт одразу з карткою. Пізніше — окрема політика attach.
              </p>
            </div>
          </fieldset>

          <fieldset class="permission-group">
            <legend>Анкети</legend>
            <label class="check">
              <input
                type="checkbox"
                name="roleAssignQuestionnaires"
                [(ngModel)]="grantsAssignQuestionnaires"
                [disabled]="busy() || !canEditAssignQuestionnaires()"
              />
              Може створювати анкети
            </label>
            <div class="check-with-hint">
              <label class="check">
                <input
                  type="checkbox"
                  name="roleManageQuestionnaires"
                  [(ngModel)]="grantsManageQuestionnaires"
                  [disabled]="busy() || !canEditManageQuestionnaires()"
                />
                Може керувати життєвим циклом анкет
              </label>
              <p class="hint">
                Скасування, закриття, видалення, повторне прикріплення та
                прийняття/відхилення пропозицій до профілю.
              </p>
            </div>

            <label class="template-codes">
              <span>Шаблони для доступу</span>
              <app-multi-select-list
                [items]="templateItems()"
                [selectedIds]="templateSelectedIds()"
                placeholder="Оберіть шаблони"
                [showSelectAll]="true"
                selectAllLabel="Усі шаблони"
                [disabled]="busy() || !canEditQuestionnaireTemplates()"
                (selectedIdsChange)="onTemplateCodesChange($event)"
              />
              @if (!templateItems().length) {
                <p class="hint">Опубліковані шаблони недоступні.</p>
              }
            </label>
          </fieldset>

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

          <fieldset class="permission-group surfaces" data-help-id="settings.dialog.role.surfaces">
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
        z-index: var(--pw-z-modal, 250);
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
      .head-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
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
      .permission-group,
      .surfaces {
        display: grid;
        gap: 0.55rem;
        margin: 0;
        padding: 0.8rem 0.9rem;
        border: 1px solid var(--pw-border);
        border-radius: 10px;
      }
      .permission-group legend,
      .surfaces legend {
        padding: 0 0.35rem;
        font-size: 0.9rem;
        color: var(--pw-text);
      }
      .permission-group .check-with-hint {
        display: grid;
        gap: 0.25rem;
      }
      .permission-group .check-with-hint .hint {
        margin-left: 1.5rem;
      }
      .template-codes {
        display: grid;
        gap: 0.35rem;
        margin-top: 0.35rem;
        padding-top: 0.55rem;
        border-top: 1px solid var(--pw-border);
        font-size: 0.9rem;
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
  readonly publishedTemplates = input<readonly PublishedQuestionnaireTemplate[]>(
    [],
  );
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
  grantsAssignQuestionnaires = false;
  grantsManageQuestionnaires = false;

  private readonly selectedSurfaceIds = signal<readonly string[]>([]);
  private readonly selectedTemplateCodes = signal<readonly string[]>([]);
  private backdropPress = false;

  readonly surfaceGroups = computed<SurfaceGroupVm[]>(() =>
    groupSurfaces(this.surfaces()),
  );

  /** Published + orphan grants (orphans stay selectable until explicitly removed). */
  readonly templateItems = computed<MultiSelectItem[]>(() => {
    const published = this.publishedTemplates().map((template) => ({
      id: template.code,
      label: `${template.title} (${template.code})`,
    }));
    const publishedIds = new Set(published.map((item) => item.id));
    const orphans = this.selectedTemplateCodes()
      .filter((code) => !publishedIds.has(code))
      .map((code) => ({
        id: code,
        label: `Недоступний шаблон (${code})`,
      }));
    return [...published, ...orphans];
  });

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

  canEditAssignQuestionnaires(): boolean {
    if (this.isAdminEquivalent) return false;
    const role = this.role();
    if (!role) return true;
    return role.canEditAssignQuestionnairesGrant;
  }

  canEditManageQuestionnaires(): boolean {
    if (this.isAdminEquivalent) return false;
    const role = this.role();
    if (!role) return true;
    return role.canEditManageQuestionnairesGrant;
  }

  canEditQuestionnaireTemplates(): boolean {
    if (this.isAdminEquivalent) return false;
    const role = this.role();
    if (!role) return true;
    return role.canEditQuestionnaireTemplates;
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
      this.grantsAssignQuestionnaires = role
        ? role.isAdminEquivalent || role.grantsAssignQuestionnairesExplicitly
        : false;
      this.grantsManageQuestionnaires = role
        ? role.isAdminEquivalent || role.grantsManageQuestionnairesExplicitly
        : false;
      this.selectedSurfaceIds.set([...(role?.surfaceIds ?? [])]);
      this.selectedTemplateCodes.set([...(role?.questionnaireTemplateCodes ?? [])]);
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

  onTemplateCodesChange(codes: string[]): void {
    if (this.isAdminEquivalent || !this.canEditQuestionnaireTemplates()) return;
    this.selectedTemplateCodes.set([...codes]);
  }

  templateSelectedIds(): string[] {
    if (this.isAdminEquivalent) {
      return this.templateItems().map((item) => item.id);
    }
    return [...this.selectedTemplateCodes()];
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
    this.grantsAssignQuestionnaires = true;
    this.grantsManageQuestionnaires = true;
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
      if (this.grantsAssignQuestionnaires) extras.add(QUESTIONNAIRES_ASSIGN);
      if (this.grantsManageQuestionnaires) {
        extras.add(QUESTIONNAIRES_MANAGE_LIFECYCLE);
        extras.add(QUESTIONNAIRES_DELETE);
        extras.add(QUESTIONNAIRES_APPLY_PROFILE_CHANGES);
      }
    }

    const body: CreateAccountRoleBody = {
      name,
      permissionPreset: this.permissionPreset,
      isAdminEquivalent: this.isAdminEquivalent,
      extraPermissions: [...extras],
      surfaceIds: [...this.selectedSurfaceIds()],
    };
    if (!this.isAdminEquivalent) {
      body.questionnaireTemplateCodes = [...this.selectedTemplateCodes()];
    }

    this.saved.emit(body);
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
