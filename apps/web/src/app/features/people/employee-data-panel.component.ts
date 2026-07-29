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
  EmployeeEmergencyContactItem,
  EmployeePersonalContactType,
  EmployeeProfileResponse,
  ImportantDateItem,
  NamedReference,
} from '@loom/contracts-employees';

type DataTabId = 'basics' | 'contacts' | 'dates' | 'position';

type EmergencyContactDraft = {
  key: string;
  fullName: string;
  relationship: string;
  primaryPhone: string;
  secondaryPhone: string;
  notes: string;
};

type PersonalContactDraft = {
  key: string;
  type: EmployeePersonalContactType;
  value: string;
  isPrimary: boolean;
};

type ImportantDateDraft = {
  key: string;
  title: string;
  startDate: string;
  endDate: string;
};

export type AssignmentHistoryItem = {
  id: string;
  status: string;
  companyId: string | null;
  directionId: string | null;
  departmentId: string | null;
  positionId: string | null;
  functionalRole: string | null;
  managerEmployeeId: string | null;
  mentorEmployeeId: string | null;
  hrResponsibleEmployeeId: string | null;
  workLocation: string | null;
  workFormat: string | null;
  employmentType: string | null;
  contractType: string | null;
  startDate: string | null;
  endDate: string | null;
  probationEndDate: string | null;
  changeReason: string | null;
  updatedAt?: string;
  department?: { id: string; name: string } | null;
  position?: { id: string; name: string } | null;
  company?: { id: string; name: string } | null;
  direction?: { id: string; name: string } | null;
};

