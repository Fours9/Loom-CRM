import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api/api.service';
import { Department, Position, ScheduleDay, CreateEmployeePayload } from '../core/api/models';
import {
  defaultSchedule,
  normalizeSchedulePayload,
} from '../core/schedule/schedule.util';
import { ScheduleEditorComponent } from '../shared/schedule-editor.component';
import { PasswordVisibilityToggleComponent } from '../shared/password-visibility-toggle.component';
import { optionalOrgAssignmentIds } from './employee-org-assignment';
import { resolveAbsencesOrgDirectionLabel } from './absences-org-direction-label';

@Component({
  selector: 'app-employee-create-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    ScheduleEditorComponent,
    PasswordVisibilityToggleComponent,
  ],
  template: `
    <section class="page">
      <a routerLink="/absences/employees" class="back">← Назад</a>
      <div class="page-head">
        <h1>Новий працівник</h1>
        <button type="submit" form="create-employee" [disabled]="loading">Створити</button>
      </div>
      @if (error) {
        <p class="error page-error">{{ error }}</p>
      }
      <div class="layout">
        <form id="create-employee" class="card" (ngSubmit)="submit()">
          <div class="section-block section-static">
            <h3>Загальна інформація</h3>
            <div class="row row-3">
              <label>Прізвище <input [(ngModel)]="form.lastName" name="lastName" required /></label>
              <label>Ім'я <input [(ngModel)]="form.firstName" name="firstName" required /></label>
              <label>По батькові <input [(ngModel)]="form.middleName" name="middleName" /></label>
            </div>
            <div class="row row-1">
              <label class="color-field">
                Колір календаря
                <div class="color-edit">
                  <input type="color" [(ngModel)]="form.calendarColor" name="calendarColorPicker" />
                  <input
                    type="text"
                    [(ngModel)]="form.calendarColor"
                    name="calendarColorText"
                    placeholder="#2A6FDB"
                    maxlength="7"
                    (blur)="normalizeCalendarColor()"
                  />
                </div>
              </label>
            </div>
            <div class="row row-1">
              <label>
                Обліковий запис
                <select
                  [(ngModel)]="form.createAccount"
                  name="createAccount"
                  (ngModelChange)="onCreateAccountChange()"
                >
                  <option [ngValue]="true">Створити обліковий запис</option>
                  <option [ngValue]="false">Без облікового запису</option>
                </select>
              </label>
            </div>
            @if (form.createAccount) {
              <div class="row row-1">
                <label>
                  Тимчасовий пароль
                  <div class="password-row">
                    <input
                      [type]="showTemporaryPassword ? 'text' : 'password'"
                      [(ngModel)]="form.temporaryPassword"
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
                  </div>
                </label>
              </div>
            }
          </div>

          <details class="section-block disclose" open>
            <summary>Контакти</summary>
            <div class="disclose-body">
              @if (form.createAccount) {
                <div class="row row-1">
                  <label>
                    Email для входу
                    <input type="email" [(ngModel)]="form.email" name="email" required maxlength="254" />
                  </label>
                </div>
              }
              <div class="row row-1">
                <label>
                  Робочий email
                  <input type="email" [(ngModel)]="form.workEmail" name="workEmail" maxlength="254" />
                </label>
              </div>
              <div class="row row-2">
                <label>Телефон <input type="tel" [(ngModel)]="form.phoneNumber" name="phoneNumber" maxlength="64" /></label>
                <label>Telegram <input [(ngModel)]="form.telegram" name="telegram" placeholder="@username" maxlength="128" /></label>
              </div>

              <details class="nested-panel" open>
                <summary>Особисті контакти</summary>
                <div class="nested-panel-body">
                  <div class="row row-1">
                    <label>
                      Email
                      <input
                        type="email"
                        [(ngModel)]="form.personalEmail"
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
                        [(ngModel)]="form.personalPhoneNumber"
                        name="personalPhoneNumber"
                        maxlength="64"
                      />
                    </label>
                    <label>
                      Telegram
                      <input
                        [(ngModel)]="form.personalTelegram"
                        name="personalTelegram"
                        placeholder="@username"
                        maxlength="128"
                      />
                    </label>
                  </div>
                </div>
              </details>
            </div>
          </details>

          <details class="section-block disclose" open>
            <summary>Посада</summary>
            <div class="disclose-body">
              <div class="row row-2">
                <label>
                  Власний відділ
                  <select
                    [(ngModel)]="form.departmentId"
                    name="departmentId"
                    (ngModelChange)="onDepartmentChange($event)"
                  >
                    <option value="">Не вказано</option>
                    @for (d of departments; track d.id) {
                      <option [value]="d.id">{{ d.name }}</option>
                    }
                  </select>
                </label>
                <label>
                  Посада
                  <select
                    [(ngModel)]="form.positionId"
                    name="positionId"
                    (ngModelChange)="onPositionChange($event)"
                  >
                    <option value="">Не вказано</option>
                    @for (p of positions; track p.id) {
                      <option [value]="p.id">{{ p.name }}</option>
                    }
                  </select>
                </label>
              </div>
              <label>
                Напрямок
                <div class="value">{{ createDirectionName || '—' }}</div>
              </label>
            </div>
          </details>
        </form>

        <aside class="card schedule-card">
          <h2>Робочий графік</h2>
          <app-schedule-editor [days]="schedule" namePrefix="create_" />
        </aside>
      </div>
    </section>
  `,
  styles: [
    `
      .page { display: grid; gap: 1rem; max-width: 1100px; margin-inline: auto; width: 100%; }
      .back { color: var(--pw-accent); text-decoration: none; }
      .page-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .page-head h1 {
        margin: 0;
      }
      .page-head button {
        width: auto;
        min-width: 10rem;
        flex: 0 0 auto;
      }
      .page-error {
        margin: 0;
      }
      .layout {
        display: grid;
        gap: 1rem;
        grid-template-columns: 1fr;
        align-items: stretch;
        width: 100%;
      }
      @media (min-width: 900px) {
        .layout { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); }
      }
      .card {
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-width: 0;
        height: 100%;
      }
      .schedule-card h2 { margin: 0 0 0.35rem; font-size: 1.1rem; color: var(--pw-accent); }
      .section-block {
        margin: 0;
        padding-top: 0.95rem;
        border-top: 1px solid color-mix(in srgb, var(--pw-muted) 55%, transparent);
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
        background: var(--pw-surface-2);
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
        gap: 0.75rem;
        margin-top: 0.15rem;
      }
      .value {
        margin-top: 0.25rem;
        padding: 0.45rem 0.6rem;
        border-radius: 8px;
        border: 1px solid color-mix(in srgb, var(--pw-muted) 40%, transparent);
        background: var(--pw-surface-2, color-mix(in srgb, var(--pw-muted) 8%, var(--pw-surface)));
        color: var(--pw-text);
      }
      .rights-absence-stack {
        display: grid;
        gap: 0.55rem;
        align-content: start;
      }
      .rights-subsetting {
        display: grid;
        gap: 0.45rem;
        margin-left: 0.15rem;
        padding: 0.55rem 0.65rem;
        border-left: 3px solid color-mix(in srgb, var(--pw-accent) 55%, transparent);
        background: color-mix(in srgb, var(--pw-border) 35%, transparent);
        border-radius: 0 8px 8px 0;
      }
      .nested-caption {
        margin: 0;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--pw-muted);
      }
      .nested-panel {
        margin: 0.15rem 0 0;
        padding: 0.55rem 0.65rem;
        border: 1px solid color-mix(in srgb, var(--pw-muted) 40%, transparent);
        border-left: 3px solid color-mix(in srgb, var(--pw-accent) 55%, transparent);
        border-radius: 8px;
        background: var(--pw-surface-2, color-mix(in srgb, var(--pw-muted) 8%, var(--pw-surface)));
      }
      .nested-panel > summary {
        list-style: none;
        cursor: pointer;
        margin: 0;
        padding: 0.1rem 0;
        font-size: 0.9rem;
        font-weight: 600;
        letter-spacing: normal;
        text-transform: none;
        color: var(--pw-text-strong, inherit);
        display: flex;
        align-items: center;
        gap: 0.45rem;
        user-select: none;
      }
      .nested-panel > summary::-webkit-details-marker {
        display: none;
      }
      .nested-panel > summary::before {
        content: '▸';
        flex: 0 0 auto;
        color: var(--pw-muted);
        font-size: 0.85rem;
        line-height: 1;
        transition: transform 0.15s ease;
      }
      .nested-panel[open] > summary::before {
        transform: rotate(90deg);
        color: var(--pw-accent);
      }
      .nested-panel-body {
        display: grid;
        gap: 0.65rem;
        margin-top: 0.55rem;
        padding-top: 0.55rem;
        border-top: 1px solid color-mix(in srgb, var(--pw-muted) 35%, transparent);
      }
      .row {
        display: grid;
        gap: 0.75rem;
        width: 100%;
        min-width: 0;
      }
      .row-3, .row-2, .row-1 { grid-template-columns: minmax(0, 1fr); }
      @media (min-width: 641px) {
        .row-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .row-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      .row > label {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        min-width: 0;
      }
      fieldset { border: 1px solid var(--pw-border); border-radius: 8px; display: grid; gap: 0.75rem; min-width: 0; }
      .check-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0;
      }
      .check-row input { width: auto; }
      .password-row {
        display: flex;
        gap: 0.5rem;
        align-items: stretch;
      }
      .password-row input {
        flex: 1;
        min-width: 0;
      }
      input, select, button {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
        padding: 0.55rem 0.7rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border-strong);
      }
      input[type='color'] {
        width: 3rem;
        height: 2.4rem;
        padding: 0.2rem;
      }
      .color-field {
        width: fit-content;
        max-width: 100%;
      }
      .color-edit {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        width: fit-content;
      }
      .color-edit input[type='color'] {
        flex: 0 0 auto;
        width: 3rem;
      }
      .color-edit input[type='text'] {
        flex: 0 0 auto;
        width: 7.5rem;
        min-width: 0;
      }
      button { background: var(--pw-accent); color: var(--pw-on-accent); border: 0; cursor: pointer; }
      .error { color: var(--pw-danger); margin: 0; }
    `,
  ],
})
export class EmployeeCreatePageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  departments: Department[] = [];
  positions: Position[] = [];
  loading = false;
  error = '';
  showTemporaryPassword = false;
  schedule: ScheduleDay[] = defaultSchedule();

  form = {
    createAccount: true,
    lastName: '',
    firstName: '',
    middleName: '',
    email: '',
    workEmail: '',
    phoneNumber: '',
    telegram: '',
    personalEmail: '',
    personalPhoneNumber: '',
    personalTelegram: '',
    temporaryPassword: 'TempPass123!',
    departmentId: '',
    positionId: '',
    calendarColor: '#2A6FDB',
  };

  get createDirectionName(): string | null {
    return resolveAbsencesOrgDirectionLabel({
      departmentId: this.form.departmentId || null,
      positionId: this.form.positionId || null,
      departments: this.departments,
      positions: this.positions,
    });
  }

  ngOnInit(): void {
    this.api.getDepartments(true).subscribe((d) => (this.departments = d.filter((x) => x.isActive && !x.isHidden)));
    this.reloadPositions();
  }

  onCreateAccountChange(): void {
    if (!this.form.createAccount) {
      this.form.email = '';
      this.form.temporaryPassword = '';
    } else if (!this.form.temporaryPassword) {
      this.form.temporaryPassword = 'TempPass123!';
    }
  }

  onDepartmentChange(departmentId: string): void {
    this.form.departmentId = departmentId;
    this.form.positionId = '';
    this.reloadPositions();
  }

  onPositionChange(_positionId: string): void {
    // Triggers createDirectionName recompute via form.positionId binding.
  }

  normalizeCalendarColor(): void {
    const previous = '#2A6FDB';
    let value = (this.form.calendarColor || '').trim();
    if (!value) {
      this.form.calendarColor = previous;
      return;
    }
    if (!value.startsWith('#')) {
      value = `#${value}`;
    }
    if (/^#[0-9a-fA-F]{3}$/.test(value)) {
      value = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
    }
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      this.form.calendarColor = value.toUpperCase();
      return;
    }
    this.form.calendarColor = previous;
  }

  private reloadPositions(): void {
    if (this.form.departmentId) {
      this.api.getPositions(this.form.departmentId).subscribe((p) => (this.positions = p));
      return;
    }
    this.api.getPositions(undefined, false, true).subscribe((p) => (this.positions = p));
  }

  submit(): void {
    this.error = '';
    this.loading = true;
    const org = optionalOrgAssignmentIds({
      departmentId: this.form.departmentId,
      positionId: this.form.positionId,
    });
    const body: CreateEmployeePayload = {
      createAccount: this.form.createAccount,
      lastName: this.form.lastName,
      firstName: this.form.firstName,
      middleName: this.form.middleName || undefined,
      phoneNumber: this.form.phoneNumber || undefined,
      telegram: this.form.telegram || undefined,
      workEmail: this.form.workEmail || undefined,
      personalEmail: this.form.personalEmail || undefined,
      personalPhoneNumber: this.form.personalPhoneNumber || undefined,
      personalTelegram: this.form.personalTelegram || undefined,
      departmentId: org.departmentId,
      positionId: org.positionId,
      calendarColor: this.form.calendarColor,
      schedule: normalizeSchedulePayload(this.schedule),
    };
    if (this.form.createAccount) {
      body.email = this.form.email;
      body.temporaryPassword = this.form.temporaryPassword;
    }
    this.api.createEmployee(body).subscribe({
      next: (employee) => {
        this.loading = false;
        void this.router.navigate(['/absences/employees', employee.id]);
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.message;
        this.error = Array.isArray(msg) ? msg.join(', ') : msg || 'Не вдалося створити';
      },
    });
  }
}
