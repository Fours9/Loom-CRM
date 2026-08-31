import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import type {
  EmploymentAssignmentHistoryItem,
  EmployeeProfileResponse,
  ImportantDateItem,
  NamedReference,
} from '@loom/contracts-employees';
import {
  EmployeeContactsEditorComponent,
  contactsBundleFromProfile,
  emptyEmployeeContactsBundle,
  normalizeEmployeeContactsBundle,
  profileContactsAccess,
  type EmployeeContactsBundle,
} from '../../shared/employee-contacts/public-api';
import {
  OrganizationCatalogApiService,
  type OrganizationCatalogDepartment,
  type OrganizationCatalogPosition,
  type OrganizationCatalogSnapshot,
} from '../../core/api/organization-catalog-api.service';
import { EmploymentAssignmentsApiService } from '../../core/api/employment-assignments-api.service';
import { SettingsOrgApiService } from '../settings/settings-org-api.service';
import {
  filterDepartmentsForSelection,
  filterPositionsForSelection,
  reduceEmploymentOrgFilter,
} from '../../shared/organization/employment-org-filter.policy';
import {
  applyDepartmentLocationHint,
  markWorkLocationTouched,
} from './work-location-hint.policy';
import { EmploymentAssignmentDialogComponent } from './employment-assignment-dialog.component';
import {
  CLOSED_ASSIGNMENT_DIALOG,
  applyPositionManagerTemplate,
  closeAssignmentDialog,
  emptyEmploymentAssignmentForm,
  createEmploymentAssignmentForm,
  employmentAssignmentFormFromHistory,
  isAssignmentDialogOpen,
  openCreateAssignmentDialog,
  openEditAssignmentDialog,
  toEmploymentAssignmentWrite,
  type EmploymentAssignmentDialogState,
  type EmploymentAssignmentForm,
} from './employment-assignment-dialog.model';

type DataTabId = 'basics' | 'contacts' | 'dates';
export type EmployeeDataPanelMode = 'employee-data' | 'position';

type ImportantDateDraft = {
  key: string;
  title: string;
  startDate: string;
  endDate: string;
};

export type AssignmentHistoryItem = EmploymentAssignmentHistoryItem;

