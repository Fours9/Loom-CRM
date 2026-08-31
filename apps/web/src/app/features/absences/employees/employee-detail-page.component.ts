import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api/api.service';
import { EmployeeProfile, AbsenceRequestListItem, ScheduleDay } from '../core/api/models';
import { AuthService } from '../core/auth/auth.service';
import { roleDisplayLabel } from '../core/api/labels';
import {
  requestEventLabel,
  requestPeriod,
  requestTypeLabel,
} from '../core/api/request-view.util';
import {
  cloneSchedule,
  normalizeSchedulePayload,
} from '../core/schedule/schedule.util';
import { RequestStatusBadgeComponent } from '../shared/request-status-badge.component';
import { requestFrameTone } from '../shared/request-status-presentation';
import { ScheduleEditorComponent } from '../shared/schedule-editor.component';
import { buildCreateAbsenceRequestLink } from '../requests/create-request-navigation';
import { PERSON_AVATAR_PATH } from '../../../shared/icons/person-avatar-icon';

@Component({
  selector: 'app-employee-detail-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    ScheduleEditorComponent,
    RequestStatusBadgeComponent,
  ],
  template: `
    @if (employee) {
      <section class="page">
        <a routerLink="/absences/employees" class="back">← До списку</a>
        <header class="hero">
          <div class="avatar" aria-hidden="true">
            @if (employee.photoUrl) {
              <img [src]="employee.photoUrl" alt="" />
            } @else {
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path fill="currentColor" [attr.d]="personAvatarPath" />
              </svg>
            }
          </div>
          <div class="hero-main">
            <div class="hero-row">
              <h1>{{ employee.fullName }}</h1>
              @if (employee.permissions?.canExportProfilePdf) {
                <button type="button" class="ghost-btn" (click)="downloadPdf()" [disabled]="pdfLoading">
                  {{ pdfLoading ? 'Формування…' : 'Завантажити PDF' }}
                </button>
              }
            </div>
            <div class="hero-row hero-meta">
              <p>#{{ employee.employeeNumber }} · {{ heroOrgMeta }}</p>
              @if (!editingProfile && employee.permissions?.canEditProfile) {
                <button type="button" class="ghost-btn" (click)="startEdit()">Редагувати</button>
              }
              @if (editingProfile) {
                <div class="edit-actions">
                  <button type="button" (click)="save()">Зберегти</button>
                  <button type="button" class="secondary" (click)="cancelEdit()">Скасувати</button>
                </div>
              }
            </div>
          </div>
        </header>

        @if (message) {
          <p class="ok banner-msg">{{ message }}</p>
        }
        @if (error) {
          <p class="error banner-msg">{{ error }}</p>
        }

        <div class="grid">
          <div class="col">
            <article class="card">
              <div class="card-head">
                <h2>Анкета</h2>
                @if (!editingProfile) {
                  <a class="ghost-btn" [routerLink]="['/people', employee.id]">Профіль Loom</a>
                }
              </div>

              @if (!editingProfile) {
                <div class="fields">
                  <p class="muted">{{ accountStatusLabel(employee) }}</p>

                  <div class="row row-2">
                    <label>
                      Номер
                      <div class="value">{{ employee.employeeNumber }}</div>
                    </label>
                    <label>
                      Колір
                      <div class="value color-value">
                        <span class="swatch-sm" [style.background]="employee.calendarColor"></span>
                        {{ employee.calendarColor }}
                      </div>
                    </label>
                  </div>

                  <div class="row row-3">
                    <label>
                      Прізвище
                      <div class="value">{{ employee.lastName }}</div>
                    </label>
                    <label>
                      Ім'я
                      <div class="value">{{ employee.firstName }}</div>
                    </label>
                    <label>
                      По батькові
                      <div class="value">{{ employee.middleName || '—' }}</div>
                    </label>
                  </div>

                  <div class="section-block">
                    <h3>Контакти</h3>
                    <label>
                      Робочий email
                      <div class="value">{{ employee.workEmail || '—' }}</div>
                    </label>
                    @if (!employee.hasAccount) {
                      <p class="muted">Обліковий запис не створено</p>
                    }
                    <div class="row row-2">
                      <label>
                        Телефон
                        <div class="value">{{ employee.phoneNumber || '—' }}</div>
                      </label>
                      <label>
                        Telegram
                        <div class="value">{{ employee.telegram || '—' }}</div>
                      </label>
                    </div>

                    @if (employee.permissions?.canViewPersonalContacts) {
                      <details class="nested-panel">
                        <summary>Особисті контакти</summary>
                        <div class="nested-panel-body">
                          <label>
                            Email
                            <div class="value">{{ employee.personalEmail || '—' }}</div>
                          </label>
                          <div class="row row-2">
                            <label>
                              Телефон
                              <div class="value">{{ employee.personalPhoneNumber || '—' }}</div>
                            </label>
                            <label>
                              Telegram
                              <div class="value">{{ employee.personalTelegram || '—' }}</div>
                            </label>
                          </div>
                        </div>
                      </details>
                    }
                  </div>

                  <div class="section-block">
                    <h3>Посада</h3>
                    <label>
                      Напрямок
                      <div class="value">{{ employee.directionName || '—' }}</div>
                    </label>
                    <div class="row row-2">
                      <label>
                        Відділ
                        <div class="value">{{ employee.departmentName || '—' }}</div>
                      </label>
                      <label>
                        Посада
                        <div class="value">{{ employee.positionName || '—' }}</div>
                      </label>
                    </div>
                    <label>
                      Роль
                      <div class="value">{{ roleLabel(employee.role, employee.isDepartmentManager) }}</div>
                    </label>
                  </div>
                </div>
              } @else {
                <div class="edit">
                  <p class="muted">{{ accountStatusLabel(employee) }}</p>
                  @if (isAdmin) {
                    <div class="row row-2">
                      <label>Номер <input [(ngModel)]="edit.employeeNumber" /></label>
                      <label>
                        Колір
                        <div class="color-edit">
                          <input type="color" [(ngModel)]="edit.calendarColor" name="calendarColorPicker" />
                          <input
                            type="text"
                            [(ngModel)]="edit.calendarColor"
                            name="calendarColorText"
                            placeholder="#2A6FDB"
                            maxlength="7"
                            (blur)="normalizeCalendarColor()"
                          />
                        </div>
                      </label>
                    </div>
                  } @else {
                    <div class="row row-2">
                      <p><strong>Номер:</strong> {{ employee.employeeNumber }}</p>
                      <p><strong>Колір:</strong> {{ employee.calendarColor }}</p>
                    </div>
                  }
                  <div class="row row-3">
                    <label>Прізвище <input [(ngModel)]="edit.lastName" /></label>
                    <label>Ім'я <input [(ngModel)]="edit.firstName" /></label>
                    <label>По батькові <input [(ngModel)]="edit.middleName" /></label>
                  </div>
                  <div class="section-block">
                    <h3>Контакти</h3>
                    @if (isAdmin) {
                      <label>
                        Робочий email
                        <input
                          type="email"
                          name="workEmail"
                          [(ngModel)]="edit.workEmail"
                          maxlength="254"
                          autocomplete="off"
                        />
                      </label>
                    } @else {
                      <p><strong>Робочий email:</strong> {{ employee.workEmail || '—' }}</p>
                    }
                    <div class="row row-2">
                      <label>
                        Телефон
                        <input
                          type="text"
                          inputmode="tel"
                          name="workPhoneNumber"
                          [(ngModel)]="edit.phoneNumber"
                          maxlength="64"
                          autocomplete="off"
                        />
                      </label>
                      <label>
                        Telegram
                        <input
                          type="text"
                          name="workTelegram"
                          [(ngModel)]="edit.telegram"
                          placeholder="@username або t.me/…"
                          maxlength="128"
                          autocomplete="off"
                        />
                      </label>
                    </div>
                    @if (employee.permissions?.canEditPersonalContacts) {
                      <details class="nested-panel" open>
                        <summary>Особисті контакти</summary>
                        <div class="nested-panel-body">
                          <label>
                            Email
                            <input
                              type="email"
                              name="personalEmail"
                              [(ngModel)]="edit.personalEmail"
                              maxlength="254"
                              autocomplete="off"
                            />
                          </label>
                          <div class="row row-2">
                            <label>
                              Телефон
                              <input
                                type="text"
                                inputmode="tel"
                                name="personalPhoneNumber"
                                [(ngModel)]="edit.personalPhoneNumber"
                                maxlength="64"
                                autocomplete="off"
                              />
                            </label>
                            <label>
                              Telegram
                              <input
                                type="text"
                                name="personalTelegram"
                                [(ngModel)]="edit.personalTelegram"
                                placeholder="@username"
                                maxlength="128"
                                autocomplete="off"
                              />
                            </label>
                          </div>
                        </div>
                      </details>
                    }
                  </div>
                  <div class="section-block">
                    <h3>Посада</h3>
                    <label>
                      Напрямок
                      <div class="value">{{ employee.directionName || '—' }}</div>
                    </label>
                    <div class="row row-2">
                      <label>
                        Відділ
                        <div class="value">{{ employee.departmentName || '—' }}</div>
                      </label>
                      <label>
                        Посада
                        <div class="value">{{ employee.positionName || '—' }}</div>
                      </label>
                    </div>
                    <p><strong>Роль:</strong> {{ roleLabel(employee.role, employee.isDepartmentManager) }}</p>
                  </div>
                </div>
              }
            </article>
          </div>

          <div class="col side-col">
            <details class="card side-tools" open>
              <summary class="side-tools-summary">
                <div class="panel-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    class="tab-btn"
                    [class.active]="sidePanel === 'schedule'"
                    (click)="sidePanel = 'schedule'; $event.preventDefault(); $event.stopPropagation()"
                  >
                    Графік
                  </button>
                  @if (employee.permissions?.canViewComment) {
                    <button
                      type="button"
                      role="tab"
                      class="tab-btn"
                      [class.active]="sidePanel === 'comment'"
                      (click)="sidePanel = 'comment'; $event.preventDefault(); $event.stopPropagation()"
                    >
                      Коментар
                    </button>
                  }
                  <button
                    type="button"
                    role="tab"
                    class="tab-btn"
                    [class.active]="sidePanel === 'requests'"
                    (click)="sidePanel = 'requests'; $event.preventDefault(); $event.stopPropagation()"
                  >
                    Заявки
                  </button>
                </div>
              </summary>
              <div class="side-tools-body" [attr.data-panel]="sidePanel">
                @if (sidePanel === 'schedule') {
                  @if (editingProfile && employee.permissions?.canEditSchedule) {
                    <app-schedule-editor [days]="editSchedule" namePrefix="edit_" />
                  } @else {
                    <app-schedule-editor [days]="employee.schedule" [readonly]="true" />
                  }
                } @else if (sidePanel === 'comment' && employee.permissions?.canViewComment) {
                  @if (editingProfile && employee.permissions?.canEditComment) {
                    <label>
                      Коментар
                      <textarea
                        [(ngModel)]="edit.comment"
                        rows="4"
                        maxlength="5000"
                        placeholder="Питання, з якими можна звертатися…"
                      ></textarea>
                      <span class="muted char-count">{{ (edit.comment || '').length }} / 5000</span>
                    </label>
                    @if (employee.permissions?.canEditAdminComment) {
                      <details class="disclose admin-comment-disclose">
                        <summary>Адмінський коментар</summary>
                        <div class="disclose-body">
                          <label>
                            <textarea
                              [(ngModel)]="edit.adminComment"
                              rows="3"
                              maxlength="5000"
                              placeholder="Лише для адміністраторів, не потрапляє в PDF"
                            ></textarea>
                            <span class="muted char-count">{{ (edit.adminComment || '').length }} / 5000</span>
                          </label>
                        </div>
                      </details>
                    }
                  } @else {
                    <h3>Коментар</h3>
                    <div class="value pre">{{ employee.comment || '—' }}</div>
                    @if (employee.permissions?.canViewAdminComment) {
                      <details class="disclose admin-comment-disclose">
                        <summary>Адмінський коментар</summary>
                        <div class="disclose-body">
                          <div class="value pre">{{ employee.adminComment || '—' }}</div>
                        </div>
                      </details>
                    }
                  }
                } @else {
                  <div class="card-head req-actions">
                    <a
                      class="btn"
                      [routerLink]="createRequestLink.routerLink"
                      [queryParams]="createRequestLink.queryParams"
                    >
                      Нова заявка
                    </a>
                  </div>
                  @if (requests.length === 0) {
                    <p class="muted">Заявок ще немає</p>
                  } @else {
                    <div class="req-scroll">
                      <ul class="req-list">
                        @for (r of requests; track r.id) {
                          <li
                            [routerLink]="['/absences/requests', r.id]"
                            class="req-row pw-request-frame"
                            [attr.data-frame]="frameTone(r.statusGroup)"
                          >
                            <div class="req-main">
                              <strong class="req-type">{{ requestTypeLabel(r.type) }}</strong>
                              <span class="muted req-event">{{ requestEventLabel(r) }}</span>
                            </div>
                            <div class="req-meta">
                              <span class="req-period">{{ requestPeriod(r) }}</span>
                              <app-request-status-badge [status]="r.statusGroup" />
                            </div>
                          </li>
                        }
                      </ul>
                    </div>
                  }
                }
              </div>
            </details>
          </div>
        </div>
        @if (message) { <p class="ok">{{ message }}</p> }
        @if (error) { <p class="error">{{ error }}</p> }
      </section>
    } @else if (error) {
      <p class="error">{{ error }}</p>
    } @else {
      <p>Завантаження…</p>
    }
  `,
  styles: [
    `
      .page { display: grid; gap: 1rem; max-width: 56rem; margin-inline: auto; width: 100%; }
      .back { color: var(--pw-accent); text-decoration: none; }
      .hero { display: flex; flex-direction: column; gap: 1rem; align-items: flex-start; }
      @media (min-width: 641px) {
        .hero { flex-direction: row; align-items: center; flex-wrap: wrap; }
      }
      .hero-main { flex: 1; min-width: 0; display: grid; gap: 0.25rem; }
      .hero-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
        min-width: 0;
      }
      .hero-row h1 {
        margin: 0;
        min-width: 0;
      }
      .hero-meta p {
        margin: 0;
        color: var(--pw-muted);
        min-width: 0;
      }
      .hero-row .ghost-btn {
        flex: 0 0 auto;
      }
      .banner-msg {
        margin: 0 0 0.75rem;
      }
      .section-block {
        margin-top: 0.85rem;
        padding-top: 0.95rem;
        border-top: 1px solid color-mix(in srgb, var(--pw-muted) 55%, transparent);
        display: grid;
        gap: 0.6rem;
      }
      .section-block h3,
      .card h3 {
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
        margin: 0;
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
        padding: 0.35rem 0.45rem;
        margin: -0.35rem -0.45rem;
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
        gap: 0.6rem;
        margin-top: 0.6rem;
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
      .admin-comment-disclose {
        margin-top: 0.85rem;
        padding-top: 0.85rem;
        border-top: 1px solid color-mix(in srgb, var(--pw-muted) 55%, transparent);
      }
      .account-action-disclose + .account-action-disclose,
      .account-action-disclose + button {
        margin-top: 0.85rem;
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
      textarea {
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        resize: vertical;
        min-height: 4.5rem;
      }
      .char-count { font-size: 0.8rem; }
      .value.pre { white-space: pre-wrap; }
      .swatch { width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--pw-border); }
      .avatar {
        width: 56px;
        height: 56px;
        border-radius: 14px;
        border: 1px solid var(--pw-border);
        background: color-mix(in srgb, var(--pw-muted) 18%, transparent);
        color: var(--pw-muted);
        display: grid;
        place-items: center;
        overflow: hidden;
        flex: 0 0 auto;
      }
      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .grid { display: grid; gap: 1rem; grid-template-columns: 1fr; align-items: stretch; }
      @media (min-width: 900px) {
        .grid { grid-template-columns: 1fr 1fr; }
      }
      .col { display: grid; gap: 1rem; align-content: start; min-width: 0; }
      .side-col {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-width: 0;
        min-height: 0;
        align-self: stretch;
      }
      .card.side-tools {
        flex: 1 1 auto;
        min-height: 0;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .side-tools-summary {
        list-style: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        user-select: none;
        flex: 0 0 auto;
      }
      .side-tools-summary .panel-tabs {
        flex: 1 1 auto;
        min-width: 0;
      }
      .side-tools-summary::-webkit-details-marker { display: none; }
      .side-tools-summary::after {
        content: '▾';
        flex: 0 0 auto;
        width: 1.6rem;
        height: 1.6rem;
        display: grid;
        place-items: center;
        border-radius: 6px;
        border: 1px solid color-mix(in srgb, var(--pw-muted) 55%, transparent);
        background: var(--pw-surface-2);
        font-size: 1.05rem;
        line-height: 1;
        transform: rotate(-90deg);
        transition: transform 0.15s ease, background 0.15s ease;
      }
      .side-tools[open] > .side-tools-summary::after {
        transform: rotate(0deg);
        background: var(--pw-accent-soft);
        border-color: var(--pw-accent);
        color: var(--pw-accent);
      }
      .side-tools-body {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        margin-top: 0.75rem;
        overflow: visible;
      }
      .side-tools-body[data-panel='schedule'],
      .side-tools-body[data-panel='requests'] {
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
      }
      .side-tools-body[data-panel='schedule'] > app-schedule-editor {
        flex: 1 1 auto;
        min-height: 0;
        overflow-x: hidden;
        overflow-y: auto;
      }
      .side-tools-body[data-panel='requests'] .req-scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow-x: hidden;
        overflow-y: auto;
      }
      .card { background: var(--pw-surface); border: 1px solid var(--pw-border); border-radius: 12px; padding: 1rem; display: grid; gap: 0.6rem; }
      .rights-absence-stack { display: grid; gap: 0.55rem; align-content: start; }
      .rights-subsetting {
        display: grid;
        gap: 0.45rem;
        margin-left: 0.15rem;
        padding: 0.55rem 0.65rem;
        border-left: 3px solid color-mix(in srgb, var(--pw-accent) 55%, transparent);
        background: color-mix(in srgb, var(--pw-border) 35%, transparent);
        border-radius: 0 8px 8px 0;
      }
      .nested-caption { margin: 0; font-size: 0.8rem; font-weight: 600; color: var(--pw-muted); }
      .edit { display: grid; gap: 0.6rem; margin-top: 0.5rem; min-width: 0; }
      .row { display: grid; gap: 0.6rem; min-width: 0; width: 100%; }
      .row-3, .row-2 { grid-template-columns: minmax(0, 1fr); }
      @media (min-width: 641px) {
        .row-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .row-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      .row > label,
      .edit > label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.9rem;
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
      .color-edit {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        min-width: 0;
      }
      .color-edit input[type='color'] {
        flex: 0 0 auto;
      }
      .color-edit input[type='text'] {
        flex: 1 1 auto;
        min-width: 0;
      }
      button { background: var(--pw-accent); color: var(--pw-on-accent); border: 0; cursor: pointer; }
      .danger { background: var(--pw-danger); }
      .muted { color: var(--pw-muted); margin: 0; }
      .managed-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.35rem;
      }
      .managed-list li {
        padding: 0.55rem 0.7rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        background: var(--pw-surface-2);
      }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      select:disabled { opacity: 0.6; background: var(--pw-surface-2); }
      .error { color: var(--pw-danger); } .ok { color: #027a48; }
      .card-head {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
        flex-wrap: wrap;
      }
      .card-head h2 { margin: 0; }
      .card-head .ghost-btn {
        flex: 0 0 auto;
        margin-left: auto;
      }
      .req-actions {
        justify-content: flex-end;
      }
      .panel-tabs {
        display: flex;
        gap: 0.25rem;
        flex-wrap: wrap;
      }
      .tab-btn {
        width: auto;
        border: 1px solid var(--pw-border);
        background: transparent;
        color: var(--pw-muted);
        border-radius: 8px;
        padding: 0.35rem 0.75rem;
        cursor: pointer;
        font: inherit;
        font-size: 0.95rem;
      }
      .tab-btn.active {
        color: var(--pw-text, inherit);
        border-color: var(--pw-accent);
        background: color-mix(in srgb, var(--pw-accent) 16%, transparent);
      }
      .ghost-btn {
        width: auto;
        background: transparent;
        color: var(--pw-accent);
        border: 0;
        padding: 0;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.9rem;
        text-decoration: none;
      }
      .ghost-btn:hover { text-decoration: underline; }
      .section-block > label.check-row,
      .edit label.check-row,
      .check-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        align-self: start;
        gap: 0.5rem;
        margin: 0;
        width: fit-content;
        max-width: 100%;
        font-size: 0.9rem;
      }
      .check-row input[type='checkbox'] {
        width: auto;
        max-width: none;
        flex: 0 0 auto;
        margin: 0;
        padding: 0;
        accent-color: var(--pw-accent);
      }
      .fields {
        display: grid;
        gap: 0.6rem;
        min-width: 0;
      }
      .fields > label,
      .section-block > label,
      .disclose-body > label,
      .nested-panel-body > label,
      .fields .row > label,
      .nested-panel-body .row > label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.9rem;
        min-width: 0;
      }
      .value {
        padding: 0.55rem 0.7rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        background: var(--pw-surface-2);
        min-width: 0;
        box-sizing: border-box;
      }
      .color-value {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .swatch-sm {
        width: 14px;
        height: 14px;
        border-radius: 4px;
        border: 1px solid var(--pw-border);
        flex-shrink: 0;
      }
      .edit-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0;
        justify-content: flex-end;
      }
      .edit-actions button { width: auto; }
      .more-menu-wrap {
        position: relative;
        display: inline-flex;
      }
      .more-btn {
        font-size: 1.2rem;
        line-height: 1;
        padding: 0.35rem 0.55rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border-strong);
        color: var(--pw-text);
      }
      .more-btn:hover {
        text-decoration: none;
        background: color-mix(in srgb, var(--pw-muted) 12%, transparent);
      }
      .more-menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        z-index: 30;
        min-width: 200px;
        display: grid;
        padding: 0.3rem;
        background: var(--pw-surface, #fff);
        border: 1px solid var(--pw-border-strong);
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
      }
      .more-menu button {
        width: 100%;
        text-align: left;
        background: transparent;
        color: var(--pw-text);
        border: 0;
        border-radius: 6px;
        padding: 0.5rem 0.65rem;
        font-size: 0.9rem;
        cursor: pointer;
      }
      .more-menu button:hover {
        background: color-mix(in srgb, var(--pw-muted) 14%, transparent);
      }
      .more-menu .danger-item {
        color: var(--pw-danger, #c0392b);
      }
      .managed-hint { margin: 0; font-size: 0.85rem; }
      .secondary {
        background: var(--pw-surface);
        color: var(--pw-text);
        border: 1px solid var(--pw-border-strong);
      }
      .btn {
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        text-decoration: none;
        padding: 0.65rem 1rem;
        border-radius: 8px;
        min-height: 2.75rem;
        display: inline-flex;
        align-items: center;
        font-weight: 600;
      }
      .req-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.55rem;
      }
      .req-list li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 0.55rem 0.65rem;
        cursor: pointer;
      }
      .req-row:hover .req-type {
        color: var(--pw-accent);
      }
      .req-main {
        display: grid;
        gap: 0.15rem;
        min-width: 0;
      }
      .req-type {
        min-width: 0;
        color: var(--pw-text);
        font-weight: 700;
      }
      .req-event {
        font-size: 0.82rem;
        line-height: 1.25;
      }
      .req-meta {
        display: grid;
        justify-items: end;
        gap: 0.25rem;
        text-align: right;
        flex: 0 0 auto;
      }
      .req-period {
        color: var(--pw-text);
        font-size: 0.95rem;
        white-space: nowrap;
      }
    `,
  ],
})
export class EmployeeDetailPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly personAvatarPath = PERSON_AVATAR_PATH;
  readonly createRequestLink = buildCreateAbsenceRequestLink();
  readonly requestTypeLabel = requestTypeLabel;
  readonly requestPeriod = requestPeriod;
  readonly requestEventLabel = requestEventLabel;
  readonly frameTone = requestFrameTone;

  employee: EmployeeProfile | null = null;
  edit = {
    lastName: '',
    firstName: '',
    middleName: '',
    employeeNumber: '',
    calendarColor: '#2A6FDB',
    workEmail: '',
    phoneNumber: '',
    telegram: '',
    personalPhoneNumber: '',
    personalTelegram: '',
    personalEmail: '',
    comment: '',
    adminComment: '',
  };
  error = '';
  message = '';
  requests: AbsenceRequestListItem[] = [];
  editingProfile = false;
  editSchedule: ScheduleDay[] = [];
  sidePanel: 'schedule' | 'comment' | 'requests' = 'schedule';
  pdfLoading = false;
  private editBaseline: EmployeeProfile | null = null;
  /** `?edit=1` may open edit once; do not re-enter after save/reload. */
  private editQueryConsumed = false;

  get isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  get heroOrgMeta(): string {
    return [
      this.employee?.directionName,
      this.employee?.departmentName,
      this.employee?.positionName,
    ]
      .map((v) => (v && String(v).trim()) || '—')
      .join(' · ');
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/absences/employees']);
      return;
    }
    this.load(id);
  }

  load(id: string): void {
    this.api.getEmployee(id).subscribe({
      next: (employee) => {
        this.employee = employee;
        this.fillEditFromEmployee(employee);
        this.api.getEmployeeRequests(employee.id).subscribe({
          next: (res) => (this.requests = res.items.slice(0, 8)),
        });
        this.openEditFromQueryIfNeeded();
      },
      error: () => (this.error = 'Не вдалося відкрити анкету'),
    });
  }

  private openEditFromQueryIfNeeded(): void {
    if (this.editQueryConsumed) {
      return;
    }
    if (this.route.snapshot.queryParamMap.get('edit') !== '1') {
      return;
    }
    this.editQueryConsumed = true;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { edit: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (this.employee?.permissions?.canEditProfile) {
      this.startEdit();
    }
  }

  private fillEditFromEmployee(employee: EmployeeProfile): void {
    this.editBaseline = employee;
    this.edit = {
      lastName: employee.lastName,
      firstName: employee.firstName,
      middleName: employee.middleName || '',
      employeeNumber: employee.employeeNumber,
      calendarColor: employee.calendarColor,
      workEmail: employee.workEmail || '',
      phoneNumber: employee.phoneNumber || '',
      telegram: employee.telegram || '',
      personalPhoneNumber: employee.personalPhoneNumber || '',
      personalTelegram: employee.personalTelegram || '',
      personalEmail: employee.personalEmail || '',
      comment: employee.comment || '',
      adminComment: employee.adminComment || '',
    };
  }

  startEdit(): void {
    if (!this.employee) return;
    this.fillEditFromEmployee(this.employee);
    this.editSchedule = cloneSchedule(this.employee.schedule);
    this.editingProfile = true;
    this.error = '';
    this.message = '';
  }

  cancelEdit(): void {
    if (this.employee) {
      this.fillEditFromEmployee(this.employee);
      this.editSchedule = cloneSchedule(this.employee.schedule);
    }
    this.editingProfile = false;
    this.error = '';
  }

  normalizeCalendarColor(): void {
    const previous = this.employee?.calendarColor || '#2A6FDB';
    let value = (this.edit.calendarColor || '').trim();
    if (!value) {
      this.edit.calendarColor = previous;
      return;
    }
    if (!value.startsWith('#')) {
      value = `#${value}`;
    }
    if (/^#[0-9a-fA-F]{3}$/.test(value)) {
      value = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
    }
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      this.edit.calendarColor = value.toUpperCase();
      return;
    }
    this.edit.calendarColor = previous;
  }

  save(): void {
    if (!this.employee) return;
    this.normalizeCalendarColor();
    this.error = '';
    this.message = '';
    // Never re-enter edit via ?edit=1 after an explicit save attempt.
    this.editQueryConsumed = true;
    const baseline = this.editBaseline;
    const body: Record<string, unknown> = {
      lastName: this.edit.lastName,
      firstName: this.edit.firstName,
      middleName: this.edit.middleName || null,
      phoneNumber: this.edit.phoneNumber || null,
      telegram: this.edit.telegram || null,
    };
    if (this.isAdmin) {
      body['employeeNumber'] = this.edit.employeeNumber;
      body['calendarColor'] = this.edit.calendarColor;
      body['workEmail'] = this.edit.workEmail || null;
    }

    // Dirty-only for sensitive fields — never send admin-only keys without permission.
    if (this.employee.permissions?.canEditComment) {
      const next = this.edit.comment || null;
      const prev = baseline?.comment || null;
      if (next !== prev) {
        body['comment'] = next;
      }
    }
    if (this.employee.permissions?.canEditAdminComment) {
      const next = this.edit.adminComment || null;
      const prev = baseline?.adminComment || null;
      if (next !== prev) {
        body['adminComment'] = next;
      }
    }
    if (this.employee.permissions?.canEditPersonalContacts) {
      const pairs: Array<[string, string | null, string | null | undefined]> = [
        ['personalPhoneNumber', this.edit.personalPhoneNumber || null, baseline?.personalPhoneNumber],
        ['personalTelegram', this.edit.personalTelegram || null, baseline?.personalTelegram],
        ['personalEmail', this.edit.personalEmail || null, baseline?.personalEmail],
      ];
      for (const [key, next, prev] of pairs) {
        if (next !== (prev || null)) {
          body[key] = next;
        }
      }
    }

    const employeeId = this.employee.id;
    const shouldSaveSchedule = Boolean(this.employee.permissions?.canEditSchedule);
    const schedulePayload = normalizeSchedulePayload(this.editSchedule);

    const exitEditMode = (employee: EmployeeProfile) => {
      this.employee = employee;
      this.editingProfile = false;
      this.fillEditFromEmployee(employee);
    };

    const fail = (err: { error?: { message?: string | string[] } }) => {
      const msg = err?.error?.message;
      this.error = Array.isArray(msg) ? msg.join(', ') : msg || 'Помилка збереження';
    };

    this.api.updateEmployee(employeeId, body).subscribe({
      next: (employee) => {
        // Leave edit mode as soon as the profile is saved.
        exitEditMode(employee);
        this.message = 'Збережено';
        this.refreshAuthIfSelf();
        this.api.getEmployeeRequests(employeeId).subscribe({
          next: (res) => (this.requests = res.items.slice(0, 8)),
        });

        if (!shouldSaveSchedule) {
          return;
        }
        this.api.putSchedule(employeeId, schedulePayload).subscribe({
          next: (days) => {
            if (this.employee) {
              this.employee = { ...this.employee, schedule: days };
            }
          },
          error: (err) => {
            const msg = err?.error?.message;
            this.error = Array.isArray(msg)
              ? msg.join(', ')
              : msg || 'Профіль збережено, але графік не вдалося оновити';
          },
        });
      },
      error: fail,
    });
  }

  private refreshAuthIfSelf(): void {
    if (this.employee?.id && this.employee.id === this.auth.user()?.employeeId) {
      this.auth.me().subscribe();
    }
  }

  accountStatusLabel(employee: EmployeeProfile): string {
    if (!employee.hasAccount) return 'Без акаунта';
    return employee.accountStatus === 'deactivated'
      ? 'Акаунт: деактивований'
      : 'Акаунт: активний';
  }

  roleLabel(role: string | null, isDepartmentManager?: boolean | null): string {
    return roleDisplayLabel(role, isDepartmentManager);
  }

  downloadPdf(): void {
    if (!this.employee || this.pdfLoading) return;
    this.pdfLoading = true;
    this.error = '';
    this.api.downloadEmployeePdf(this.employee.id).subscribe({
      next: (blob) => {
        this.pdfLoading = false;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Анкета_${this.employee!.employeeNumber}_${this.employee!.lastName}_${this.employee!.firstName}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.pdfLoading = false;
        this.error = 'Не вдалося сформувати PDF';
      },
    });
  }
}
