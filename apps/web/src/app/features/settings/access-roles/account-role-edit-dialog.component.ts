import {
  Component,
  ElementRef,
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
import { Surface } from '../../../core/access/can-access-surface';
import { OverlayScrollLockService } from '../../../core/overlay/overlay-scroll-lock.service';
import { HelpTriggerComponent } from '../../../core/help/help-trigger.component';
import { attachPwDialogHostToBody } from '../../../shared/ui/pw-dialog-host';
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
const ABSENCES_APPROVE = 'absences.approve';
const ABSENCES_ADMIN = 'absences.admin';
const EMPLOYEES_READ_TEAM_COMMENT = 'employees.read_team_comment';
const EMPLOYEES_EXPORT_PROFILE = 'employees.export_profile';
const EMPLOYEES_READ_PERSONAL = 'employees.read.personal';
const EMPLOYEES_WRITE_PERSONAL = 'employees.write.personal';
const EMPLOYEES_READ_EMERGENCY = 'employees.read.emergency_contact';
const EMPLOYEES_WRITE_EMERGENCY = 'employees.write.emergency_contact';
const EMPLOYEES_CHANGE_ASSIGNMENT = 'employees.change_assignment';
const EMPLOYEES_CHANGE_STATUS = 'employees.change_status';
const EMPLOYEES_VIEW_HISTORY = 'employees.view_history';

const TOGGLE_EXTRAS = [
  CONFIDENTIAL_VIEW,
  EMPLOYEES_CREATE,
  EMPLOYEES_MANAGE_PROFILES,
  EMPLOYEES_ASSIGN_ACCOUNT_ROLE,
  EMPLOYEES_CREATE_ACCOUNT_AT_CREATE,
  EMPLOYEES_READ_TEAM_COMMENT,
  EMPLOYEES_EXPORT_PROFILE,
  EMPLOYEES_READ_PERSONAL,
  EMPLOYEES_WRITE_PERSONAL,
  EMPLOYEES_READ_EMERGENCY,
  EMPLOYEES_WRITE_EMERGENCY,
  EMPLOYEES_CHANGE_ASSIGNMENT,
  EMPLOYEES_CHANGE_STATUS,
  EMPLOYEES_VIEW_HISTORY,
  QUESTIONNAIRES_ASSIGN,
  QUESTIONNAIRES_MANAGE_LIFECYCLE,
  QUESTIONNAIRES_DELETE,
  QUESTIONNAIRES_APPLY_PROFILE_CHANGES,
  ABSENCES_APPROVE,
  ABSENCES_ADMIN,
] as const;

/** Pure pair helper — safe to call from effects without reading a writable signal. */
function withAbsencesAdminSurface(
  surfaceIds: readonly string[],
  enabled: boolean,
): string[] {
  const without = surfaceIds.filter((id) => id !== Surface.AbsencesAdmin);
  return enabled ? [...without, Surface.AbsencesAdmin] : without;
}

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
            @if (role()?.isSystem) {
              <span class="badge">Системна роль</span>
            }
          </div>
          <button
            type="button"
            class="icon-close"
            aria-label="Закрити"
            title="Закрити"
            [disabled]="busy()"
            (click)="closed.emit()"
          >
            ×
          </button>
        </div>

        <div class="body">
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
                не знімаються. Скидання пароля, деактивація та видалення
                акаунта / картки — лише з повним доступом.
              </p>
            } @else {
              <p class="hint">
                Скидання пароля, деактивація та видалення акаунта / картки
                доступні лише ролям із повним доступом.
              </p>
            }
          </fieldset>

          <fieldset class="permission-group">
            <legend>Працівники — створення й ролі</legend>
            <label class="check">
              <input
                type="checkbox"
                name="roleCreateEmployees"
                [(ngModel)]="grantsCreateEmployees"
                [disabled]="busy() || !canEditCreateEmployees()"
              />
              Створювати працівників
            </label>
            <label class="check">
              <input
                type="checkbox"
                name="roleAssignAccountRole"
                [(ngModel)]="grantsAssignAccountRole"
                [disabled]="busy() || !canEditAssignAccountRole()"
              />
              Призначати ролі акаунта
            </label>
            <div class="check-with-hint">
              <label class="check">
                <input
                  type="checkbox"
                  name="roleCreateAccountAtCreate"
                  [(ngModel)]="grantsCreateAccountAtCreate"
                  [disabled]="busy() || !canEditCreateAccountAtCreate()"
                />
                Створювати акаунт разом із карткою
              </label>
              <p class="hint">
                Обліковий запис одразу при створенні. Пізніше — окрема політика
                attach.
              </p>
            </div>
          </fieldset>

          <fieldset class="permission-group">
            <legend>Працівники — профілі</legend>
            <label class="check">
              <input
                type="checkbox"
                name="roleManageProfiles"
                [(ngModel)]="grantsManageProfiles"
                [disabled]="busy() || !canEditManageProfiles()"
              />
              Редагувати профілі (базові поля, у керованому відділі)
            </label>
            <label class="check">
              <input
                type="checkbox"
                name="roleReadTeamComment"
                [(ngModel)]="grantsReadTeamComment"
                [disabled]="busy() || !canEditReadTeamComment()"
              />
              Бачити службовий коментар
            </label>
            <label class="check">
              <input
                type="checkbox"
                name="roleExportProfile"
                [(ngModel)]="grantsExportProfile"
                [disabled]="busy() || !canEditExportProfile()"
              />
              Експорт PDF профілю
            </label>
            <label class="check">
              <input
                type="checkbox"
                name="roleViewHistory"
                [(ngModel)]="grantsViewHistory"
                [disabled]="busy() || !canEditViewHistory()"
              />
              Переглядати історію профілю
            </label>
          </fieldset>

          <fieldset class="permission-group">
            <legend>Працівники — особисті дані</legend>
            <p class="hint group-hint">
              Редагування потребує «редагувати профілі» і керований відділ.
            </p>
            <label class="check">
              <input
                type="checkbox"
                name="roleReadPersonal"
                [(ngModel)]="grantsReadPersonal"
                [disabled]="busy() || !canEditReadPersonal()"
              />
              Читати особисті контакти
            </label>
            <label class="check">
              <input
                type="checkbox"
                name="roleWritePersonal"
                [(ngModel)]="grantsWritePersonal"
                [disabled]="busy() || !canEditWritePersonal()"
              />
              Редагувати особисті контакти
            </label>
            <label class="check">
              <input
                type="checkbox"
                name="roleReadEmergency"
                [(ngModel)]="grantsReadEmergency"
                [disabled]="busy() || !canEditReadEmergency()"
              />
              Читати екстрений контакт
            </label>
            <label class="check">
              <input
                type="checkbox"
                name="roleWriteEmergency"
                [(ngModel)]="grantsWriteEmergency"
                [disabled]="busy() || !canEditWriteEmergency()"
              />
              Редагувати екстрений контакт
            </label>
          </fieldset>

          <fieldset class="permission-group">
            <legend>Працівники — оргпризначення</legend>
            <p class="hint group-hint">
              Потребує «редагувати профілі» і керований відділ.
            </p>
            <label class="check">
              <input
                type="checkbox"
                name="roleChangeAssignment"
                [(ngModel)]="grantsChangeAssignment"
                [disabled]="busy() || !canEditChangeAssignment()"
              />
              Змінювати напрямок / відділ / посаду
            </label>
            <label class="check">
              <input
                type="checkbox"
                name="roleChangeStatus"
                [(ngModel)]="grantsChangeStatus"
                [disabled]="busy() || !canEditChangeStatus()"
              />
              Змінювати статус зайнятості
            </label>
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

          <fieldset class="permission-group">
            <legend>Робочий календар</legend>
            <label class="check">
              <input
                type="checkbox"
                name="roleAbsencesApprove"
                [(ngModel)]="grantsAbsencesApprove"
                [disabled]="busy() || !canEditAbsencesApprove()"
              />
              Може затверджувати відсутності
            </label>
            <div class="check-with-hint">
              <label class="check">
                <input
                  type="checkbox"
                  name="roleAbsencesAdmin"
                  [(ngModel)]="grantsAbsencesAdmin"
                  [disabled]="busy() || !canEditAbsencesAdmin()"
                  (ngModelChange)="onAbsencesAdminChange()"
                />
                Може адмініструвати відсутності
              </label>
              <p class="hint">
                Сторінка конфіденційності відсутностей і фіналізація видалення.
                Екран absences.admin надається разом із цим правом.
              </p>
            </div>
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
                  @if (!isDerivedSurface(surface.id)) {
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
                }
              </section>
            }
          </fieldset>
        </form>
        </div>

        <div class="foot">
          <button
            type="button"
            class="btn pw-btn"
            data-help-id="settings.dialog.role.save"
            (click)="submit()"
            [disabled]="busy() || !name.trim()"
          >
            {{ role() ? 'Зберегти' : 'Створити' }}
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
        width: min(42rem, 100%);
        max-height: calc(100dvh - var(--shell-topbar-h, 0px) - 1.5rem);
        position: relative;
        border-radius: 12px;
        background: var(--pw-surface, #1e293b);
        border: 1px solid var(--pw-border, #334155);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
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
        flex-wrap: wrap;
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
      .icon-close:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .body {
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 1rem 1.15rem;
      }
      .foot {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        padding: 0.85rem 1.15rem 1rem;
        border-top: 1px solid var(--pw-border);
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
      .permission-group .group-hint {
        margin: 0;
      }
      .template-codes {
        display: grid;
        gap: 0.35rem;
        margin-top: 0.35rem;
        padding-top: 0.55rem;
        border-top: 1px solid var(--pw-border);
        font-size: 0.9rem;
        /* Match assignment/position multi-select — default 2.6rem reads too thin here. */
        --ms-trigger-height: 4.75rem;
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
      select {
        padding: 0.5rem 0.7rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border-strong);
        box-sizing: border-box;
        font: inherit;
        background: var(--pw-surface);
        color: inherit;
        width: 100%;
      }
      .btn:disabled {
        opacity: 0.65;
        cursor: default;
      }
    `,
  ],
})
export class AccountRoleEditDialogComponent implements OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
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
  grantsAbsencesApprove = false;
  grantsAbsencesAdmin = false;
  grantsReadTeamComment = false;
  grantsExportProfile = false;
  grantsReadPersonal = false;
  grantsWritePersonal = false;
  grantsReadEmergency = false;
  grantsWriteEmergency = false;
  grantsChangeAssignment = false;
  grantsChangeStatus = false;
  grantsViewHistory = false;

  private readonly selectedSurfaceIds = signal<readonly string[]>([]);
  private readonly selectedTemplateCodes = signal<readonly string[]>([]);
  private backdropPress = false;

  readonly surfaceGroups = computed<SurfaceGroupVm[]>(() =>
    groupSurfaces(
      this.surfaces().filter((s) => !this.isDerivedSurface(s.id)),
    ).filter((g) => g.surfaces.length > 0),
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

  canEditAbsencesApprove(): boolean {
    if (this.isAdminEquivalent) return false;
    const role = this.role();
    if (!role) return true;
    return role.canEditAbsencesApproveGrant;
  }

  canEditAbsencesAdmin(): boolean {
    if (this.isAdminEquivalent) return false;
    const role = this.role();
    if (!role) return true;
    return role.canEditAbsencesAdminGrant;
  }

  canEditReadTeamComment(): boolean {
    if (this.isAdminEquivalent) return false;
    const role = this.role();
    if (!role) return true;
    return role.canEditReadTeamCommentGrant;
  }

  canEditExportProfile(): boolean {
    if (this.isAdminEquivalent) return false;
    const role = this.role();
    if (!role) return true;
    return role.canEditExportProfileGrant;
  }

  canEditReadPersonal(): boolean {
    if (this.isAdminEquivalent) return false;
    const role = this.role();
    if (!role) return true;
    return role.canEditReadPersonalGrant;
  }

  /** Write field toggles require ManageProfiles in Settings UX (disable + hint). */
  canEditManageProfilesDependent(): boolean {
    return this.canEditManageProfiles() && this.grantsManageProfiles;
  }

  canEditWritePersonal(): boolean {
    if (!this.canEditManageProfilesDependent()) return false;
    const role = this.role();
    if (!role) return true;
    return role.canEditWritePersonalGrant;
  }

  canEditReadEmergency(): boolean {
    if (this.isAdminEquivalent) return false;
    const role = this.role();
    if (!role) return true;
    return role.canEditReadEmergencyGrant;
  }

  canEditWriteEmergency(): boolean {
    if (!this.canEditManageProfilesDependent()) return false;
    const role = this.role();
    if (!role) return true;
    return role.canEditWriteEmergencyGrant;
  }

  canEditChangeAssignment(): boolean {
    if (!this.canEditManageProfilesDependent()) return false;
    const role = this.role();
    if (!role) return true;
    return role.canEditChangeAssignmentGrant;
  }

  canEditChangeStatus(): boolean {
    if (!this.canEditManageProfilesDependent()) return false;
    const role = this.role();
    if (!role) return true;
    return role.canEditChangeStatusGrant;
  }

  canEditViewHistory(): boolean {
    if (this.isAdminEquivalent) return false;
    const role = this.role();
    if (!role) return true;
    return role.canEditViewHistoryGrant;
  }

  /** Surfaces controlled by permission toggles — not independently selectable. */
  isDerivedSurface(surfaceId: string): boolean {
    return surfaceId === Surface.AbsencesAdmin;
  }

  ngOnInit(): void {
    attachPwDialogHostToBody(this.host);
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
      this.grantsAbsencesApprove = role
        ? role.isAdminEquivalent || role.grantsAbsencesApproveExplicitly
        : false;
      this.grantsAbsencesAdmin = role
        ? role.isAdminEquivalent || role.grantsAbsencesAdminExplicitly
        : false;
      this.grantsReadTeamComment = role
        ? role.isAdminEquivalent || role.grantsReadTeamCommentExplicitly
        : false;
      this.grantsExportProfile = role
        ? role.isAdminEquivalent || role.grantsExportProfileExplicitly
        : false;
      this.grantsReadPersonal = role
        ? role.isAdminEquivalent || role.grantsReadPersonalExplicitly
        : false;
      this.grantsWritePersonal = role
        ? role.isAdminEquivalent || role.grantsWritePersonalExplicitly
        : false;
      this.grantsReadEmergency = role
        ? role.isAdminEquivalent || role.grantsReadEmergencyExplicitly
        : false;
      this.grantsWriteEmergency = role
        ? role.isAdminEquivalent || role.grantsWriteEmergencyExplicitly
        : false;
      this.grantsChangeAssignment = role
        ? role.isAdminEquivalent || role.grantsChangeAssignmentExplicitly
        : false;
      this.grantsChangeStatus = role
        ? role.isAdminEquivalent || role.grantsChangeStatusExplicitly
        : false;
      this.grantsViewHistory = role
        ? role.isAdminEquivalent || role.grantsViewHistoryExplicitly
        : false;
      if (!this.grantsManageProfiles) {
        this.grantsWritePersonal = false;
        this.grantsWriteEmergency = false;
        this.grantsChangeAssignment = false;
        this.grantsChangeStatus = false;
      }
      // One write — do not read selectedSurfaceIds inside this effect (infinite loop).
      this.selectedSurfaceIds.set(
        withAbsencesAdminSurface(
          [...(role?.surfaceIds ?? [])],
          this.grantsAbsencesAdmin,
        ),
      );
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
    if (this.isDerivedSurface(surfaceId)) return;
    const current = this.selectedSurfaceIds();
    this.selectedSurfaceIds.set(
      current.includes(surfaceId)
        ? current.filter((id) => id !== surfaceId)
        : [...current, surfaceId],
    );
  }

  onAbsencesAdminChange(): void {
    this.selectedSurfaceIds.set(
      withAbsencesAdminSurface(
        this.selectedSurfaceIds(),
        this.grantsAbsencesAdmin,
      ),
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
    this.grantsAbsencesApprove = true;
    this.grantsAbsencesAdmin = true;
    this.grantsReadTeamComment = true;
    this.grantsExportProfile = true;
    this.grantsReadPersonal = true;
    this.grantsWritePersonal = true;
    this.grantsReadEmergency = true;
    this.grantsWriteEmergency = true;
    this.grantsChangeAssignment = true;
    this.grantsChangeStatus = true;
    this.grantsViewHistory = true;
    this.selectedSurfaceIds.set(
      withAbsencesAdminSurface(this.selectedSurfaceIds(), true),
    );
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
      if (this.grantsAbsencesApprove) extras.add(ABSENCES_APPROVE);
      if (this.grantsAbsencesAdmin) extras.add(ABSENCES_ADMIN);
      if (this.grantsReadTeamComment) extras.add(EMPLOYEES_READ_TEAM_COMMENT);
      if (this.grantsExportProfile) extras.add(EMPLOYEES_EXPORT_PROFILE);
      if (this.grantsReadPersonal) extras.add(EMPLOYEES_READ_PERSONAL);
      if (this.grantsManageProfiles && this.grantsWritePersonal) {
        extras.add(EMPLOYEES_WRITE_PERSONAL);
      }
      if (this.grantsReadEmergency) extras.add(EMPLOYEES_READ_EMERGENCY);
      if (this.grantsManageProfiles && this.grantsWriteEmergency) {
        extras.add(EMPLOYEES_WRITE_EMERGENCY);
      }
      if (this.grantsManageProfiles && this.grantsChangeAssignment) {
        extras.add(EMPLOYEES_CHANGE_ASSIGNMENT);
      }
      if (this.grantsManageProfiles && this.grantsChangeStatus) {
        extras.add(EMPLOYEES_CHANGE_STATUS);
      }
      if (this.grantsViewHistory) extras.add(EMPLOYEES_VIEW_HISTORY);
    }

    const surfaceIds = withAbsencesAdminSurface(
      this.selectedSurfaceIds(),
      this.grantsAbsencesAdmin,
    );
    this.selectedSurfaceIds.set(surfaceIds);

    const body: CreateAccountRoleBody = {
      name,
      permissionPreset: this.permissionPreset,
      isAdminEquivalent: this.isAdminEquivalent,
      extraPermissions: [...extras],
      surfaceIds: [...surfaceIds],
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