@Component({
  selector: 'loom-employee-data-panel',
  standalone: true,
  imports: [FormsModule, EmployeeContactsEditorComponent, EmploymentAssignmentDialogComponent],
  template: `
@if (panelMode === 'employee-data') {
<nav class="tabs subtabs" role="tablist" aria-label="Дані працівника">
  <button
    type="button"
    class="tab"
    role="tab"
    [attr.aria-selected]="dataTab() === 'basics'"
    [class.active]="dataTab() === 'basics'"
    (mousedown)="$event.preventDefault()"
    (click)="setDataTab('basics')"
  >
    Основні
  </button>
  <button
    type="button"
    class="tab"
    role="tab"
    [attr.aria-selected]="dataTab() === 'contacts'"
    [class.active]="dataTab() === 'contacts'"
    (mousedown)="$event.preventDefault()"
    (click)="setDataTab('contacts')"
  >
    Контакти
  </button>
  <button
    type="button"
    class="tab"
    role="tab"
    [attr.aria-selected]="dataTab() === 'dates'"
    [class.active]="dataTab() === 'dates'"
    (mousedown)="$event.preventDefault()"
    (click)="setDataTab('dates')"
  >
    Дати
  </button>
</nav>
}

@if (panelMode === 'employee-data' && dataTab() === 'basics') {
  <div class="section-head">
    <h2>Основні</h2>
    @if (profile.capabilities.canEditBasic || profile.capabilities.canEditPersonal) {
      <div class="section-actions">
        @if (editingBasics()) {
          <button type="button" class="btn" (click)="saveBasics()" [disabled]="busy()">
            Зберегти
          </button>
          <button type="button" class="btn ghost" (click)="cancelBasicsEditing()">
            Скасувати
          </button>
        } @else {
          <button type="button" class="btn ghost" (click)="startBasicsEditing()">
            Редагувати
          </button>
        }
      </div>
    }
  </div>
<dl class="grid">
  <div><dt>Статус</dt><dd>{{ statusLabel(profile.header.employmentStatus) }}</dd></div>
  <div><dt>Керівник</dt><dd>{{ profile.header.manager?.displayName || '—' }}</dd></div>
    <div><dt>Ім'я для звернення</dt><dd>{{ profile.header.preferredName || '—' }}</dd></div>
</dl>

  @if (profile.capabilities.canViewPersonal) {
    <h3>Персональна інформація</h3>
    <dl class="grid">
      <div><dt>Місто</dt><dd>{{ profile.sections.personal?.city || '—' }}</dd></div>
      <div><dt>Бажана мова</dt><dd>{{ profile.sections.personal?.preferredLanguage || '—' }}</dd></div>
    </dl>
  }

  @if (editingBasics() && profile.capabilities.canEditBasic) {
    <div class="edit">
    <label>Ім'я <input [(ngModel)]="basicForm.firstName" name="fn" /></label>
    <label>Прізвище <input [(ngModel)]="basicForm.lastName" name="ln" /></label>
    <label>По батькові <input [(ngModel)]="basicForm.middleName" name="mn" /></label>
    <label>Ім'я для звернення <input [(ngModel)]="basicForm.preferredName" name="pn" /></label>
    </div>
  }
  @if (editingBasics() && profile.capabilities.canEditPersonal) {
    <div class="edit">
      <label>Місто <input [(ngModel)]="personalCoreForm.city" name="city" /></label>
      <label>Мова <input [(ngModel)]="personalCoreForm.preferredLanguage" name="lang" /></label>
    </div>
  }
}

@if (panelMode === 'employee-data' && dataTab() === 'contacts') {
  <div class="section-head">
    <h2>Контакти</h2>
    @if (
      profile.capabilities.canEditBasic ||
      profile.capabilities.canEditPersonal ||
      profile.capabilities.canEditEmergencyContact
    ) {
      <div class="section-actions">
        @if (editingContacts()) {
          <button type="button" class="btn" (click)="saveContacts()" [disabled]="busy()">
            Зберегти
          </button>
          <button type="button" class="btn ghost" (click)="cancelContactsEditing()">
            Скасувати
          </button>
        } @else {
          <button type="button" class="btn ghost" (click)="startContactsEditing()">
            Редагувати
          </button>
        }
      </div>
    }
  </div>

  <loom-employee-contacts-editor
    [bundle]="contactsBundleDraft()"
    [access]="profileContactsAccess(profile)"
    [editing]="editingContacts()"
    (bundleChange)="onContactsBundleDraftChange($event)"
  />
}

@if (panelMode === 'employee-data' && dataTab() === 'dates') {
  <div class="section-head">
    <h2>Дати</h2>
    @if (
      profile.capabilities.canEditPersonal ||
      profile.capabilities.canEditEmployment
    ) {
      <div class="section-actions">
        @if (editingDates()) {
          <button type="button" class="btn" (click)="saveDates()" [disabled]="busy()">
            Зберегти
          </button>
          <button type="button" class="btn ghost" (click)="cancelDatesEditing()">
            Скасувати
          </button>
        } @else {
          <button type="button" class="btn ghost" (click)="startDatesEditing()">
            Редагувати
          </button>
        }
      </div>
    }
  </div>

  <dl class="grid">
    @if (profile.capabilities.canViewPersonal) {
      <div>
        <dt>Дата народження</dt>
        <dd>{{ profile.sections.personal?.birthDate || '—' }}</dd>
      </div>
    } @else {
      <div>
        <dt>Дата народження</dt>
        <dd class="muted">Немає доступу</dd>
      </div>
    }
    <div>
      <dt>Дата реєстрації акаунту</dt>
      <dd>{{ formatDateOnly(profile.header.accountCreatedAt) }}</dd>
    </div>
    <div>
      <dt>Дата початку роботи</dt>
      <dd>{{ profile.header.hiredAt || '—' }}</dd>
    </div>
  </dl>

  @if (
    editingDates() &&
    (profile.capabilities.canEditPersonal ||
      profile.capabilities.canEditEmployment)
  ) {
    <div class="edit">
      @if (profile.capabilities.canEditPersonal) {
        <label>
          Дата народження
          <input type="date" [(ngModel)]="personalCoreForm.birthDate" name="bd" />
        </label>
      }
      @if (profile.capabilities.canEditEmployment) {
        @if (profile.sections.employment?.id) {
          <label>
            Дата початку роботи
            <input type="date" [(ngModel)]="hiredAtForm" name="workStart" />
          </label>
        } @else {
          <p class="muted">
            Немає активного призначення — спочатку створіть його у вкладці «Робота» → «Посада».
          </p>
        }
      }
    </div>
  }

  @if (!profile.capabilities.canViewPersonal) {
    <p class="muted">Немає доступу до важливих дат.</p>
  } @else {
    <h3>Важливі дати</h3>
    @if (editingDates() && profile.capabilities.canEditPersonal) {
      <div class="dates-list">
        @for (
          item of importantDateForms;
          track item.key;
          let index = $index
        ) {
          <fieldset class="dates-row">
            <legend>Дата {{ index + 1 }}</legend>
            <button
              type="button"
              class="icon-btn danger dates-remove"
              title="Прибрати дату"
              [attr.aria-label]="'Прибрати дату ' + (index + 1)"
              (click)="removeImportantDate(item.key)"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h1v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h1a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9zm2 2h2v1h-2V5zm-2 4a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1zm6 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1z"
                />
              </svg>
            </button>
            <div class="dates-fields">
              <label class="dates-title">
                Назва
                <input
                  [(ngModel)]="item.title"
                  [name]="'importantDateTitle_' + item.key"
                  required
                  maxlength="255"
                />
              </label>
              <label>
                З
                <input
                  type="date"
                  [(ngModel)]="item.startDate"
                  [name]="'importantDateStart_' + item.key"
                  required
                />
              </label>
              <label>
                По
                <input
                  type="date"
                  [(ngModel)]="item.endDate"
                  [name]="'importantDateEnd_' + item.key"
                />
              </label>
            </div>
          </fieldset>
        }
      </div>
      <div class="dates-actions">
        <button
          type="button"
          class="btn ghost"
          [disabled]="importantDateForms.length >= 20"
          (click)="addImportantDate()"
        >
          + Додати дату
        </button>
      </div>
    } @else if ((profile.sections.importantDates?.length ?? 0) > 0) {
      <div class="dates-list">
        @for (
          d of profile.sections.importantDates!;
          track d.id;
          let index = $index
        ) {
          <div class="dates-row view">
            <h4>{{ d.title || 'Дата ' + (index + 1) }}</h4>
            <div class="dates-fields">
              <label>
                З
                <div class="value">{{ d.startDate || '—' }}</div>
              </label>
              <label>
                По
                <div class="value">{{ d.endDate || '—' }}</div>
              </label>
            </div>
          </div>
        }
      </div>
    } @else {
      <p class="muted">Важливих дат ще немає.</p>
    }
  }
}

@if (panelMode === 'position') {
  <div class="section-head">
    <h2>Посада</h2>
    @if (profile.capabilities.canEditEmployment) {
      <div class="section-actions">
        <button type="button" class="btn ghost" (click)="startCreatingAssignment()">
          Нове призначення
        </button>
      </div>
    }
  </div>

@if (profile.sections.employment) {
  <dl class="grid">
    <div><dt>Компанія</dt><dd>{{ refName(profile.sections.employment!.company) }}</dd></div>
    <div><dt>Напрямок</dt><dd>{{ refName(profile.sections.employment!.direction) }}</dd></div>
    <div><dt>Відділ</dt><dd>{{ refName(profile.sections.employment!.department) }}</dd></div>
    <div><dt>Посада</dt><dd>{{ refName(profile.sections.employment!.position) }}</dd></div>
    <div><dt>Формат</dt><dd>{{ profile.sections.employment!.workFormat || '—' }}</dd></div>
    <div><dt>Локація</dt><dd>{{ profile.sections.employment!.workLocation || '—' }}</dd></div>
    <div><dt>Тип зайнятості</dt><dd>{{ profile.sections.employment!.employmentType || '—' }}</dd></div>
    <div><dt>Початок</dt><dd>{{ profile.sections.employment!.startDate || '—' }}</dd></div>
    <div><dt>Початок випроб.</dt><dd>{{ profile.sections.employment!.probationStartDate || '—' }}</dd></div>
    <div><dt>Кінець випроб.</dt><dd>{{ profile.sections.employment!.probationEndDate || '—' }}</dd></div>
  </dl>
  @if (profile.sections.employment!.status === 'planned') {
    <p class="muted">
      Заплановане призначення.
      @if (profile.sections.employment!.activationBlockedReason) {
        Перевірка заблокована: {{ profile.sections.employment!.activationBlockedReason }}.
      }
    </p>
  }
} @else {
  <p class="muted">Призначення ще не задано.</p>
}

@if (historyAssign.length) {
  <h3>Історія призначень</h3>
    <ul class="timeline assignments">
    @for (h of historyAssign; track h.id) {
        <li class="history-row">
          <div class="history-top">
            <div class="history-main">
              <span class="badge" [attr.data-status]="h.status">{{ statusLabel(h.status) }}</span>
        {{ h.startDate || '?' }} → {{ h.endDate || 'зараз' }}
        · {{ h.department?.name || '—' }} / {{ h.position?.name || '—' }}
              @if (h.workFormat) {
                · {{ h.workFormat }}
              }
              @if (h.status === 'planned' && h.activationBlockedReason) {
                · блок: {{ h.activationBlockedReason }}
              }
            </div>
            @if (profile.capabilities.canEditEmployment) {
              <div class="history-actions">
                <button type="button" class="btn ghost sm" (click)="startEditAssignment(h)">
                  Редагувати
                </button>
                @if (h.status !== 'active') {
                  <button
                    type="button"
                    class="btn ghost sm danger"
                    (click)="deleteAssignment(h)"
                    [disabled]="busy() || deletingAssignmentId() === h.id"
                  >
                    Видалити
                  </button>
                }
              </div>
            }
          </div>
        </li>
    }
  </ul>
  }
}

@if (openAssignmentDialog(); as dialog) {
  <loom-employment-assignment-dialog
    [state]="dialog"
    [form]="assignmentForm"
    [catalog]="orgCatalog()"
    [departments]="departmentOptions(assignmentForm)"
    [positions]="positionOptions(assignmentForm)"
    [busy]="busy()"
    [error]="assignmentDialogError()"
    (closed)="cancelAssignmentDialog()"
    (submitted)="submitAssignmentDialog()"
    (directionChange)="onAssignmentDirectionChange()"
    (departmentChange)="onAssignmentDepartmentChange()"
    (positionChange)="onAssignmentPositionChange()"
    (workLocationChange)="onAssignmentWorkLocationInput($event)"
  />
}
  `,
  styles: [

    `
      .profile { display: grid; gap: 1rem; }
      .hero {
        display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1rem;
        padding: 1rem; border: 1px solid var(--pw-border); border-radius: 12px;
        background: var(--pw-surface);
      }
      .hero-main { display: flex; gap: 1rem; min-width: 0; }
      .avatar {
        width: 72px; height: 72px; border-radius: 16px; background: color-mix(in srgb, var(--pw-accent) 15%, var(--pw-surface));
        display: grid; place-items: center; overflow: hidden; flex-shrink: 0; font-weight: 700;
      }
      .avatar img { width: 100%; height: 100%; object-fit: cover; }
      h1 { margin: 0; font-size: 1.5rem; }
      h2 { margin: 0; }
      h3 { margin: 0.75rem 0 0.35rem; font-size: 0.95rem; color: var(--pw-accent); }
      .eyebrow { margin: 0; color: var(--pw-muted); font-size: 0.85rem; }
      .meta { margin: 0.25rem 0; color: var(--pw-muted); }
      .badges { display: flex; flex-wrap: wrap; gap: 0.4rem; }
      .badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 0.2rem 0.65rem;
        font-size: 0.78rem;
        font-weight: 700;
        border: 1px solid var(--pw-border);
        background: var(--pw-surface-2);
        color: var(--pw-text-strong);
      }
      .badge.accent {
        background: var(--pw-accent-soft);
        color: var(--pw-accent);
        border-color: color-mix(in srgb, var(--pw-accent) 28%, transparent);
      }
      .badge[data-status='active'] {
        background: var(--pw-success-soft);
        color: var(--pw-success);
        border-color: color-mix(in srgb, var(--pw-success) 40%, transparent);
      }
      .badge[data-status='suspended'],
      .badge[data-status='draft'],
      .badge[data-status='candidate'],
      .badge[data-status='preboarding'],
      .badge[data-status='probation'],
      .badge[data-status='maternity_leave'],
      .badge[data-status='military_leave'] {
        background: var(--pw-accent-soft);
        color: var(--pw-accent);
        border-color: color-mix(in srgb, var(--pw-accent) 35%, transparent);
      }
      .badge[data-status='dismissed'],
      .badge[data-status='archived'] {
        background: var(--pw-danger-soft);
        color: var(--pw-danger);
        border-color: color-mix(in srgb, var(--pw-danger) 35%, transparent);
      }
      .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: start; }
      .section-head {
        display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.75rem; align-items: center;
      }
      .section-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
      .contacts-stack {
        display: grid;
        gap: 0.85rem;
      }
      .section-block {
        margin: 0;
        padding: 0.85rem 0.9rem;
        border: 1px solid color-mix(in srgb, var(--pw-muted) 40%, transparent);
        border-radius: 10px;
        background: var(--pw-surface);
        display: grid;
        gap: 0.6rem;
      }
      .section-block h3 {
        margin: 0;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--pw-accent);
      }
      .disclose > summary {
        list-style: none;
        cursor: pointer;
        margin: -0.35rem -0.45rem;
        padding: 0.35rem 0.45rem;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--pw-accent);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        user-select: none;
        border-radius: 8px;
      }
      .disclose > summary:hover {
        background: var(--pw-accent-soft);
      }
      .disclose > summary::-webkit-details-marker {
        display: none;
      }
      .disclose > summary::after {
        content: '▾';
        flex: 0 0 auto;
        width: 1.6rem;
        height: 1.6rem;
        display: grid;
        place-items: center;
        border-radius: 6px;
        border: 1px solid color-mix(in srgb, var(--pw-muted) 55%, transparent);
        background: var(--pw-surface-2, color-mix(in srgb, var(--pw-muted) 8%, var(--pw-surface)));
        color: var(--pw-text-strong, inherit);
        font-size: 1.05rem;
        line-height: 1;
        transform: rotate(-90deg);
        transition: transform 0.15s ease, background 0.15s ease;
      }
      .disclose[open] > summary::after {
        transform: rotate(0deg);
        background: var(--pw-accent-soft);
        border-color: var(--pw-accent);
        color: var(--pw-accent);
      }
      .disclose-body {
        display: grid;
        gap: 0.6rem;
        margin-top: 0.35rem;
      }
      .section-block > label,
      .disclose-body > label,
      .field-row > label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.9rem;
        color: var(--pw-muted);
        min-width: 0;
      }
      .value {
        color: var(--pw-text);
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .field-row {
        display: grid;
        gap: 0.6rem;
        grid-template-columns: minmax(0, 1fr);
      }
      @media (min-width: 641px) {
        .field-row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      .disclose-body input,
      .disclose-body textarea,
      .section-block input,
      .dates-row input,
      .emergency-row input,
      .emergency-row textarea {
        border: 1px solid var(--pw-border);
        border-radius: 8px;
        padding: 0.5rem 0.65rem;
        min-height: 2.5rem;
        background: var(--pw-surface);
        color: inherit;
        width: 100%;
        box-sizing: border-box;
        font: inherit;
      }
      .disclose-body textarea {
        min-height: 4rem;
        resize: vertical;
      }
      .emergency-list {
        display: grid;
        gap: 0.75rem;
      }
      .emergency-row {
        position: relative;
        min-width: 0;
        margin: 0;
        padding: 0.85rem;
        padding-right: 3rem;
        border: 1px solid var(--pw-border);
        border-radius: 10px;
        background: var(--pw-surface-2, color-mix(in srgb, var(--pw-muted) 8%, var(--pw-surface)));
      }
      .emergency-row.view {
        padding-right: 0.85rem;
      }
      .emergency-row legend,
      .emergency-row h4 {
        margin: 0 0 0.5rem;
        padding-inline: 0.35rem;
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--pw-accent);
      }
      .emergency-fields {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.65rem;
      }
      .emergency-fields > label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.9rem;
        color: var(--pw-muted);
        min-width: 0;
      }
      .emergency-notes {
        grid-column: 1 / -1;
      }
      .emergency-remove {
        position: absolute;
        top: 0.55rem;
        right: 0.55rem;
      }
      .icon-btn {
        width: 2rem;
        height: 2rem;
        display: grid;
        place-items: center;
        padding: 0;
        border: 1px solid var(--pw-border);
        border-radius: 8px;
        background: var(--pw-surface);
        color: var(--pw-muted);
        cursor: pointer;
      }
      .icon-btn.danger {
        color: var(--pw-danger, #a32d2d);
      }
      .icon-btn:hover {
        border-color: var(--pw-border-strong, var(--pw-border));
      }
      .icon-btn svg {
        display: block;
      }
      .emergency-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .personal-contact-groups {
        display: grid;
        gap: 1rem;
      }
      .personal-contact-group h4 {
        margin: 0 0 0.35rem;
        font-size: 0.95rem;
      }
      .primary-toggle {
        flex-direction: row !important;
        align-items: center;
        gap: 0.45rem !important;
        color: var(--pw-text) !important;
      }
      .primary-badge {
        margin-left: 0.35rem;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--pw-muted);
      }
      .dates-list {
        display: grid;
        gap: 0.75rem;
      }
      .dates-row {
        position: relative;
        min-width: 0;
        margin: 0;
        padding: 0.85rem;
        padding-right: 3rem;
        border: 1px solid var(--pw-border);
        border-radius: 10px;
        background: var(--pw-surface-2, color-mix(in srgb, var(--pw-muted) 8%, var(--pw-surface)));
      }
      .dates-row.view {
        padding-right: 0.85rem;
      }
      .dates-row legend,
      .dates-row h4 {
        margin: 0 0 0.5rem;
        padding-inline: 0.35rem;
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--pw-accent);
      }
      .dates-fields {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.65rem;
      }
      .dates-fields > label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.9rem;
        color: var(--pw-muted);
        min-width: 0;
      }
      .dates-title {
        grid-column: 1 / -1;
      }
      .dates-remove {
        position: absolute;
        top: 0.55rem;
        right: 0.55rem;
      }
      .dates-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      @media (min-width: 641px) {
        .emergency-fields {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .dates-fields {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      .btn {
        border: 0; border-radius: 8px; background: var(--pw-accent); color: var(--pw-on-accent, #fff);
        padding: 0.55rem 0.9rem; min-height: 2.5rem; font-weight: 600; cursor: pointer; text-decoration: none;
        display: inline-flex; align-items: center;
      }
      .btn.ghost {
        background: var(--pw-accent-soft, #e8eef5);
        border: 1px solid color-mix(in srgb, var(--pw-accent) 35%, var(--pw-border));
        color: var(--pw-accent);
      }
      .btn.ghost:hover {
        background: color-mix(in srgb, var(--pw-accent) 16%, var(--pw-surface));
        border-color: var(--pw-accent);
      }
      .btn.sm { min-height: 2.1rem; padding: 0.35rem 0.65rem; font-size: 0.85rem; }
      .btn.danger {
        color: var(--pw-danger, #a32d2d);
        background: color-mix(in srgb, var(--pw-danger, #a32d2d) 8%, var(--pw-surface));
        border-color: color-mix(in srgb, var(--pw-danger, #a32d2d) 40%, var(--pw-border));
      }
      .completeness { display: grid; gap: 0.35rem; }
      .bar { height: 8px; background: var(--pw-border); border-radius: 99px; overflow: hidden; }
      .bar span { display: block; height: 100%; background: var(--pw-accent); }
      .bar.secondary span {
        background: color-mix(in srgb, var(--pw-muted) 55%, var(--pw-accent));
      }
      .tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        align-items: center;
        align-self: start;
        width: 100%;
      }
      .tab {
        border: 1px solid var(--pw-border);
        background: var(--pw-surface);
        border-radius: 999px;
        padding: 0.45rem 0.85rem;
        cursor: pointer;
        min-height: 2.4rem;
        height: auto;
        flex: 0 0 auto;
        align-self: center;
      }
      .tab.active { border-color: var(--pw-accent); color: var(--pw-accent); font-weight: 700; }
      .subtabs {
        margin-bottom: 0.25rem;
        padding-bottom: 0.65rem;
        border-bottom: 1px solid var(--pw-border);
      }
      .subtabs .tab {
        min-height: 2.1rem;
        padding: 0.35rem 0.7rem;
        font-size: 0.9rem;
        border-width: 1.5px;
        border-color: var(--pw-border-strong, var(--pw-border));
        background: var(--pw-surface-2, color-mix(in srgb, var(--pw-muted) 8%, var(--pw-surface)));
        color: var(--pw-text);
      }
      .subtabs .tab:hover {
        border-color: var(--pw-accent);
        color: var(--pw-accent);
      }
      .subtabs .tab.active {
        border-color: var(--pw-accent);
        background: var(--pw-accent-soft);
        color: var(--pw-accent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pw-accent) 35%, transparent);
      }
      .panel {
        padding: 1rem; border: 1px solid var(--pw-border); border-radius: 12px; background: var(--pw-surface);
        display: grid; gap: 0.75rem;
        min-height: 28rem;
        align-content: start;
        align-items: start;
      }
      .grid { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin: 0; }
      .grid div { display: grid; gap: 0.15rem; }
      dt { color: var(--pw-muted); font-size: 0.8rem; }
      dd { margin: 0; font-weight: 600; }
      .edit { display: grid; gap: 0.6rem; margin-top: 0.75rem; }
      .edit label { display: grid; gap: 0.25rem; font-size: 0.9rem; }
      .edit input, .edit select {
        border: 1px solid var(--pw-border); border-radius: 8px; padding: 0.5rem 0.65rem; min-height: 2.5rem;
        background: var(--pw-surface); color: inherit;
      }
      .row-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
      .timeline { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.5rem; }
      .timeline li { padding: 0.55rem 0; border-bottom: 1px solid var(--pw-border); }
      .timeline.assignments {
        gap: 0.75rem;
      }
      .timeline.assignments > li {
        padding: 0;
        border-bottom: 0;
      }
      .history-row {
        display: grid;
        gap: 0.65rem;
        margin: 0;
        padding: 0.85rem 0.9rem;
        border: 1px solid color-mix(in srgb, var(--pw-muted) 40%, transparent);
        border-radius: 10px;
        background: var(--pw-surface);
      }
      .history-top {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.65rem 1rem;
      }
      .history-main {
        min-width: 0;
        flex: 1 1 12rem;
        overflow-wrap: anywhere;
        line-height: 1.45;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.45rem 0.55rem;
      }
      .history-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        flex: 0 0 auto;
        margin-left: auto;
        align-items: center;
      }
      .muted { color: var(--pw-muted); }
      .error { color: var(--pw-danger, #a32d2d); }
      @media (max-width: 640px) {
        .hero { padding: 0.85rem; }
        .actions { width: 100%; }
        .btn { flex: 1 1 auto; justify-content: center; }
      }
    `,
  
  ],
})
export class EmployeeDataPanelComponent implements OnChanges {
  private readonly http = inject(HttpClient);
  private readonly orgCatalogApi = inject(OrganizationCatalogApiService);
  private readonly assignmentsApi = inject(EmploymentAssignmentsApiService);
  private readonly orgApi = inject(SettingsOrgApiService);

