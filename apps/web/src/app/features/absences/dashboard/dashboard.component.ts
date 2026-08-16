import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api/api.service';
import { AbsenceRequestListItem, EmployeeProfile } from '../core/api/models';
import { roleDisplayLabel } from '../core/api/labels';
import {
  requestEventLabel,
  requestPeriod,
  requestTypeLabel,
} from '../core/api/request-view.util';
import { AuthService } from '../core/auth/auth.service';
import { RequestStatusBadgeComponent } from '../shared/request-status-badge.component';
import { ScheduleEditorComponent } from '../shared/schedule-editor.component';
import { requestFrameTone } from '../shared/request-status-presentation';
import { buildCreateAbsenceRequestLink } from '../requests/create-request-navigation';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, RequestStatusBadgeComponent, ScheduleEditorComponent],
  template: `
    <section class="page">
      @if (loading) {
        <p>Завантаження…</p>
      } @else if (!employeeId) {
        <article class="card">
          <h2>Анкета не створена</h2>
          <p class="muted">
            Для акаунта {{ auth.user()?.email }} ({{ roleLabel(auth.user()?.role ?? null, auth.user()?.isDepartmentManager) }}) ще немає анкети працівника.
          </p>
        </article>
      } @else if (error) {
        <p class="error">{{ error }}</p>
      } @else if (employee) {
        <header class="hero">
          <span class="swatch" [style.background]="employee.calendarColor"></span>
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
              <p>#{{ employee.employeeNumber }} · {{ employee.departmentName }} · {{ employee.positionName }}</p>
              @if (employee.permissions?.canEditProfile) {
                <a
                  class="ghost-btn"
                  [routerLink]="['/absences/employees', employee.id]"
                  [queryParams]="{ edit: '1' }"
                >Редагувати</a>
              }
            </div>
          </div>
        </header>

        <div class="grid">
          <div class="col">
            <article class="card">
              <div class="card-head">
                <h2>Анкета</h2>
                <a class="ghost-btn" [routerLink]="['/people', employee.id]">Профіль Loom</a>
              </div>

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
                  @if (employee.hasAccount && employee.permissions?.canViewAccountDetails) {
                    <label>
                      Email акаунта
                      <div class="value">{{ employee.accountEmail || '—' }}</div>
                    </label>
                  } @else if (!employee.hasAccount) {
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
            </article>

            @if (employee.role === 'department_manager' || employee.isDepartmentManager) {
              <article class="card">
                <h2>Керовані відділи</h2>
                @if (managedNames.length) {
                  <ul class="list">
                    @for (name of managedNames; track name) {
                      <li>{{ name }}</li>
                    }
                  </ul>
                } @else {
                  <p class="muted">Керовані відділи ще не призначені.</p>
                }
              </article>
            }
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
                  <app-schedule-editor
                    [days]="employee.schedule"
                    [readonly]="true"
                  />
                } @else if (sidePanel === 'comment' && employee.permissions?.canViewComment) {
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
      }
    </section>
  `,
  styles: [
    `
      .page {
        display: grid;
        gap: 1rem;
        max-width: 56rem;
        margin-inline: auto;
        width: 100%;
      }
      .hero {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
      }
      @media (min-width: 641px) {
        .hero {
          flex-direction: row;
          align-items: center;
          flex-wrap: wrap;
        }
      }
      .hero-main {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 0.25rem;
      }
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
      .ghost-btn:hover {
        text-decoration: underline;
      }
      .ghost-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
        text-decoration: none;
      }
      .swatch {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        flex-shrink: 0;
      }
      .grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: 1fr;
        align-items: stretch;
      }
      @media (min-width: 900px) {
        .grid {
          grid-template-columns: 1fr 1fr;
        }
      }
      .col {
        display: grid;
        gap: 1rem;
        align-content: start;
        min-width: 0;
      }
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
      .side-tools-summary::-webkit-details-marker {
        display: none;
      }
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
      .card {
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        padding: 1rem;
        display: grid;
        gap: 0.6rem;
        min-width: 0;
      }
      .card h2 {
        margin: 0;
        font-size: 1.15rem;
      }
      .card-head {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: baseline;
        flex-wrap: wrap;
      }
      .card-head a {
        color: var(--pw-accent);
        text-decoration: none;
        font-size: 0.9rem;
      }
      .card-head a.btn {
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        padding: 0.65rem 1rem;
        border-radius: 8px;
        min-height: 2.75rem;
        display: inline-flex;
        align-items: center;
        font-weight: 600;
        font-size: inherit;
      }
      .req-actions {
        justify-content: flex-end;
      }
      .fields {
        display: grid;
        gap: 0.6rem;
        min-width: 0;
      }
      .section-block {
        margin-top: 0.85rem;
        padding-top: 0.95rem;
        border-top: 1px solid color-mix(in srgb, var(--pw-muted) 55%, transparent);
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
      .card h3 {
        margin: 0.5rem 0 0;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--pw-accent);
      }
      .value.pre {
        white-space: pre-wrap;
      }
      .row {
        display: grid;
        gap: 0.6rem;
        min-width: 0;
        width: 100%;
      }
      .row-3,
      .row-2 {
        grid-template-columns: minmax(0, 1fr);
      }
      @media (min-width: 641px) {
        .row-3 {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .row-2 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      .fields > label,
      .section-block > label,
      .disclose-body > label,
      .nested-panel-body > label,
      .row > label {
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
      .muted {
        color: var(--pw-muted);
        margin: 0;
      }
      .error {
        color: var(--pw-danger);
      }
      .list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.4rem;
      }
      .list li {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: center;
      }
      .list a {
        color: var(--pw-accent);
        text-decoration: none;
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
    `,
  ],
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

  readonly createRequestLink = buildCreateAbsenceRequestLink();
  readonly requestTypeLabel = requestTypeLabel;
  readonly requestPeriod = requestPeriod;
  readonly requestEventLabel = requestEventLabel;
  readonly frameTone = requestFrameTone;

  employee: EmployeeProfile | null = null;
  employeeId: string | null = null;
  requests: AbsenceRequestListItem[] = [];
  loading = false;
  error = '';
  sidePanel: 'schedule' | 'comment' | 'requests' = 'schedule';
  pdfLoading = false;

  get managedNames(): string[] {
    return this.employee?.managedDepartments?.map((d) => d.name || '—') ?? [];
  }

  ngOnInit(): void {
    this.employeeId = this.auth.user()?.employeeId ?? null;
    if (!this.employeeId) {
      return;
    }
    this.loading = true;
    this.api.getEmployee(this.employeeId).subscribe({
      next: (employee) => {
        this.employee = employee;
        this.loading = false;
        this.api.getEmployeeRequests(employee.id).subscribe({
          next: (res) => (this.requests = res.items.slice(0, 5)),
        });
      },
      error: () => {
        this.error = 'Не вдалося завантажити анкету';
        this.loading = false;
      },
    });
  }

  roleLabel(role: string | null, isDepartmentManager?: boolean | null): string {
    return roleDisplayLabel(role, isDepartmentManager);
  }

  accountStatusLabel(employee: {
    hasAccount: boolean;
    accountStatus?: string | null;
  }): string {
    if (!employee.hasAccount) return 'Без акаунта';
    return employee.accountStatus === 'deactivated'
      ? 'Акаунт: деактивований'
      : 'Акаунт: активний';
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