@Component({
  selector: 'loom-employee-data-panel',
  standalone: true,
  imports: [FormsModule],
  template: `
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
  <button
    type="button"
    class="tab"
    role="tab"
    [attr.aria-selected]="dataTab() === 'position'"
    [class.active]="dataTab() === 'position'"
    (mousedown)="$event.preventDefault()"
    (click)="setDataTab('position')"
  >
    Посада
  </button>
</nav>

@if (dataTab() === 'basics') {
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

@if (dataTab() === 'contacts') {
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

  <div class="contacts-stack">
    <details
      class="section-block disclose"
      open
    >
      <summary>Робочі контакти</summary>
      <div class="disclose-body">
        @if (editingContacts() && profile.capabilities.canEditBasic) {
          <div class="personal-contact-groups">
            <div class="personal-contact-group">
              <div class="emergency-list">
                <fieldset class="emergency-row personal-contact-row">
                  <legend>Email</legend>
                  <div class="emergency-fields">
                    <label>
                      Значення
                      <input
                        [(ngModel)]="workContactsForm.workEmail"
                        name="wem"
                        type="email"
                        maxlength="320"
                      />
                    </label>
                  </div>
                </fieldset>
                <fieldset class="emergency-row personal-contact-row">
                  <legend>Телефон</legend>
                  <div class="emergency-fields">
                    <label>
                      Значення
                      <input
                        [(ngModel)]="workContactsForm.workPhone"
                        name="wph"
                        inputmode="tel"
                        maxlength="64"
                      />
                    </label>
                  </div>
                </fieldset>
                <fieldset class="emergency-row personal-contact-row">
                  <legend>Telegram</legend>
                  <div class="emergency-fields">
                    <label>
                      Значення
                      <input
                        [(ngModel)]="workContactsForm.workTelegram"
                        name="wtg"
                        maxlength="120"
                      />
                    </label>
                  </div>
                </fieldset>
              </div>
            </div>
          </div>
        } @else {
          <div class="personal-contact-group view">
            <div class="emergency-list">
              <div class="emergency-row view">
                <label>
                  Email
                  <div class="value">{{ profile.header.workEmail || '—' }}</div>
                </label>
              </div>
              <div class="emergency-row view">
                <label>
                  Телефон
                  <div class="value">{{ profile.header.workPhone || '—' }}</div>
                </label>
              </div>
              <div class="emergency-row view">
                <label>
                  Telegram
                  <div class="value">{{ profile.header.workTelegram || '—' }}</div>
                </label>
              </div>
            </div>
          </div>
        }
      </div>
    </details>

    @if (!profile.capabilities.canViewPersonal) {
      <div class="section-block">
        <h3>Особисті контакти</h3>
        <p class="muted">Немає доступу до особистих контактів.</p>
      </div>
    } @else {
      <details
        class="section-block disclose"
        [attr.open]="editingContacts() ? '' : null"
      >
        <summary>Особисті контакти</summary>
        <div class="disclose-body">
          @if (editingContacts() && profile.capabilities.canEditPersonal) {
            <div class="personal-contact-groups">
              @for (group of personalContactGroups; track group.type) {
                <div class="personal-contact-group">
                  <h4>{{ group.label }}</h4>
                  <div class="emergency-list">
                    @for (
                      contact of personalContactsOfType(group.type);
                      track contact.key;
                      let index = $index
                    ) {
                      <fieldset class="emergency-row personal-contact-row">
                        <legend>{{ group.label }} {{ index + 1 }}</legend>
                        <button
                          type="button"
                          class="icon-btn danger emergency-remove"
                          title="Прибрати"
                          [attr.aria-label]="'Прибрати ' + group.label + ' ' + (index + 1)"
                          (click)="removePersonalContact(contact.key)"
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                            <path
                              fill="currentColor"
                              d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h1v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h1a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9zm2 2h2v1h-2V5zm-2 4a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1zm6 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1z"
                            />
                          </svg>
                        </button>
                        <div class="emergency-fields">
                          <label>
                            Значення
                            <input
                              [(ngModel)]="contact.value"
                              [name]="'personalValue_' + contact.key"
                              [attr.inputmode]="group.inputMode"
                              maxlength="320"
                            />
                          </label>
                          <label class="primary-toggle">
                            <input
                              type="radio"
                              [name]="'personalPrimary_' + group.type"
                              [checked]="contact.isPrimary"
                              (change)="setPersonalContactPrimary(group.type, contact.key)"
                            />
                            Основний
                          </label>
                        </div>
                      </fieldset>
                    }
                  </div>
                  <div class="emergency-actions">
                    <button
                      type="button"
                      class="btn ghost"
                      [disabled]="personalContactsOfType(group.type).length >= 10"
                      (click)="addPersonalContact(group.type)"
                    >
                      + Додати {{ group.addLabel }}
                    </button>
                  </div>
                </div>
              }
            </div>
          } @else {
            @for (group of personalContactGroups; track group.type) {
              @if (personalContactsOfType(group.type, true).length > 0) {
                <div class="personal-contact-group view">
                  <h4>{{ group.label }}</h4>
                  <div class="emergency-list">
                    @for (
                      contact of personalContactsOfType(group.type, true);
                      track contact.key;
                      let index = $index
                    ) {
                      <div class="emergency-row view">
                        <label>
                          {{ group.label }} {{ index + 1 }}
                          @if (contact.isPrimary) {
                            <span class="primary-badge">основний</span>
                          }
                          <div class="value">{{ contact.value || '—' }}</div>
                        </label>
                      </div>
                    }
                  </div>
                </div>
              }
            }
            @if (!hasVisiblePersonalContacts()) {
              <p class="muted">Не вказано.</p>
            }
          }
        </div>
      </details>
    }

    @if (!profile.capabilities.canViewEmergencyContact) {
      <div class="section-block">
        <h3>Екстрений контакт</h3>
        <p class="muted">Немає доступу.</p>
      </div>
    } @else {
      <details
        class="section-block disclose"
        [attr.open]="editingContacts() ? '' : null"
      >
        <summary>Екстрені контакти</summary>
        <div class="disclose-body">
          @if (editingContacts() && profile.capabilities.canEditEmergencyContact) {
            <div class="emergency-list">
              @for (
                contact of emergencyForms;
                track contact.key;
                let index = $index
              ) {
                <fieldset class="emergency-row">
                  <legend>Екстрений контакт {{ index + 1 }}</legend>
                  <button
                    type="button"
                    class="icon-btn danger emergency-remove"
                    title="Прибрати контакт"
                    [attr.aria-label]="'Прибрати екстрений контакт ' + (index + 1)"
                    (click)="removeEmergencyContact(contact.key)"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h1v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h1a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9zm2 2h2v1h-2V5zm-2 4a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1zm6 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1z"
                      />
                    </svg>
                  </button>
                  <div class="emergency-fields">
                    <label>
                      ПІБ
                      <input
                        [(ngModel)]="contact.fullName"
                        [name]="'emergencyFullName_' + contact.key"
                        required
                        maxlength="255"
                      />
                    </label>
                    <label>
                      Зв'язок
                      <input
                        [(ngModel)]="contact.relationship"
                        [name]="'emergencyRelationship_' + contact.key"
                        maxlength="120"
                      />
                    </label>
                    <label>
                      Основний телефон
                      <input
                        [(ngModel)]="contact.primaryPhone"
                        [name]="'emergencyPrimaryPhone_' + contact.key"
                        inputmode="tel"
                        required
                        maxlength="64"
                      />
                    </label>
                    <label>
                      Додатковий телефон
                      <input
                        [(ngModel)]="contact.secondaryPhone"
                        [name]="'emergencySecondaryPhone_' + contact.key"
                        inputmode="tel"
                        maxlength="64"
                      />
                    </label>
                    <label class="emergency-notes">
                      Примітки
                      <textarea
                        [(ngModel)]="contact.notes"
                        [name]="'emergencyNotes_' + contact.key"
                        rows="2"
                        maxlength="5000"
                      ></textarea>
                    </label>
                  </div>
                </fieldset>
              }
            </div>
            <div class="emergency-actions">
              <button
                type="button"
                class="btn ghost"
                [disabled]="emergencyForms.length >= 5"
                (click)="addEmergencyContact()"
              >
                + Додати контакт
              </button>
            </div>
          } @else if ((profile.sections.emergencyContact?.length ?? 0) > 0) {
            <div class="emergency-list">
              @for (
                e of profile.sections.emergencyContact!;
                track e.id;
                let index = $index
              ) {
                <div class="emergency-row view">
                  <h4>Екстрений контакт {{ index + 1 }}</h4>
                  <div class="emergency-fields">
                    <label>
                      ПІБ
                      <div class="value">{{ e.fullName || '—' }}</div>
                    </label>
                    <label>
                      Зв'язок
                      <div class="value">{{ e.relationship || '—' }}</div>
                    </label>
                    <label>
                      Основний телефон
                      <div class="value">{{ e.primaryPhone || '—' }}</div>
                    </label>
                    @if (e.secondaryPhone) {
                      <label>
                        Додатковий телефон
                        <div class="value">{{ e.secondaryPhone }}</div>
                      </label>
                    }
                    @if (e.notes) {
                      <label class="emergency-notes">
                        Примітки
                        <div class="value">{{ e.notes }}</div>
                      </label>
                    }
                  </div>
                </div>
              }
            </div>
          } @else {
            <p class="muted">Не вказано.</p>
          }
        </div>
      </details>
    }
  </div>
}

@if (dataTab() === 'dates') {
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
            Немає активного призначення — спочатку створіть його у вкладці «Посада».
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

@if (dataTab() === 'position') {
  <div class="section-head">
    <h2>Посада</h2>
    @if (profile.capabilities.canEditEmployment) {
      <div class="section-actions">
        @if (creatingAssignment()) {
          <button type="button" class="btn" (click)="saveAssignment()" [disabled]="busy()">
            Зберегти
          </button>
          <button type="button" class="btn ghost" (click)="cancelCreatingAssignment()">
            Скасувати
          </button>
        } @else {
          <button type="button" class="btn ghost" (click)="startCreatingAssignment()">
            Нове призначення
          </button>
        }
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
    <div><dt>Кінець випроб.</dt><dd>{{ profile.sections.employment!.probationEndDate || '—' }}</dd></div>
  </dl>
} @else {
  <p class="muted">Призначення ще не задано.</p>
}

  @if (creatingAssignment() && profile.capabilities.canEditEmployment) {
    <div class="edit">
      <label>Формат роботи
        <select [(ngModel)]="assignmentForm.workFormat" name="wf">
          <option value="">—</option>
          <option value="office">Офіс</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
        </select>
      </label>
      <label>Локація <input [(ngModel)]="assignmentForm.workLocation" name="wl" /></label>
      <label>Тип зайнятості <input [(ngModel)]="assignmentForm.employmentType" name="et" /></label>
      <label>Дата початку <input type="date" [(ngModel)]="assignmentForm.startDate" name="sd" /></label>
      <label>Кінець випроб. <input type="date" [(ngModel)]="assignmentForm.probationEndDate" name="pe" /></label>
      <label>Причина зміни <input [(ngModel)]="assignmentForm.changeReason" name="cr" /></label>
    </div>
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
            </div>
            @if (profile.capabilities.canEditEmployment) {
              <div class="history-actions">
                @if (editingAssignmentId() === h.id) {
                  <button
                    type="button"
                    class="btn sm"
                    (click)="saveEditedAssignment(h)"
                    [disabled]="busy()"
                  >
                    Зберегти
                  </button>
                  <button type="button" class="btn ghost sm" (click)="cancelEditAssignment()">
                    Скасувати
                  </button>
                } @else {
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
                }
              </div>
            }
          </div>
          @if (editingAssignmentId() === h.id) {
            <div class="edit">
              <label>Формат роботи
                <select [(ngModel)]="editAssignmentForm.workFormat" name="ewf">
                  <option value="">—</option>
                  <option value="office">Офіс</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </label>
              <label>Локація <input [(ngModel)]="editAssignmentForm.workLocation" name="ewl" /></label>
              <label>Тип зайнятості <input [(ngModel)]="editAssignmentForm.employmentType" name="eet" /></label>
              <label>Початок <input type="date" [(ngModel)]="editAssignmentForm.startDate" name="esd" /></label>
              <label>Кінець <input type="date" [(ngModel)]="editAssignmentForm.endDate" name="eed" /></label>
              <label>Кінець випроб. <input type="date" [(ngModel)]="editAssignmentForm.probationEndDate" name="epe" /></label>
              <label>Причина <input [(ngModel)]="editAssignmentForm.changeReason" name="ecr" /></label>
            </div>
          }
        </li>
    }
  </ul>
  }
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

  @Input({ required: true }) employeeId!: string;
  @Input({ required: true }) profile!: EmployeeProfileResponse;
  @Input() historyAssign: AssignmentHistoryItem[] = [];

  @Output() readonly profileChange = new EventEmitter<EmployeeProfileResponse>();
  @Output() readonly historyAssignChange = new EventEmitter<AssignmentHistoryItem[]>();
  @Output() readonly errorChange = new EventEmitter<string | null>();

  readonly dataTab = signal<DataTabId>('basics');
  readonly editingBasics = signal(false);
  readonly editingContacts = signal(false);
  readonly editingDates = signal(false);
  readonly creatingAssignment = signal(false);
  readonly editingAssignmentId = signal<string | null>(null);
  readonly deletingAssignmentId = signal<string | null>(null);
  readonly busy = signal(false);

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
  personalContactForms: PersonalContactDraft[] = [];
  readonly personalContactGroups: Array<{
    type: EmployeePersonalContactType;
    label: string;
    addLabel: string;
    inputMode?: string;
  }> = [
    { type: 'personal_email', label: 'Email', addLabel: 'email', inputMode: 'email' },
    { type: 'personal_phone', label: 'Телефон', addLabel: 'телефон', inputMode: 'tel' },
    { type: 'personal_telegram', label: 'Telegram', addLabel: 'telegram' },
  ];
  workContactsForm = {
    workEmail: '',
    workPhone: '',
    workTelegram: '',
  };
  emergencyForms: EmergencyContactDraft[] = [];
  importantDateForms: ImportantDateDraft[] = [];
  assignmentForm = {
    workFormat: '',
    workLocation: '',
    employmentType: '',
    startDate: '',
    probationEndDate: '',
    changeReason: '',
  };
  editAssignmentForm = {
    workFormat: '',
    workLocation: '',
    employmentType: '',
    startDate: '',
    endDate: '',
    probationEndDate: '',
    changeReason: '',
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['profile'] && this.profile && !this.isEditing()) {
      this.applyProfile(this.profile);
    }
    if (changes['employeeId'] && !changes['employeeId'].firstChange) {
      this.dataTab.set('basics');
      this.resetEditingModes();
      if (this.profile) this.applyProfile(this.profile);
    }
  }

  private isEditing(): boolean {
    return (
      this.editingBasics() ||
      this.editingContacts() ||
      this.editingDates() ||
      this.creatingAssignment() ||
      this.editingAssignmentId() !== null
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
    this.emergencyForms = [];
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
    this.applyProfile(this.profile);
    this.hydrateEmergencyDrafts();
    this.hydratePersonalContactDrafts();
    this.errorChange.emit(null);
    this.editingContacts.set(true);
  }

  cancelContactsEditing(): void {
    this.applyProfile(this.profile);
    this.emergencyForms = [];
    this.personalContactForms = [];
    this.errorChange.emit(null);
    this.editingContacts.set(false);
  }

  startDatesEditing(): void {
    this.editingBasics.set(false);
    this.editingContacts.set(false);
    this.emergencyForms = [];
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

  addEmergencyContact(): void {
    if (this.emergencyForms.length >= 5) return;
    this.emergencyForms = [...this.emergencyForms, this.createEmergencyDraft()];
  }

  removeEmergencyContact(key: string): void {
    this.emergencyForms = this.emergencyForms.filter((contact) => contact.key !== key);
  }

  addPersonalContact(type: EmployeePersonalContactType): void {
    if (this.personalContactsOfType(type).length >= 10) return;
    this.personalContactForms = [
      ...this.personalContactForms,
      this.createPersonalContactDraft(type),
    ];
  }

  removePersonalContact(key: string): void {
    this.personalContactForms = this.personalContactForms.filter(
      (contact) => contact.key !== key,
    );
  }

  setPersonalContactPrimary(
    type: EmployeePersonalContactType,
    key: string,
  ): void {
    this.personalContactForms = this.personalContactForms.map((contact) => ({
      ...contact,
      isPrimary:
        contact.type === type
          ? contact.key === key
          : contact.isPrimary,
    }));
  }

  personalContactsOfType(
    type: EmployeePersonalContactType,
    fromProfile = false,
  ): PersonalContactDraft[] {
    if (fromProfile) {
      return this.profilePersonalContactDrafts(type);
    }
    return this.personalContactForms.filter((contact) => contact.type === type);
  }

  hasVisiblePersonalContacts(): boolean {
    return this.personalContactGroups.some(
      (group) => this.personalContactsOfType(group.type, true).length > 0,
    );
  }

  startCreatingAssignment(): void {
    this.editingBasics.set(false);
    this.editingContacts.set(false);
    this.editingDates.set(false);
    this.emergencyForms = [];
    this.importantDateForms = [];
    this.editingAssignmentId.set(null);
    this.creatingAssignment.set(true);
  }

  cancelCreatingAssignment(): void {
    this.creatingAssignment.set(false);
  }

  startEditAssignment(h: AssignmentHistoryItem): void {
    this.creatingAssignment.set(false);
    this.editingAssignmentId.set(h.id);
    this.editAssignmentForm = {
      workFormat: h.workFormat || '',
      workLocation: h.workLocation || '',
      employmentType: h.employmentType || '',
      startDate: h.startDate || '',
      endDate: h.endDate || '',
      probationEndDate: h.probationEndDate || '',
      changeReason: h.changeReason || '',
    };
  }

  cancelEditAssignment(): void {
    this.editingAssignmentId.set(null);
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      draft: 'Чернетка',
      candidate: 'Кандидат',
      preboarding: 'Preboarding',
      probation: 'Випробувальний',
      active: 'Активний',
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

  private resetEditingModes(): void {
    this.editingBasics.set(false);
    this.editingContacts.set(false);
    this.editingDates.set(false);
    this.emergencyForms = [];
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
    this.creatingAssignment.set(false);
    this.editingAssignmentId.set(null);
    this.deletingAssignmentId.set(null);
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
    this.workContactsForm = {
      workEmail: p.header.workEmail ?? '',
      workPhone: p.header.workPhone ?? '',
      workTelegram: p.header.workTelegram ?? '',
    };
    const emp = p.sections.employment;
    this.assignmentForm = {
      workFormat: emp?.workFormat ?? '',
      workLocation: emp?.workLocation ?? '',
      employmentType: emp?.employmentType ?? '',
      startDate: '',
      probationEndDate: '',
      changeReason: '',
    };
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
          this.http.patch(
            `/api/v1/employees/${this.employeeId}/employment-assignments/${assignmentId}`,
            { startDate: this.hiredAtForm.trim() || null },
          ),
        );
      } else if (this.hiredAtForm.trim()) {
        this.errorChange.emit(
          'Немає активного призначення для дати початку роботи. Створіть його у вкладці «Посада».',
        );
        return;
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

    let emergencyContacts:
      | Array<{
          fullName: string;
          relationship: string | null;
          primaryPhone: string;
          secondaryPhone: string | null;
          notes: string | null;
        }>
      | null = null;

    if (caps.canEditEmergencyContact) {
      const contacts = this.emergencyForms
        .filter((contact) => !this.isEmergencyContactCompletelyEmpty(contact))
        .map((contact) => ({
          fullName: contact.fullName.trim(),
          relationship: contact.relationship.trim() || null,
          primaryPhone: contact.primaryPhone.trim(),
          secondaryPhone: contact.secondaryPhone.trim() || null,
          notes: contact.notes.trim() || null,
        }));

      const invalid = contacts.some(
        (contact) => !contact.fullName || !contact.primaryPhone,
      );
      if (invalid) {
        this.errorChange.emit(
          'Для кожного екстреного контакту вкажіть ПІБ і основний телефон.',
        );
        return;
      }

      emergencyContacts = contacts;
    }

    this.errorChange.emit(null);
    this.busy.set(true);

    const requests = [];
    if (caps.canEditBasic) {
      requests.push(
        this.http.patch(`/api/v1/employees/${this.employeeId}/contacts`, {
          workEmail: this.workContactsForm.workEmail || null,
          workPhone: this.workContactsForm.workPhone || null,
          workTelegram: this.workContactsForm.workTelegram || null,
        }),
      );
    }
    if (caps.canEditPersonal) {
      const contacts = this.personalContactForms
        .filter((contact) => contact.value.trim())
        .map((contact) => ({
          type: contact.type,
          value: contact.value.trim(),
          isPrimary: contact.isPrimary,
        }));

      requests.push(
        this.http.put(`/api/v1/employees/${this.employeeId}/personal-contacts`, {
          contacts,
        }),
      );
    }
    if (emergencyContacts !== null) {
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
        this.emergencyForms = [];
        this.personalContactForms = [];
        this.editingContacts.set(false);
        this.busy.set(false);
      },
      error: () => {
        this.errorChange.emit('Не вдалося зберегти контакти');
        this.busy.set(false);
      },
    });
  }

  private hydratePersonalContactDrafts(): void {
    const fromContacts =
      this.profile?.sections.contacts.filter((contact) =>
        contact.type.startsWith('personal_'),
      ) ?? [];

    if (fromContacts.length) {
      this.personalContactForms = fromContacts.map((contact) =>
        this.createPersonalContactDraft(
          contact.type as EmployeePersonalContactType,
          contact,
        ),
      );
      return;
    }

    const pers = this.profile?.sections.personal;
    const legacy: Array<{
      type: EmployeePersonalContactType;
      value: string | null | undefined;
    }> = [
      { type: 'personal_email', value: pers?.personalEmail },
      { type: 'personal_phone', value: pers?.personalPhone },
      { type: 'personal_telegram', value: pers?.personalTelegram },
    ];

    this.personalContactForms = legacy
      .filter((item) => Boolean(item.value?.trim()))
      .map((item) =>
        this.createPersonalContactDraft(item.type, {
          value: item.value!.trim(),
          isPrimary: true,
        }),
      );
  }

  private profilePersonalContactDrafts(
    type: EmployeePersonalContactType,
  ): PersonalContactDraft[] {
    const fromContacts =
      this.profile?.sections.contacts.filter((contact) => contact.type === type) ??
      [];

    if (fromContacts.length) {
      return fromContacts.map((contact) =>
        this.createPersonalContactDraft(type, contact),
      );
    }

    const pers = this.profile?.sections.personal;
    const fallbackByType: Record<EmployeePersonalContactType, string | null | undefined> = {
      personal_phone: pers?.personalPhone,
      personal_email: pers?.personalEmail,
      personal_telegram: pers?.personalTelegram,
    };
    const value = fallbackByType[type];
    if (!value?.trim()) return [];

    return [
      this.createPersonalContactDraft(type, {
        value: value.trim(),
        isPrimary: true,
      }),
    ];
  }

  private createPersonalContactDraft(
    type: EmployeePersonalContactType,
    source?: { id?: string; value?: string; isPrimary?: boolean },
  ): PersonalContactDraft {
    return {
      key: source?.id || crypto.randomUUID(),
      type,
      value: source?.value ?? '',
      isPrimary: source?.isPrimary ?? false,
    };
  }

  private hydrateEmergencyDrafts(): void {
    const source = this.profile?.sections.emergencyContact ?? [];
    this.emergencyForms = source.map((contact) => this.createEmergencyDraft(contact));
    if (!this.emergencyForms.length) {
      this.addEmergencyContact();
    }
  }

  private hydrateImportantDateDrafts(): void {
    const source = this.profile?.sections.importantDates ?? [];
    this.importantDateForms = source.map((item) => this.createImportantDateDraft(item));
    if (!this.importantDateForms.length) {
      this.addImportantDate();
    }
  }

  private createEmergencyDraft(
    source?: EmployeeEmergencyContactItem,
  ): EmergencyContactDraft {
    return {
      key: source?.id || crypto.randomUUID(),
      fullName: source?.fullName ?? '',
      relationship: source?.relationship ?? '',
      primaryPhone: source?.primaryPhone ?? '',
      secondaryPhone: source?.secondaryPhone ?? '',
      notes: source?.notes ?? '',
    };
  }

  private createImportantDateDraft(source?: ImportantDateItem): ImportantDateDraft {
    return {
      key: source?.id || crypto.randomUUID(),
      title: source?.title ?? '',
      startDate: source?.startDate ?? '',
      endDate: source?.endDate ?? '',
    };
  }

  private isEmergencyContactCompletelyEmpty(contact: EmergencyContactDraft): boolean {
    return [
      contact.fullName,
      contact.relationship,
      contact.primaryPhone,
      contact.secondaryPhone,
      contact.notes,
    ].every((value) => !value.trim());
  }

  private isImportantDateCompletelyEmpty(item: ImportantDateDraft): boolean {
    return [item.title, item.startDate, item.endDate].every((value) => !value.trim());
  }

  saveAssignment(): void {
    const p = this.profile;
    this.busy.set(true);
    this.http
      .post(`/api/v1/employees/${this.employeeId}/employment-assignments`, {
        departmentId: p?.sections.employment?.departmentId ?? null,
        positionId: p?.sections.employment?.positionId ?? null,
        companyId: p?.sections.employment?.companyId ?? null,
        directionId: p?.sections.employment?.directionId ?? null,
        workFormat: this.assignmentForm.workFormat || null,
        workLocation: this.assignmentForm.workLocation || null,
        employmentType: this.assignmentForm.employmentType || null,
        startDate: this.assignmentForm.startDate || null,
        probationEndDate: this.assignmentForm.probationEndDate || null,
        changeReason: this.assignmentForm.changeReason || null,
      })
      .subscribe({
        next: (res) => {
          const next = res as EmployeeProfileResponse;
          this.applyProfile(next);
          this.profileChange.emit(next);
          this.creatingAssignment.set(false);
          this.busy.set(false);
          this.reloadAssignments();
        },
        error: () => this.busy.set(false),
      });
  }

  saveEditedAssignment(h: AssignmentHistoryItem): void {
    this.busy.set(true);
    this.http
      .patch(`/api/v1/employees/${this.employeeId}/employment-assignments/${h.id}`, {
        workFormat: this.editAssignmentForm.workFormat || null,
        workLocation: this.editAssignmentForm.workLocation || null,
        employmentType: this.editAssignmentForm.employmentType || null,
        startDate: this.editAssignmentForm.startDate || null,
        endDate: this.editAssignmentForm.endDate || null,
        probationEndDate: this.editAssignmentForm.probationEndDate || null,
        changeReason: this.editAssignmentForm.changeReason || null,
      })
      .subscribe({
        next: (res) => {
          const next = res as EmployeeProfileResponse;
          this.applyProfile(next);
          this.profileChange.emit(next);
          this.editingAssignmentId.set(null);
          this.busy.set(false);
          this.reloadAssignments();
        },
        error: () => this.busy.set(false),
      });
  }

  deleteAssignment(h: AssignmentHistoryItem): void {
    if (!confirm('Видалити це призначення з історії?')) return;
    this.deletingAssignmentId.set(h.id);
    this.busy.set(true);
    this.http
      .delete(`/api/v1/employees/${this.employeeId}/employment-assignments/${h.id}`)
      .subscribe({
        next: (res) => {
          const next = res as EmployeeProfileResponse;
          this.applyProfile(next);
          this.profileChange.emit(next);
          this.deletingAssignmentId.set(null);
          this.busy.set(false);
          this.reloadAssignments();
        },
        error: () => {
          this.deletingAssignmentId.set(null);
          this.busy.set(false);
        },
      });
  }

  private reloadAssignments(): void {
    const employeeId = this.employeeId;
    this.http
      .get<AssignmentHistoryItem[]>(`/api/v1/employees/${employeeId}/employment-history`)
      .subscribe({
        next: (rows) => {
          if (employeeId === this.employeeId) {
            this.historyAssignChange.emit(rows);
          }
        },
      });
  }
}