  @Input({ required: true }) employeeId!: string;
  @Input({ required: true }) profile!: EmployeeProfileResponse;
  @Input() historyAssign: AssignmentHistoryItem[] = [];
  /** `employee-data` = Основні/Контакти/Дати; `position` = призначення (вкладка Робота). */
  @Input() panelMode: EmployeeDataPanelMode = 'employee-data';

  @Output() readonly profileChange = new EventEmitter<EmployeeProfileResponse>();
  @Output() readonly historyAssignChange = new EventEmitter<AssignmentHistoryItem[]>();
  @Output() readonly errorChange = new EventEmitter<string | null>();

  readonly dataTab = signal<DataTabId>('basics');
  readonly editingBasics = signal(false);
  readonly editingContacts = signal(false);
  readonly editingDates = signal(false);
  readonly assignmentDialog = signal<EmploymentAssignmentDialogState>(
    CLOSED_ASSIGNMENT_DIALOG,
  );
  readonly assignmentDialogError = signal<string | null>(null);
  readonly deletingAssignmentId = signal<string | null>(null);
  readonly busy = signal(false);
  readonly orgCatalog = signal<OrganizationCatalogSnapshot | null>(null);

  basicForm = {
    firstName: '',
    lastName: '',
    middleName: '',
    preferredName: '',
  };
  personalCoreForm = {
    birthDate: '',
    city: '',
    preferredLanguage: '',
  };
  hiredAtForm = '';
  readonly contactsBundleDraft = signal<EmployeeContactsBundle>(
    emptyEmployeeContactsBundle(),
  );
  readonly profileContactsAccess = profileContactsAccess;
  importantDateForms: ImportantDateDraft[] = [];
  assignmentForm: EmploymentAssignmentForm = emptyEmploymentAssignmentForm();
  private workLocationTouched = false;
  private departmentLocationHintApplied = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['profile'] && this.profile && !this.isEditing()) {
      this.applyProfile(this.profile);
      if (this.panelMode === 'position') {
        this.loadOrgCatalog();
      }
    }
    if (changes['employeeId'] && !changes['employeeId'].firstChange) {
      this.dataTab.set('basics');
      this.resetEditingModes();
      if (this.profile) {
        this.applyProfile(this.profile);
        if (this.panelMode === 'position') {
          this.loadOrgCatalog();
        }
      }
    }
    if (changes['panelMode'] && this.panelMode === 'position' && !this.orgCatalog()) {
      this.loadOrgCatalog();
    }
  }

  private loadOrgCatalog(): void {
    this.orgCatalogApi.getSnapshot().subscribe({
      next: (snapshot) => this.orgCatalog.set(snapshot),
      error: () => {
        this.orgCatalog.set(null);
        this.errorChange.emit('Не вдалося завантажити організаційні довідники');
      },
    });
  }

  private isEditing(): boolean {
    return (
      this.editingBasics() ||
      this.editingContacts() ||
      this.editingDates() ||
      isAssignmentDialogOpen(this.assignmentDialog())
    );
  }

  setDataTab(id: DataTabId): void {
    if (this.dataTab() === id) return;
    this.withPreservedScroll(() => {
      this.dataTab.set(id);
      this.resetEditingModes();
    });
  }

  startBasicsEditing(): void {
    this.editingContacts.set(false);
    this.editingDates.set(false);
    this.resetEmploymentEditing();
    this.applyProfile(this.profile);
    this.editingBasics.set(true);
  }

  cancelBasicsEditing(): void {
    this.applyProfile(this.profile);
    this.editingBasics.set(false);
  }

  startContactsEditing(): void {
    this.editingBasics.set(false);
    this.editingDates.set(false);
    this.resetEmploymentEditing();
    this.contactsBundleDraft.set(contactsBundleFromProfile(this.profile));
    this.errorChange.emit(null);
    this.editingContacts.set(true);
  }

  cancelContactsEditing(): void {
    this.contactsBundleDraft.set(contactsBundleFromProfile(this.profile));
    this.errorChange.emit(null);
    this.editingContacts.set(false);
  }

  onContactsBundleDraftChange(bundle: EmployeeContactsBundle): void {
    this.contactsBundleDraft.set(normalizeEmployeeContactsBundle(bundle));
  }

  startDatesEditing(): void {
    this.editingBasics.set(false);
    this.editingContacts.set(false);
    this.resetEmploymentEditing();
    this.applyProfile(this.profile);
    if (this.profile.capabilities.canEditPersonal) {
      this.hydrateImportantDateDrafts();
    } else {
      this.importantDateForms = [];
    }
    this.errorChange.emit(null);
    this.editingDates.set(true);
  }

  cancelDatesEditing(): void {
    this.applyProfile(this.profile);
    this.importantDateForms = [];
    this.errorChange.emit(null);
    this.editingDates.set(false);
  }

  addImportantDate(): void {
    if (this.importantDateForms.length >= 20) return;
    this.importantDateForms = [...this.importantDateForms, this.createImportantDateDraft()];
  }

  removeImportantDate(key: string): void {
    this.importantDateForms = this.importantDateForms.filter((item) => item.key !== key);
  }

  startCreatingAssignment(): void {
    this.editingBasics.set(false);
    this.editingContacts.set(false);
    this.editingDates.set(false);
    this.importantDateForms = [];
    this.assignmentForm = createEmploymentAssignmentForm();
    this.workLocationTouched = false;
    this.departmentLocationHintApplied = false;
    this.assignmentDialogError.set(null);
    this.errorChange.emit(null);
    this.assignmentDialog.set(openCreateAssignmentDialog());
  }

  startEditAssignment(h: AssignmentHistoryItem): void {
    this.editingBasics.set(false);
    this.editingContacts.set(false);
    this.editingDates.set(false);
    this.importantDateForms = [];
    this.assignmentForm = employmentAssignmentFormFromHistory(h);
    this.workLocationTouched = false;
    this.departmentLocationHintApplied = false;
    this.assignmentDialogError.set(null);
    this.errorChange.emit(null);
    this.assignmentDialog.set(
      openEditAssignmentDialog({ assignmentId: h.id }),
    );
  }

  cancelAssignmentDialog(): void {
    this.assignmentDialog.set(closeAssignmentDialog());
    this.assignmentDialogError.set(null);
  }

  openAssignmentDialog(): Exclude<
    EmploymentAssignmentDialogState,
    { kind: 'closed' }
  > | null {
    const state = this.assignmentDialog();
    return state.kind === 'closed' ? null : state;
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      draft: 'Чернетка',
      candidate: 'Кандидат',
      preboarding: 'Preboarding',
      probation: 'Випробувальний',
      active: 'Активний',
      planned: 'Запланований',
      ended: 'Завершений',
      suspended: 'Призупинений',
      maternity_leave: 'Декрет',
      military_leave: 'Військова',
      dismissed: 'Звільнений',
      archived: 'Архів',
    };
    return map[status] ?? status;
  }

  refName(value: NamedReference | null | undefined): string {
    return value?.name || '—';
  }

  formatDateOnly(value: string | null | undefined): string {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleDateString('uk-UA');
    } catch {
      return value;
    }
  }

  directionOptions(): Array<{ id: string; name: string }> {
    return this.orgCatalog()?.directions ?? [];
  }

  departmentOptions(form: {
    directionId: string;
    departmentId: string;
    positionId: string;
  }): Array<OrganizationCatalogDepartment & { archived?: boolean; label?: string }> {
    const snapshot = this.orgCatalog();
    if (!snapshot) return [];
    const options = filterDepartmentsForSelection(
      {
        directionId: form.directionId || null,
        departmentId: form.departmentId || null,
        positionId: form.positionId || null,
      },
      snapshot.departments,
    );
    if (!form.departmentId || options.some((item) => item.id === form.departmentId)) {
      return options;
    }
    const archived = this.historyAssign.find((item) => item.departmentId === form.departmentId);
    return archived?.department
      ? [
          {
            id: archived.department.id,
            name: archived.department.name,
            description: null,
            location: null,
            directionId: archived.directionId,
            label: `${archived.department.name} (архівне)`,
            archived: true,
          },
          ...options,
        ]
      : options;
  }

  positionOptions(form: {
    directionId: string;
    departmentId: string;
    positionId: string;
  }): Array<OrganizationCatalogPosition & { archived?: boolean; label?: string }> {
    const snapshot = this.orgCatalog();
    if (!snapshot) return [];
    const options = filterPositionsForSelection(
      {
        directionId: form.directionId || null,
        departmentId: form.departmentId || null,
        positionId: form.positionId || null,
      },
      snapshot.positions,
    );
    if (!form.positionId || options.some((item) => item.id === form.positionId)) {
      return options;
    }
    const archived = this.historyAssign.find((item) => item.positionId === form.positionId);
    return archived?.position
      ? [
          {
            id: archived.position.id,
            name: archived.position.name,
            departmentId: archived.departmentId,
            directionId: archived.directionId,
            label: `${archived.position.name} (архівне)`,
            archived: true,
          },
          ...options,
        ]
      : options;
  }

  onAssignmentDirectionChange(): void {
    this.applyOrgAction({
      type: 'selectDirection',
      directionId: this.assignmentForm.directionId || null,
    });
  }

  onAssignmentDepartmentChange(): void {
    this.applyOrgAction({
      type: 'selectDepartment',
      departmentId: this.assignmentForm.departmentId || null,
    });
    if (this.assignmentDialog().kind !== 'create') {
      return;
    }
    const snapshot = this.orgCatalog();
    const department = snapshot?.departments.find(
      (item) => item.id === this.assignmentForm.departmentId,
    );
    const hinted = applyDepartmentLocationHint(
      {
        workLocation: this.assignmentForm.workLocation,
        workLocationTouched: this.workLocationTouched,
        departmentLocationHintApplied: this.departmentLocationHintApplied,
      },
      department?.location,
    );
    this.assignmentForm.workLocation = hinted.workLocation;
    this.workLocationTouched = hinted.workLocationTouched;
    this.departmentLocationHintApplied = hinted.departmentLocationHintApplied;
  }

  onAssignmentPositionChange(): void {
    this.applyOrgAction({
      type: 'selectPosition',
      positionId: this.assignmentForm.positionId || null,
    });
    // Create only: prefill manager flags from position template. Edit keeps user values.
    if (this.assignmentDialog().kind !== 'create') {
      return;
    }
    this.prefillManagerFromPositionTemplate(this.assignmentForm.positionId);
  }

  private prefillManagerFromPositionTemplate(positionId: string): void {
    if (!positionId) {
      this.assignmentForm.isDepartmentManager = false;
      this.assignmentForm.managedDepartmentIds = [];
      return;
    }
    this.orgApi.getPositions(true).subscribe({
      next: (positions) => {
        if (this.assignmentDialog().kind !== 'create') return;
        if (this.assignmentForm.positionId !== positionId) return;
        const position = positions.find((p) => p.id === positionId) ?? null;
        const next = applyPositionManagerTemplate(this.assignmentForm, position);
        this.assignmentForm.isDepartmentManager = next.isDepartmentManager;
        this.assignmentForm.managedDepartmentIds = next.managedDepartmentIds;
      },
      error: () => {
        /* keep current manager fields if template fetch fails */
      },
    });
  }

  onAssignmentWorkLocationInput(value: string): void {
    if (this.assignmentDialog().kind !== 'create') {
      this.assignmentForm.workLocation = value;
      return;
    }
    const next = markWorkLocationTouched(
      {
        workLocation: this.assignmentForm.workLocation,
        workLocationTouched: this.workLocationTouched,
        departmentLocationHintApplied: this.departmentLocationHintApplied,
      },
      value,
    );
    this.assignmentForm.workLocation = next.workLocation;
    this.workLocationTouched = next.workLocationTouched;
    this.departmentLocationHintApplied = next.departmentLocationHintApplied;
  }

  private applyOrgAction(
    action: Parameters<typeof reduceEmploymentOrgFilter>[1],
  ): void {
    const next = reduceEmploymentOrgFilter(
      {
        directionId: this.assignmentForm.directionId || null,
        departmentId: this.assignmentForm.departmentId || null,
        positionId: this.assignmentForm.positionId || null,
      },
      action,
      this.orgCatalog() ?? { directions: [], departments: [], positions: [] },
    );
    this.assignmentForm.directionId = next.directionId ?? '';
    this.assignmentForm.departmentId = next.departmentId ?? '';
    this.assignmentForm.positionId = next.positionId ?? '';
  }

  private resetEditingModes(): void {
    this.editingBasics.set(false);
    this.editingContacts.set(false);
    this.editingDates.set(false);
    this.importantDateForms = [];
    this.resetEmploymentEditing();
  }

  private withPreservedScroll(action: () => void): void {
    const y = window.scrollY;
    action();
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, left: 0, behavior: 'auto' });
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, left: 0, behavior: 'auto' });
      });
    });
  }

  private resetEmploymentEditing(): void {
    this.assignmentDialog.set(closeAssignmentDialog());
    this.assignmentDialogError.set(null);
    this.deletingAssignmentId.set(null);
  }

  private assignmentWriteError(err: unknown, fallback: string): string {
    const msg = (err as { error?: { message?: string | string[] } })?.error?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string' && msg.trim()) return msg;
    return fallback;
  }

  private applyProfile(p: EmployeeProfileResponse): void {
    this.basicForm = {
      firstName: p.sections.overview.firstName ?? '',
      lastName: p.sections.overview.lastName ?? '',
      middleName: p.sections.overview.middleName ?? '',
      preferredName: p.header.preferredName ?? '',
    };
    const pers = p.sections.personal;
    this.personalCoreForm = {
      birthDate: pers?.birthDate ?? '',
      city: pers?.city ?? '',
      preferredLanguage: pers?.preferredLanguage ?? '',
    };
    this.hiredAtForm = p.header.hiredAt ?? '';
    this.contactsBundleDraft.set(contactsBundleFromProfile(p));
    if (!isAssignmentDialogOpen(this.assignmentDialog())) {
      this.assignmentForm = emptyEmploymentAssignmentForm();
      this.workLocationTouched = false;
      this.departmentLocationHintApplied = false;
    }
  }

  saveBasics(): void {
    const caps = this.profile?.capabilities;
    if (!caps) return;
    this.busy.set(true);

    const requests = [];
    if (caps.canEditBasic) {
      requests.push(
        this.http.patch(`/api/v1/employees/${this.employeeId}/basic`, {
          firstName: this.basicForm.firstName,
          lastName: this.basicForm.lastName,
          middleName: this.basicForm.middleName || null,
          preferredName: this.basicForm.preferredName || null,
        }),
      );
    }
    if (caps.canEditPersonal) {
      requests.push(
        this.http.patch(`/api/v1/employees/${this.employeeId}/personal`, {
          city: this.personalCoreForm.city || null,
          preferredLanguage: this.personalCoreForm.preferredLanguage || null,
        }),
      );
    }

    if (!requests.length) {
      this.busy.set(false);
      return;
    }

    forkJoin(requests).subscribe({
      next: (results) => {
        const last = results[results.length - 1] as EmployeeProfileResponse;
        this.applyProfile(last);
        this.profileChange.emit(last);
        this.editingBasics.set(false);
        this.busy.set(false);
      },
      error: () => this.busy.set(false),
    });
  }

  saveDates(): void {
    const caps = this.profile?.capabilities;
    if (!caps || !this.profile) return;
    if (!caps.canEditPersonal && !caps.canEditEmployment) return;

    const requests = [];

    if (caps.canEditPersonal) {
      const dates = this.importantDateForms
        .filter((item) => !this.isImportantDateCompletelyEmpty(item))
        .map((item) => ({
          title: item.title.trim(),
          startDate: item.startDate.trim(),
          endDate: item.endDate.trim() || null,
        }));

      const invalid = dates.some((item) => !item.title || !item.startDate);
      if (invalid) {
        this.errorChange.emit('Для кожної важливої дати вкажіть назву і дату «з».');
        return;
      }

      const rangeInvalid = dates.some(
        (item) => item.endDate && item.endDate < item.startDate,
      );
      if (rangeInvalid) {
        this.errorChange.emit('Дата «по» не може бути раніше дати «з».');
        return;
      }

      requests.push(
        this.http.patch(`/api/v1/employees/${this.employeeId}/personal`, {
          birthDate: this.personalCoreForm.birthDate || null,
        }),
      );
      requests.push(
        this.http.put(`/api/v1/employees/${this.employeeId}/important-dates`, {
          dates,
        }),
      );
    }

    if (caps.canEditEmployment) {
      const assignmentId = this.profile.sections.employment?.id;
      if (typeof assignmentId === 'string' && assignmentId) {
        requests.push(
          this.http.patch(`/api/v1/employees/${this.employeeId}/employment-meta`, {
            hiredAt: this.hiredAtForm.trim() || null,
          }),
        );
      } else if (this.hiredAtForm.trim()) {
        requests.push(
          this.http.patch(`/api/v1/employees/${this.employeeId}/employment-meta`, {
            hiredAt: this.hiredAtForm.trim(),
          }),
        );
      }
    }

    if (!requests.length) return;

    this.errorChange.emit(null);
    this.busy.set(true);

    forkJoin(requests).subscribe({
      next: (results) => {
        const last = results[results.length - 1] as EmployeeProfileResponse;
        this.applyProfile(last);
        this.profileChange.emit(last);
        this.importantDateForms = [];
        this.editingDates.set(false);
        this.busy.set(false);
        this.reloadAssignments();
      },
      error: () => {
        this.errorChange.emit('Не вдалося зберегти дати');
        this.busy.set(false);
      },
    });
  }

  saveContacts(): void {
    const caps = this.profile?.capabilities;
    if (!caps) return;

    const bundle = normalizeEmployeeContactsBundle(this.contactsBundleDraft());
    const emergencyContacts = bundle.emergency
      .filter(
        (contact) =>
          contact.fullName.trim() ||
          contact.relationship.trim() ||
          contact.primaryPhone.trim() ||
          contact.secondaryPhone.trim() ||
          contact.notes.trim(),
      )
      .map((contact) => ({
        fullName: contact.fullName.trim(),
        relationship: contact.relationship.trim() || null,
        primaryPhone: contact.primaryPhone.trim(),
        secondaryPhone: contact.secondaryPhone.trim() || null,
        notes: contact.notes.trim() || null,
      }));

    if (caps.canEditEmergencyContact) {
      const invalid = emergencyContacts.some(
        (contact) => !contact.fullName || !contact.primaryPhone,
      );
      if (invalid) {
        this.errorChange.emit(
          'Для кожного екстреного контакту вкажіть ПІБ і основний телефон.',
        );
        return;
      }
    }

    this.errorChange.emit(null);
    this.busy.set(true);

    const requests = [];
    if (caps.canEditBasic) {
      requests.push(
        this.http.patch(`/api/v1/employees/${this.employeeId}/contacts`, {
          workEmail: bundle.work.email,
          workPhone: bundle.work.phone,
          workTelegram: bundle.work.telegram,
        }),
      );
    }
    if (caps.canEditPersonal) {
      requests.push(
        this.http.put(`/api/v1/employees/${this.employeeId}/personal-contacts`, {
          contacts: bundle.personal.map((contact) => ({
            type: contact.type,
            value: contact.value,
            isPrimary: contact.isPrimary,
          })),
        }),
      );
    }
    if (caps.canEditEmergencyContact) {
      requests.push(
        this.http.put(`/api/v1/employees/${this.employeeId}/emergency-contact`, {
          contacts: emergencyContacts,
        }),
      );
    }

    if (!requests.length) {
      this.busy.set(false);
      return;
    }

    forkJoin(requests).subscribe({
      next: (results) => {
        const last = results[results.length - 1] as EmployeeProfileResponse;
        this.applyProfile(last);
        this.profileChange.emit(last);
        this.editingContacts.set(false);
        this.busy.set(false);
      },
      error: () => {
        this.errorChange.emit('Не вдалося зберегти контакти');
        this.busy.set(false);
      },
    });
  }

  private hydrateImportantDateDrafts(): void {
    const source = this.profile?.sections.importantDates ?? [];
    this.importantDateForms = source.map((item) => this.createImportantDateDraft(item));
    if (!this.importantDateForms.length) {
      this.addImportantDate();
    }
  }

  private createImportantDateDraft(source?: ImportantDateItem): ImportantDateDraft {
    return {
      key: source?.id || crypto.randomUUID(),
      title: source?.title ?? '',
      startDate: source?.startDate ?? '',
      endDate: source?.endDate ?? '',
    };
  }

  private isImportantDateCompletelyEmpty(item: ImportantDateDraft): boolean {
    return [item.title, item.startDate, item.endDate].every((value) => !value.trim());
  }

  submitAssignmentDialog(): void {
    const dialog = this.assignmentDialog();
    if (dialog.kind === 'closed') return;
    this.busy.set(true);
    this.assignmentDialogError.set(null);
    this.errorChange.emit(null);

    const request$ =
      dialog.kind === 'create'
        ? this.assignmentsApi.create(
            this.employeeId,
            toEmploymentAssignmentWrite(this.assignmentForm, 'create'),
          )
        : this.assignmentsApi.update(
            this.employeeId,
            dialog.assignmentId,
            toEmploymentAssignmentWrite(this.assignmentForm, 'edit'),
          );

    request$.subscribe({
      next: (next) => {
        this.assignmentDialog.set(closeAssignmentDialog());
        this.applyProfile(next);
        this.profileChange.emit(next);
        this.busy.set(false);
        this.reloadAssignments();
      },
      error: (err) => {
        this.busy.set(false);
        const message = this.assignmentWriteError(
          err,
          dialog.kind === 'create'
            ? 'Не вдалося створити призначення'
            : 'Не вдалося оновити призначення',
        );
        this.assignmentDialogError.set(message);
        this.errorChange.emit(message);
      },
    });
  }

  deleteAssignment(h: AssignmentHistoryItem): void {
    if (!confirm('Видалити це призначення з історії?')) return;
    this.deletingAssignmentId.set(h.id);
    this.busy.set(true);
    this.errorChange.emit(null);
    this.assignmentsApi.remove(this.employeeId, h.id).subscribe({
      next: (next) => {
        this.applyProfile(next);
        this.profileChange.emit(next);
        this.deletingAssignmentId.set(null);
        this.busy.set(false);
        this.reloadAssignments();
      },
      error: (err) => {
        this.deletingAssignmentId.set(null);
        this.busy.set(false);
        this.errorChange.emit(
          this.assignmentWriteError(err, 'Не вдалося видалити призначення'),
        );
      },
    });
  }

  private reloadAssignments(): void {
    const employeeId = this.employeeId;
    this.assignmentsApi.listHistory(employeeId).subscribe({
      next: (rows) => {
        if (employeeId === this.employeeId) {
          this.historyAssignChange.emit(rows);
        }
      },
      error: (err) => {
        this.errorChange.emit(
          this.assignmentWriteError(err, 'Не вдалося оновити історію призначень'),
        );
      },
    });
  }
}
