import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api/api.service';
import {
  AbsenceRequestAttachment,
  AbsenceRequestDetail,
  AbsenceType,
  ScheduleDay,
} from '../core/api/models';
import { ABSENCE_TYPE_LABELS } from '../core/api/labels';
import {
  historyTone,
  requestStatusLabel,
  requestTypeLabel,
  shortRequestId,
} from '../core/api/request-view.util';
import {
  normalizeHm,
  shiftBoundsForDate,
  timeOptionsInShift,
} from '../core/schedule/work-time.util';
import {
  PwSelectComponent,
  type PwSelectOption,
} from '../../../shared/ui/pw-select.component';
import { PwDateInputComponent } from '../../../shared/ui/pw-date-input.component';
import { clearInvalidEndTime } from './request-create-binding.util';

@Component({
  selector: 'app-request-detail-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, PwSelectComponent, PwDateInputComponent],
  template: `
    <section class="page pw-stage">
      <span class="pw-stage__glow" aria-hidden="true"></span>
      <div class="sheet">
        <header class="page-head pw-page-head pw-rise">
          <div>
            <p class="pw-eyebrow"><a routerLink="/absences/requests">← До списку</a></p>
            @if (request) {
              <h1>{{ requestTypeLabel(request.type) }}</h1>
              <p class="pw-lead">#{{ shortRequestId(request.id) }}</p>
            } @else {
              <h1>Заявка</h1>
            }
          </div>
          @if (request) {
            <span class="pw-request-badge pw-request-badge--lg" [attr.data-status]="request.statusGroup">{{ requestStatusLabel(request.statusGroup) }}</span>
          }
        </header>

        @if (request) {

          <header class="hero">
            <span
              class="swatch"
              [style.background]="request.calendarColor || 'var(--pw-border)'"
            ></span>
            <div>
              <h2>{{ request.employeeNameAtSubmission || request.employeeName }}</h2>
              <p>
                #{{ request.employeeNumber || '—' }}
                · {{ request.departmentName || '—' }}
                · {{ request.positionName || '—' }}
              </p>
            </div>
          </header>

          <div class="grid">
            <div class="col details-col">
              <article class="card pw-panel" data-help-id="absences.request-detail.employee">
                <h2>Працівник</h2>
                <div class="fields">
                  <label>
                    ПІБ
                    <div class="value">{{ request.employeeNameAtSubmission || request.employeeName }}</div>
                  </label>
                  <div class="row row-2">
                    <label>
                      Номер
                      <div class="value">{{ request.employeeNumber || '—' }}</div>
                    </label>
                    <label>
                      Колір
                      <div class="value color-value">
                  @if (request.calendarColor) {
                          <span class="swatch-sm" [style.background]="request.calendarColor"></span>
                          {{ request.calendarColor }}
                  } @else {
                    —
                  }
                      </div>
                    </label>
                  </div>
                  <div class="row row-2">
                    <label>
                      Відділ
                      <div class="value">{{ request.departmentName || '—' }}</div>
                    </label>
                    <label>
                      Посада
                      <div class="value">{{ request.positionName || '—' }}</div>
                    </label>
                  </div>
                </div>
              </article>

              <article class="card pw-panel" data-help-id="absences.request-detail.details">
                <div class="card-head">
                <h2>Деталі заявки</h2>
                  <span class="pw-request-badge pw-request-badge--lg" [attr.data-status]="request.statusGroup">{{ requestStatusLabel(request.statusGroup) }}</span>
                </div>

                @if (!editing) {
                  <div class="fields">
                    <label>
                      Тип
                      <div class="value">{{ requestTypeLabel(request.type) }}</div>
                    </label>

                    <div class="row row-2">
                      <label>
                        Дата початку
                        <div class="value">{{ request.startDate }}</div>
                      </label>
                      @if (request.type !== 'part_time') {
                        <label>
                          Дата кінця
                          <div class="value">{{ request.endDate || request.startDate }}</div>
                        </label>
                      } @else {
                        <label>
                          Час
                          <div class="value">
                            {{ request.absenceStartTime || '…' }}–{{ request.absenceEndTime || '…' }}
                          </div>
                        </label>
                      }
                    </div>

                  <div class="mini-cals">
                      @for (
                        month of periodCalendars(request.startDate, request.endDate ?? request.startDate);
                        track month.key
                      ) {
                      <div class="mini-cal">
                        <div class="mini-cal-title">{{ month.title }}</div>
                        <div class="mini-cal-weekdays">
                          @for (d of weekdays; track d) {
                            <span>{{ d }}</span>
                          }
                        </div>
                        <div class="mini-cal-grid">
                          @for (day of month.days; track $index) {
                            <span
                              class="mini-cal-day"
                              [class.out]="!day.inMonth"
                              [class.selected]="day.selected"
                              [class.range-start]="day.isStart"
                              [class.range-end]="day.isEnd"
                              [style.--mark]="request.calendarColor || 'var(--pw-accent)'"
                            >{{ day.inMonth ? day.day : '' }}</span>
                          }
                        </div>
                      </div>
                    }
                  </div>

                    <div class="check-row">
                      <span>За власний рахунок</span>
                      <input
                        type="checkbox"
                        [checked]="request.isUnpaid === true"
                        disabled
                        tabindex="-1"
                        aria-hidden="true"
                      />
                </div>

                    <label>
                      Причина
                      <div class="value value-pre">{{ request.reason || '—' }}</div>
                    </label>
                    <label>
                      Коментар працівника
                      <div class="value value-pre">{{ request.employeeComment || '—' }}</div>
                    </label>
                @if (request.decisionComment) {
                      <label>
                        Коментар рішення
                        <div class="value value-pre">{{ request.decisionComment }}</div>
                      </label>
                }
                @if (request.adjustmentComment) {
                      <label>
                        Коментар редагування
                        <div class="value value-pre">{{ request.adjustmentComment }}</div>
                      </label>
                }
                @if (request.deletionComment) {
                      <label>
                        Коментар до видалення
                        <div class="value value-pre">{{ request.deletionComment }}</div>
                      </label>
                }

                    <div class="section-block" data-help-id="absences.request-detail.attachments">
                  <h3>Вкладення</h3>
                      @if (request.attachments.length) {
                  <ul class="attachments">
                    @for (a of request.attachments; track a.id) {
                      <li>
                              <span class="att-name" [title]="a.originalFileName">{{ a.originalFileName }}</span>
                              <span class="att-actions">
                                <button
                                  type="button"
                                  class="icon-btn accent"
                                  title="Подивитися"
                                  aria-label="Подивитися"
                                  (click)="viewAttachment(a)"
                                >
                                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                    <path
                                      fill="currentColor"
                                      d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
                                    />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  class="icon-btn accent"
                                  title="Завантажити"
                                  aria-label="Завантажити"
                                  (click)="downloadAttachment(a)"
                                >
                                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                    <path
                                      fill="currentColor"
                                      d="M12 3a1 1 0 0 1 1 1v9.6l2.3-2.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L11 13.6V4a1 1 0 0 1 1-1zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z"
                                    />
                                  </svg>
                                </button>
                        @if (request.permissions.canManageAttachments) {
                                  <button
                                    type="button"
                                    class="icon-btn danger"
                                    title="Видалити"
                                    aria-label="Видалити"
                                    (click)="removeAttachment(a.id)"
                                  >
                                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                      <path
                                        fill="currentColor"
                                        d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h1v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h1a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9zm2 2h2v1h-2V5zm-2 4a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1zm6 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1z"
                                      />
                                    </svg>
                                  </button>
                                }
                              </span>
                      </li>
                    }
                  </ul>
                      } @else {
                        <p class="muted">Немає вкладень</p>
              }
            </div>
                  </div>
                } @else {
                  <div class="fields edit">
                  <label>
                      Тип
                      <loom-pw-select
                        [value]="editType"
                        [options]="editTypeSelectOptions"
                        placeholder="Оберіть тип"
                        (valueChange)="onEditTypeSelected($event)"
                      />
                    </label>

                    <div class="row row-2">
                    <label>
                        Дата початку
                      <loom-pw-date-input
                        [value]="adjStart"
                        (valueChange)="onAdjStartSelected($event)"
                      />
                    </label>
                      @if (editType !== 'part_time') {
                      <label>
                          Дата кінця
                        <loom-pw-date-input
                          [value]="adjEnd"
                          (valueChange)="onAdjEndSelected($event)"
                        />
                      </label>
                    }
                    </div>

                    @if (editType === 'part_time') {
                      <div class="row row-2">
                      <label>
                          Час з
                        <loom-pw-select
                          [value]="adjStartTime"
                          [options]="adjStartTimeSelectOptions"
                          placeholder="Оберіть"
                          [disabled]="!adjShiftBounds"
                          (valueChange)="onAdjStartTimeSelected($event)"
                        />
                      </label>
                      <label>
                          Час по
                        <loom-pw-select
                          [value]="adjEndTime"
                          [options]="adjEndTimeSelectOptions"
                          placeholder="Оберіть"
                          [disabled]="!adjShiftBounds || !adjStartTime"
                          (valueChange)="onAdjEndTimeSelected($event)"
                        />
                      </label>
                      </div>
                      @if (adjStart && !adjShiftBounds) {
                        <p class="muted">Дата не є робочим днем у графіку працівника.</p>
                      } @else if (adjShiftBounds) {
                        <p class="muted">Зміна: {{ adjShiftBounds.start }}–{{ adjShiftBounds.end }}</p>
                      }
                    }

                    <div class="mini-cals">
                      @for (
                        month of periodCalendars(adjStart, editType === 'part_time' ? adjStart : adjEnd);
                        track month.key
                      ) {
                        <div class="mini-cal">
                          <div class="mini-cal-title">{{ month.title }}</div>
                          <div class="mini-cal-weekdays">
                            @for (d of weekdays; track d) {
                              <span>{{ d }}</span>
                            }
                  </div>
                          <div class="mini-cal-grid">
                            @for (day of month.days; track $index) {
                              <span
                                class="mini-cal-day"
                                [class.out]="!day.inMonth"
                                [class.selected]="day.selected"
                                [class.range-start]="day.isStart"
                                [class.range-end]="day.isEnd"
                                [style.--mark]="request.calendarColor || 'var(--pw-accent)'"
                              >{{ day.inMonth ? day.day : '' }}</span>
                            }
                          </div>
                        </div>
                      }
                    </div>

                    <div class="check-row">
                      <label for="adjUnpaid">За власний рахунок</label>
                      <input type="checkbox" [(ngModel)]="adjUnpaid" name="adjUnpaid" id="adjUnpaid" />
                    </div>

                    <label>
                      Причина
                      <textarea [(ngModel)]="editReason" name="editReason" rows="3"></textarea>
                    </label>
                    <label>
                      Коментар працівника
                      <textarea [(ngModel)]="editEmployeeComment" name="editEmployeeComment" rows="2"></textarea>
                    </label>

                    <div class="section-block">
                      <h3>Вкладення</h3>
                      @if (request.attachments.length) {
                        <ul class="attachments">
                          @for (a of request.attachments; track a.id) {
                            <li>
                              <span class="att-name" [title]="a.originalFileName">{{ a.originalFileName }}</span>
                              <span class="att-actions">
                                <button
                                  type="button"
                                  class="icon-btn accent"
                                  title="Подивитися"
                                  aria-label="Подивитися"
                                  (click)="viewAttachment(a)"
                                >
                                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                    <path
                                      fill="currentColor"
                                      d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
                                    />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  class="icon-btn accent"
                                  title="Завантажити"
                                  aria-label="Завантажити"
                                  (click)="downloadAttachment(a)"
                                >
                                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                    <path
                                      fill="currentColor"
                                      d="M12 3a1 1 0 0 1 1 1v9.6l2.3-2.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L11 13.6V4a1 1 0 0 1 1-1zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z"
                                    />
                                  </svg>
                                </button>
                                @if (request.permissions.canManageAttachments) {
                                  <button
                                    type="button"
                                    class="icon-btn danger"
                                    title="Видалити"
                                    aria-label="Видалити"
                                    (click)="removeAttachment(a.id)"
                                  >
                                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                      <path
                                        fill="currentColor"
                                        d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h1v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h1a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9zm2 2h2v1h-2V5zm-2 4a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1zm6 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1z"
                                      />
                                    </svg>
                                  </button>
                                }
                              </span>
                            </li>
                          }
                        </ul>
                      } @else {
                        <p class="muted">Немає вкладень</p>
                      }
                      @if (request.permissions.canManageAttachments) {
                        <label class="file">
                          <span>Додати файл (PDF/JPG/PNG, до 10 МБ)</span>
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                            [disabled]="busy"
                            (change)="onFile($event)"
                          />
                        </label>
                      }
                    </div>
                  </div>
                }
              </article>
            </div>

            @if (hasSidebarActions || request.history.length) {
              <aside class="col actions-col">
                @if (hasSidebarActions) {
                  <div class="card pw-panel actions-card" data-help-id="absences.request-detail.actions">
                    <div class="actions-card-head">
                      <h2>Дії</h2>
                      <div class="actions-card-tools">
                        @if (!editing && canModify) {
                          <button
                            type="button"
                            class="btn pw-btn pw-btn--ghost sm"
                            [disabled]="busy"
                            (click)="startEdit()"
                          >
                            Редагувати
                          </button>
                        }
                        @if (request.permissions.canDelete) {
                          <button
                            type="button"
                            class="icon-btn danger"
                            title="Видалити заявку"
                            aria-label="Видалити заявку"
                            [disabled]="busy"
                            (click)="deletePending()"
                          >
                            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                              <path
                                fill="currentColor"
                                d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h1v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h1a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9zm2 2h2v1h-2V5zm-2 4a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1zm6 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1z"
                              />
                            </svg>
                          </button>
                        }
                      </div>
                    </div>
                    @if (editing) {
                      <label>
                        <span>
                          Коментар редагування
                          @if (request.permissions.canAdjust) {
                            *
                          }
                        </span>
                        <textarea [(ngModel)]="adjustmentComment" name="adjustmentComment" rows="4"></textarea>
                      </label>
                      <div class="pw-form-actions">
                        <button type="button" class="btn pw-btn" [disabled]="busy" (click)="saveEdit()">Зберегти</button>
                        <button type="button" class="btn pw-btn pw-btn--ghost" [disabled]="busy" (click)="cancelEdit()">
                          Скасувати
                        </button>
                      </div>
                    } @else {
                      @if (request.permissions.canApprove || request.permissions.canReject) {
                        <div class="pw-form-actions decision-actions">
                          @if (request.permissions.canApprove) {
                            <button type="button" class="btn success" [disabled]="busy" (click)="approve()">
                              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                <path
                                  fill="currentColor"
                                  d="M9.55 17.65 4.9 13l1.4-1.4 3.25 3.25L17.7 6.7l1.4 1.4z"
                                />
                              </svg>
                              Затвердити
                            </button>
                          }
                          @if (request.permissions.canReject) {
                            <button type="button" class="btn danger" [disabled]="busy" (click)="reject()">
                              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                <path
                                  fill="currentColor"
                                  d="M18.3 5.71 12 12.01 5.7 5.7 4.29 7.11 10.59 13.4 4.29 19.7 5.7 21.11 12 14.82l6.3 6.29 1.41-1.41-6.29-6.3 6.29-6.29z"
                                />
                              </svg>
                              Відхилити
                            </button>
                          }
                        </div>
                        <label>
                          <span>Коментар рішення (необовʼязково)</span>
                          <textarea [(ngModel)]="decisionComment" name="decisionComment" rows="2"></textarea>
                        </label>
                      }

                      @if (request.permissions.canRequestDeletion) {
                        <label>
                          <span>Коментар (необовʼязково)</span>
                          <textarea [(ngModel)]="deletionComment" name="deletionComment" rows="2"></textarea>
                        </label>
                        <button type="button" class="btn danger" [disabled]="busy" (click)="requestDeletion()">
                          Подати на видалення
                        </button>
                      }
                      @if (request.permissions.canApproveDeletion) {
                        <button type="button" class="btn danger" [disabled]="busy" (click)="approveDeletion()">
                          Підтвердити видалення
                        </button>
                      }
                      @if (request.permissions.canRejectDeletion) {
                        <label>
                          <span>Причина відхилення *</span>
                          <textarea [(ngModel)]="deletionRejectComment" name="deletionRejectComment" rows="2"></textarea>
                        </label>
                        <button type="button" class="btn" [disabled]="busy" (click)="rejectDeletion()">
                          Відхилити запит на видалення
                        </button>
                      }
                    }
                  </div>
                }

                @if (request.history.length) {
                  <article class="card pw-panel history-card" data-help-id="absences.request-detail.history">
                    <h2>Історія</h2>
                    <div class="history-scroll">
                      <ul class="history">
                        @for (h of request.history; track h.id) {
                          <li [attr.data-tone]="historyTone(h)">
                            <span>{{ h.changeDescription }}</span>
                            <strong>{{ h.createdAt | date: 'short' }}</strong>
                          </li>
                        }
                      </ul>
              </div>
                  </article>
                }
            </aside>
            }
          </div>
        }
      </div>

      @if (toastMessage) {
        <div class="toast" role="alert">
          <span>{{ toastMessage }}</span>
          <button type="button" class="toast-dismiss" (click)="dismissToast()" aria-label="Закрити">×</button>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .page {
        display: flex;
        justify-content: center;
        padding: 0 1rem 2rem;
        position: relative;
      }
      .sheet {
        width: min(100%, 980px);
        display: grid;
        gap: 1rem;
      }
      .back { margin: 0; }
      a { color: var(--pw-accent); text-decoration: none; }
      .head {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: start;
      }
      .head-title {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 0.65rem;
        min-width: 0;
      }
      .head h1 { margin: 0; font-size: 1.5rem; }
      .req-code {
        color: var(--pw-muted);
        font-size: 1rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        font-variant-numeric: tabular-nums;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1rem;
        align-items: start;
      }
      .grid:has(.details-col:only-child) {
        grid-template-columns: 1fr;
      }
      .col { display: grid; gap: 1rem; align-content: start; min-width: 0; }
      .details-col {
        align-self: start;
      }
      .actions-col {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-width: 0;
        height: auto;
        min-height: 0;
        max-height: none;
        overflow: visible;
        align-self: stretch;
      }
      .actions-card {
        flex: 0 0 auto;
      }
      .actions-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }
      .actions-card-head h2 {
        margin: 0;
      }
      .actions-card-tools {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 0.35rem;
      }
      .actions-card-tools .btn {
        width: auto;
      }
      .actions-card-tools .icon-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .card.history-card {
        flex: 1 1 auto;
        min-height: 0;
        max-height: 22rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        align-content: stretch;
        overflow: hidden;
      }
      @media (min-width: 900px) {
        .grid {
          grid-template-columns: minmax(280px, 1.2fr) minmax(240px, 0.9fr);
        }
        .actions-col {
          /* Match left column height without expanding the grid row */
          height: 0;
          min-height: 100%;
          max-height: 100%;
          overflow: hidden;
        }
        .card.history-card {
          max-height: none;
        }
      }
      .history-card > h2 {
        flex: 0 0 auto;
      }
      .history-scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow-x: hidden;
        overflow-y: auto;
        padding-right: 0.85rem;
      }
      .hero {
        display: flex;
        gap: 1rem;
        align-items: center;
      }
      .hero h2 {
        margin: 0;
        font-size: 1.25rem;
      }
      .hero p {
        margin: 0.25rem 0 0;
        color: var(--pw-muted);
      }
      .swatch {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        flex-shrink: 0;
      }
      .swatch-sm {
        width: 14px;
        height: 14px;
        border-radius: 4px;
        border: 1px solid var(--pw-border);
        flex-shrink: 0;
      }
      .card {
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        padding: 1rem;
        display: grid;
        gap: 0.75rem;
        align-content: start;
      }
      .card h2 { margin: 0; font-size: 1.05rem; }
      .card h3 {
        margin: 0;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--pw-accent);
      }
      .card-head {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
      }
      .card-head h2 { margin: 0; }
      .fields {
        display: grid;
        gap: 0.6rem;
        min-width: 0;
      }
      .fields > label,
      .section-block > label,
      .fields .row > label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.9rem;
        min-width: 0;
      }
      .row {
        display: grid;
        gap: 0.6rem;
        min-width: 0;
      }
      .row-2 { grid-template-columns: minmax(0, 1fr); }
      @media (min-width: 641px) {
        .row-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      .value {
        padding: 0.55rem 0.7rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        background: var(--pw-surface-2);
        min-width: 0;
        box-sizing: border-box;
      }
      .value-pre { white-space: pre-wrap; }
      .color-value {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .section-block {
        display: grid;
        gap: 0.5rem;
        padding-top: 0.35rem;
        border-top: 1px solid var(--pw-border);
      }
      .mini-cals {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }
      .mini-cal {
        width: 168px;
        border: 1px solid var(--pw-border);
        border-radius: 10px;
        padding: 0.5rem;
        background: var(--pw-surface-2);
      }
      .mini-cal-title {
        text-align: center;
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--pw-accent);
        margin-bottom: 0.35rem;
        text-transform: capitalize;
      }
      .mini-cal-weekdays,
      .mini-cal-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
      }
      .mini-cal-weekdays span {
        text-align: center;
        font-size: 0.62rem;
        color: var(--pw-muted);
        font-weight: 600;
      }
      .mini-cal-day {
        aspect-ratio: 1;
        display: grid;
        place-items: center;
        font-size: 0.68rem;
        border-radius: 5px;
        color: var(--pw-text);
      }
      .mini-cal-day.out { color: transparent; }
      .mini-cal-day.selected {
        background: color-mix(in srgb, var(--mark, var(--pw-accent)) 28%, var(--pw-surface));
        color: var(--pw-text-strong);
        font-weight: 600;
      }
      .mini-cal-day.range-start,
      .mini-cal-day.range-end {
        background: var(--mark, var(--pw-accent));
        color: var(--pw-on-accent);
      }
      .actions-card label { display: grid; gap: 0.35rem; font-size: 0.9rem; }
      input, textarea, select {
        padding: 0.55rem 0.7rem;
        border: 1px solid var(--pw-border-strong);
        border-radius: 8px;
        width: 100%;
        box-sizing: border-box;
        background: var(--pw-surface);
        color: var(--pw-text);
        font: inherit;
      }
      .check-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.65rem;
        margin: 0.15rem 0;
        padding: 0.85rem 0;
        font-size: 1.1rem;
        font-weight: 700;
        border-top: 1px solid color-mix(in srgb, var(--pw-muted) 55%, transparent);
        border-bottom: 1px solid color-mix(in srgb, var(--pw-muted) 55%, transparent);
      }
      .check-row input {
        width: 1.25rem;
        height: 1.25rem;
        flex-shrink: 0;
        accent-color: var(--pw-accent);
      }
      .check-row label { margin: 0; font-weight: 700; }
      .btn {
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        border: 0;
        border-radius: 8px;
        padding: 0.6rem 0.9rem;
        cursor: pointer;
        font: inherit;
        width: 100%;
        box-sizing: border-box;
      }
      .btn.danger { background: var(--pw-danger); }
      .btn.success {
        background: var(--pw-success);
        color: var(--pw-on-accent);
      }
      .btn:disabled { opacity: 0.6; }
      .btn.secondary {
        background: var(--pw-surface);
        color: var(--pw-text);
        border: 1px solid var(--pw-border-strong);
      }
      .btn.ghost {
        background: var(--pw-accent-soft, #e8eef5);
        border: 1px solid color-mix(in srgb, var(--pw-accent) 35%, var(--pw-border));
        color: var(--pw-accent);
      }
      .btn.ghost:hover:not(:disabled) {
        background: color-mix(in srgb, var(--pw-accent) 16%, var(--pw-surface));
        border-color: var(--pw-accent);
      }
      .btn.sm {
        padding: 0.35rem 0.7rem;
        font-size: 0.9rem;
      }
      .muted { margin: 0; color: var(--pw-muted); font-size: 0.9rem; }
      .attachments { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.4rem; }
      .attachments li {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-width: 0;
      }
      .att-name {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .att-actions {
        flex: 0 0 auto;
        display: flex;
        flex-wrap: nowrap;
        gap: 0.35rem;
        justify-content: flex-end;
        margin-left: auto;
        align-items: center;
      }
      .icon-btn {
        width: 2rem;
        height: 2rem;
        display: grid;
        place-items: center;
        padding: 0;
        border: 1px solid var(--pw-border);
        border-radius: 8px;
        background: var(--pw-surface-2);
        color: var(--pw-muted);
        cursor: pointer;
      }
      .icon-btn:hover {
        border-color: var(--pw-border-strong, var(--pw-border));
      }
      .icon-btn.accent { color: var(--pw-accent); }
      .icon-btn.danger { color: var(--pw-danger); }
      .icon-btn svg { display: block; }
      .file { display: grid; gap: 0.35rem; }
      .history { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.5rem; }
      .history li {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px solid var(--pw-border);
        padding: 0.35rem 0.55rem 0.5rem 0.45rem;
        margin: 0;
        border-radius: 8px;
        font-size: 0.92rem;
      }
      .history li:last-child { border-bottom: 0; padding-bottom: 0.35rem; }
      .history span {
        color: var(--pw-text);
        min-width: 0;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .history strong {
        color: var(--pw-text-strong);
        white-space: nowrap;
        flex: 0 0 auto;
        padding-right: 0.15rem;
      }
      .history li[data-tone='success'] {
        background: var(--pw-success-soft);
        border-bottom-color: transparent;
      }
      .history li[data-tone='success'] span,
      .history li[data-tone='success'] strong {
        color: var(--pw-success);
        font-weight: 600;
      }
      .history li[data-tone='danger'] {
        background: var(--pw-danger-soft);
        border-bottom-color: transparent;
      }
      .history li[data-tone='danger'] span,
      .history li[data-tone='danger'] strong {
        color: var(--pw-danger);
        font-weight: 600;
      }
      .history li[data-tone='warning'] {
        background: var(--pw-danger-soft);
        border-bottom-color: transparent;
        box-shadow: inset 3px 0 0 var(--pw-danger);
      }
      .history li[data-tone='warning'] span,
      .history li[data-tone='warning'] strong {
        color: var(--pw-danger);
        font-weight: 700;
      }
      .actions-card > .btn {
        width: 100%;
      }
      .pw-form-actions .btn {
        width: 100%;
      }
      @media (min-width: 641px) {
        .pw-form-actions .btn {
          width: auto;
        }
      }
      .decision-actions {
        display: flex;
        gap: 0.5rem;
      }
      .decision-actions .btn {
        flex: 1 1 0;
        width: auto;
        min-width: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
      }
      .decision-actions .btn svg {
        flex-shrink: 0;
      }
      @media (min-width: 641px) {
        .decision-actions .btn {
          width: auto;
        }
      }
      .toast {
        position: fixed;
        right: 1rem;
        bottom: 1rem;
        z-index: var(--pw-z-modal, 250);
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        max-width: min(24rem, calc(100vw - 2rem));
        padding: 0.85rem 1rem;
        border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--pw-danger) 35%, var(--pw-border));
        background: var(--pw-surface);
        color: var(--pw-danger);
        box-shadow: 0 8px 24px color-mix(in srgb, var(--pw-text) 16%, transparent);
      }
      .toast-dismiss {
        flex: 0 0 auto;
        width: 1.5rem;
        height: 1.5rem;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font-size: 1.2rem;
        line-height: 1;
        padding: 0;
      }
    `,
  ],
})
export class RequestDetailPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly shortRequestId = shortRequestId;
  readonly requestTypeLabel = requestTypeLabel;
  readonly requestStatusLabel = requestStatusLabel;
  readonly historyTone = historyTone;

  request: AbsenceRequestDetail | null = null;
  toastMessage = '';
  busy = false;
  editing = false;
  decisionComment = '';
  adjustmentComment = '';
  editType: AbsenceType = 'vacation';
  editReason = '';
  editEmployeeComment = '';
  deletionComment = '';
  deletionRejectComment = '';
  adjStart = '';
  adjEnd = '';
  adjStartTime = '';
  adjEndTime = '';
  adjUnpaid = false;
  schedule: ScheduleDay[] = [];
  readonly typeKeys = Object.keys(ABSENCE_TYPE_LABELS) as AbsenceType[];
  readonly weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  private readonly monthNames = [
    'січень',
    'лютий',
    'березень',
    'квітень',
    'травень',
    'червень',
    'липень',
    'серпень',
    'вересень',
    'жовтень',
    'листопад',
    'грудень',
  ];
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  get adjShiftBounds(): { start: string; end: string } | null {
    return shiftBoundsForDate(this.schedule, this.adjStart);
  }

  get canModify(): boolean {
    const p = this.request?.permissions;
    return Boolean(p?.canEdit || p?.canAdjust);
  }

  get hasSidebarActions(): boolean {
    const p = this.request?.permissions;
    if (!p) return false;
    return (
      this.canModify ||
      p.canApprove ||
      p.canReject ||
      p.canDelete ||
      p.canRequestDeletion ||
      p.canApproveDeletion ||
      p.canRejectDeletion
    );
  }

  get editTypeSelectOptions(): PwSelectOption[] {
    return this.typeKeys.map((t) => ({
      value: t,
      label: requestTypeLabel(t),
    }));
  }

  get adjStartTimeSelectOptions(): PwSelectOption[] {
    return [
      { value: '', label: 'Оберіть' },
      ...this.adjStartTimeOptions.map((t) => ({ value: t, label: t })),
    ];
  }

  get adjEndTimeSelectOptions(): PwSelectOption[] {
    return [
      { value: '', label: 'Оберіть' },
      ...this.adjEndTimeOptions.map((t) => ({ value: t, label: t })),
    ];
  }

  get adjStartTimeOptions(): string[] {
    return this.mergeTimeOption(
      this.adjShiftBounds
        ? timeOptionsInShift(this.adjShiftBounds.start, this.adjShiftBounds.end).filter(
            (t) => t < this.adjShiftBounds!.end,
          )
        : [],
      this.adjStartTime,
    );
  }

  get adjEndTimeOptions(): string[] {
    if (!this.adjShiftBounds || !this.adjStartTime) return [];
    return this.mergeTimeOption(
      timeOptionsInShift(this.adjShiftBounds.start, this.adjShiftBounds.end).filter(
        (t) => t > this.adjStartTime,
      ),
      this.adjEndTime,
    );
  }

  private mergeTimeOption(options: string[], current: string): string[] {
    if (!current || options.includes(current)) {
      return options;
    }
    return [...options, current].sort();
  }

  private sanitizeAdjTimes(): void {
    const bounds = this.adjShiftBounds;
    if (!bounds) {
      this.adjStartTime = '';
      this.adjEndTime = '';
      return;
    }
    if (
      !this.adjStartTime ||
      this.adjStartTime < bounds.start ||
      this.adjStartTime >= bounds.end
    ) {
      this.adjStartTime = '';
    }
    if (
      !this.adjEndTime ||
      this.adjEndTime <= this.adjStartTime ||
      this.adjEndTime > bounds.end
    ) {
      this.adjEndTime = '';
    }
  }

  ngOnInit(): void {
    const flashError = (history.state as { flashError?: string } | null)?.flashError;
    if (flashError) {
      this.showError(flashError);
      history.replaceState({ ...(history.state ?? {}), flashError: undefined }, '');
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.load(id);
    }
  }

  ngOnDestroy(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  showError(msg: string): void {
    this.toastMessage = msg;
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => this.dismissToast(), 7000);
  }

  dismissToast(): void {
    this.toastMessage = '';
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  load(id: string, options?: { keepEditing?: boolean }): void {
    const keepEditing = Boolean(options?.keepEditing);
    this.api.getRequest(id).subscribe({
      next: (r) => {
        this.request = r;
        if (!keepEditing) {
          this.syncEditFields(r);
        }
        this.loadSchedule(r.employeeId);
        if (
          keepEditing ||
          (this.route.snapshot.queryParamMap.get('edit') === '1' &&
            (r.permissions.canEdit || r.permissions.canAdjust))
        ) {
          this.editing = true;
        }
      },
      error: () => {
        this.showError('Не вдалося завантажити заявку');
      },
    });
  }

  private loadSchedule(employeeId: string): void {
    this.api.getSchedule(employeeId).subscribe({
      next: (days) => {
        this.schedule = days;
        this.sanitizeAdjTimes();
      },
      error: () => {
        this.schedule = [];
      },
    });
  }

  private syncEditFields(r: AbsenceRequestDetail): void {
    this.editType = r.type ?? 'vacation';
    this.adjStart = r.startDate;
    this.adjEnd = r.endDate ?? r.startDate;
    this.adjStartTime = normalizeHm(r.absenceStartTime);
    this.adjEndTime = normalizeHm(r.absenceEndTime);
    this.adjUnpaid = Boolean(r.isUnpaid);
    this.editReason = r.reason ?? '';
    this.editEmployeeComment = r.employeeComment ?? '';
  }

  startEdit(): void {
    if (!this.request) return;
    this.syncEditFields(this.request);
    this.adjustmentComment = '';
    this.editing = true;
  }

  cancelEdit(): void {
    if (this.request) {
      this.syncEditFields(this.request);
    }
    this.adjustmentComment = '';
    this.editing = false;
  }

  onEditTypeSelected(next: string): void {
    this.editType = next as AbsenceType;
    this.onEditTypeChange();
  }

  onAdjStartSelected(next: string): void {
    this.adjStart = next;
    this.onAdjDateChange();
  }

  onAdjEndSelected(next: string): void {
    this.adjEnd = next;
  }

  onAdjStartTimeSelected(next: string): void {
    this.adjStartTime = next;
    this.onAdjStartTimeChange();
  }

  onAdjEndTimeSelected(next: string): void {
    this.adjEndTime = next;
  }

  onEditTypeChange(): void {
    if (this.editType === 'part_time') {
      this.adjEnd = this.adjStart;
    } else {
      this.adjStartTime = '';
      this.adjEndTime = '';
      if (!this.adjEnd) {
        this.adjEnd = this.adjStart;
      }
    }
    this.sanitizeAdjTimes();
  }

  onAdjDateChange(): void {
    if (this.editType === 'part_time') {
      this.adjEnd = this.adjStart;
    }
    this.sanitizeAdjTimes();
  }

  onAdjStartTimeChange(): void {
    this.adjEndTime = clearInvalidEndTime(this.adjStartTime, this.adjEndTime);
  }

  saveEdit(): void {
    if (!this.request) return;
    if (this.request.permissions.canEdit) {
      this.saveOwnerEdit();
      return;
    }
    this.adjust();
  }

  private editPayloadBase() {
    const partTime = this.editType === 'part_time';
    return {
      type: this.editType,
      startDate: this.adjStart,
      endDate: partTime ? this.adjStart : this.adjEnd,
      absenceStartTime: partTime ? this.adjStartTime || null : null,
      absenceEndTime: partTime ? this.adjEndTime || null : null,
      isUnpaid: this.adjUnpaid,
      reason: this.editReason.trim(),
      employeeComment: this.editEmployeeComment.trim() || null,
    };
  }

  private assertEditTimes(): boolean {
    if (this.editType !== 'part_time') {
      return true;
    }
    if (!this.adjShiftBounds) {
      this.showError('Обрана дата не є робочим днем у графіку працівника');
      return false;
    }
    if (!this.adjStartTime || !this.adjEndTime) {
      this.showError('Оберіть час з і час по в межах графіка');
      return false;
    }
    return true;
  }

  private saveOwnerEdit(): void {
    if (!this.request) return;
    if (!this.assertEditTimes()) return;
    const note = this.adjustmentComment.trim();
    this.busy = true;
    this.api
      .updateRequest(this.request.id, {
        version: this.request.version,
        ...this.editPayloadBase(),
        ...(note ? { adjustmentComment: note } : {}),
      })
      .subscribe({
        next: (r) => {
          this.request = r;
          this.syncEditFields(r);
          this.busy = false;
          this.editing = false;
          this.adjustmentComment = '';
        },
        error: (e) => this.handleError(e),
      });
  }

  periodCalendars(
    startDate: string,
    endDate: string,
  ): Array<{
    key: string;
    title: string;
    days: Array<{ day: number; inMonth: boolean; selected: boolean; isStart: boolean; isEnd: boolean }>;
  }> {
    const start = this.parseYmd(startDate);
    const end = this.parseYmd(endDate || startDate);
    if (!start || !end) {
      return [];
    }
    const startKey = this.ymdKey(start);
    const endKey = this.ymdKey(end);
    const months: Array<{ year: number; month: number }> = [];
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    let guard = 0;
    while (cursor <= last && guard < 6) {
      months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      guard += 1;
    }

    return months.map(({ year, month }) => {
      const first = new Date(year, month, 1);
      const offset = (first.getDay() + 6) % 7;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const cells: Array<{
        day: number;
        inMonth: boolean;
        selected: boolean;
        isStart: boolean;
        isEnd: boolean;
      }> = [];
      for (let i = 0; i < offset; i += 1) {
        cells.push({ day: 0, inMonth: false, selected: false, isStart: false, isEnd: false });
      }
      for (let day = 1; day <= daysInMonth; day += 1) {
        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const selected = key >= startKey && key <= endKey;
        cells.push({
          day,
          inMonth: true,
          selected,
          isStart: key === startKey,
          isEnd: key === endKey,
        });
      }
      while (cells.length % 7 !== 0) {
        cells.push({ day: 0, inMonth: false, selected: false, isStart: false, isEnd: false });
      }
      return {
        key: `${year}-${month}`,
        title: `${this.monthNames[month]} ${year}`,
        days: cells,
      };
    });
  }

  private parseYmd(value: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private ymdKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  downloadAttachment(attachment: AbsenceRequestAttachment): void {
    if (!this.request || this.busy) return;
    this.busy = true;
    this.api.downloadRequestAttachment(this.request.id, attachment.id).subscribe({
      next: (blob) => {
        this.busy = false;
        if (this.isErrorBlob(blob)) {
          void this.readBlobError(blob);
          return;
        }
        const typed = this.typedAttachmentBlob(blob, attachment);
        const url = URL.createObjectURL(typed);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.originalFileName || 'attachment';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (e) => this.handleError(e),
    });
  }

  viewAttachment(attachment: AbsenceRequestAttachment): void {
    if (!this.request || this.busy) return;

    // Open synchronously on click — async window.open() after HTTP is blocked as a popup.
    const preview = window.open('about:blank', '_blank');
    if (!preview) {
      this.showError('Дозвольте спливаючі вікна, щоб переглянути файл');
      return;
    }
    try {
      preview.document.write(
        '<!doctype html><title>Завантаження…</title><p style="font-family:sans-serif;padding:1rem">Завантаження файлу…</p>',
      );
      preview.document.close();
    } catch {
      /* ignore write restrictions */
    }

    this.busy = true;
    this.api.downloadRequestAttachment(this.request.id, attachment.id).subscribe({
      next: (blob) => {
        this.busy = false;
        if (this.isErrorBlob(blob)) {
          try {
            preview.close();
          } catch {
            /* ignore */
          }
          void this.readBlobError(blob);
          return;
        }
        const typed = this.typedAttachmentBlob(blob, attachment);
        const url = URL.createObjectURL(typed);
        try {
          preview.location.replace(url);
        } catch {
          preview.location.href = url;
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (e) => {
        try {
          preview.close();
        } catch {
          /* ignore */
        }
        this.handleError(e);
      },
    });
  }

  private typedAttachmentBlob(blob: Blob, attachment: AbsenceRequestAttachment): Blob {
    return blob.type
      ? blob
      : new Blob([blob], { type: attachment.mimeType || 'application/octet-stream' });
  }

  /** HttpClient blob responses turn API JSON errors into opaque Blobs. */
  private isErrorBlob(blob: Blob): boolean {
    return blob.type.includes('application/json') || blob.type.includes('text/plain');
  }

  private async readBlobError(blob: Blob): Promise<void> {
    try {
      const text = await blob.text();
      const parsed = JSON.parse(text) as { message?: string | string[]; code?: string };
      this.handleError({ error: parsed, status: 400 });
    } catch {
      this.showError('Не вдалося відкрити файл');
      this.busy = false;
    }
  }

  private handleError(err: {
    error?: { message?: string | string[]; code?: string } | string;
    status?: number;
    message?: string;
  }): void {
    this.busy = false;
    const body = err?.error;
    const raw =
      typeof body === 'string'
        ? body
        : body && typeof body === 'object'
          ? body.message
          : undefined;
    const parts = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const translated = parts
      .map((msg) => this.translateValidationMessage(String(msg)))
      .join('; ');
    const code = typeof body === 'object' && body ? body.code : undefined;
    if (err.status === 413) {
      this.showError('Максимальний розмір файлу — 10 МБ');
    } else {
      this.showError(translated || code || err.message || 'Помилка дії');
    }
    if (this.request) {
      this.load(this.request.id, { keepEditing: this.editing });
    }
  }

  private translateValidationMessage(message: string): string {
    if (/[а-яіїєґ]/i.test(message)) {
      return message;
    }
    const lower = message.toLowerCase();
    if (lower.includes('overlap')) {
      return 'Період перетинається з уже наявною заявкою цього працівника';
    }
    if (lower.includes('allowed') && (lower.includes('pdf') || lower.includes('jpg'))) {
      return 'Дозволено лише PDF, JPG, JPEG, PNG';
    }
    if (lower.includes('file is required') || lower.includes('файл не надано')) {
      return 'Файл не надано';
    }
    if (lower.includes('max') && lower.includes('attachment')) {
      return 'Досягнуто ліміт вкладень (макс. 5)';
    }
    if (lower.includes('max') && lower.includes('10')) {
      return 'Максимальний розмір файлу — 10 МБ';
    }
    if (lower.includes('decisioncomment') && lower.includes('longer')) {
      return 'Вкажіть причину відхилення';
    }
    if (lower.includes('decisioncomment') && lower.includes('shorter')) {
      return 'Коментар рішення занадто довгий (макс. 2000 символів)';
    }
    if (lower.includes('decisioncomment') && lower.includes('must be a string')) {
      return 'Коментар рішення має бути текстом';
    }
    if (lower.includes('adjustmentcomment') && lower.includes('longer')) {
      return 'Вкажіть коментар редагування';
    }
    if (lower.includes('must be an integer') || lower.includes('version')) {
      return 'Некоректна версія заявки';
    }
    if (lower.includes('must be a string')) {
      return 'Некоректне текстове значення';
    }
    if (lower.includes('must be shorter')) {
      return 'Текст занадто довгий';
    }
    if (lower.includes('should not be empty') || lower.includes('must be longer')) {
      return 'Заповніть обовʼязкове поле';
    }
    return message;
  }

  approve(): void {
    if (!this.request) return;
    this.busy = true;
    const decisionComment = this.decisionComment.trim();
    this.api
      .approveRequest(this.request.id, {
        version: this.request.version,
        ...(decisionComment ? { decisionComment } : {}),
      })
      .subscribe({
        next: (r) => {
          this.request = r;
          this.busy = false;
        },
        error: (e) => this.handleError(e),
      });
  }

  reject(): void {
    if (!this.request) return;
    this.busy = true;
    const decisionComment = this.decisionComment.trim();
    this.api
      .rejectRequest(this.request.id, {
        version: this.request.version,
        ...(decisionComment ? { decisionComment } : {}),
      })
      .subscribe({
        next: (r) => {
          this.request = r;
          this.busy = false;
          this.decisionComment = '';
        },
        error: (e) => this.handleError(e),
      });
  }

  adjust(): void {
    if (!this.request || !this.adjustmentComment.trim()) {
      this.showError('Вкажіть коментар редагування');
      return;
    }
    if (!this.assertEditTimes()) return;
    this.busy = true;
    this.api
      .adjustRequest(this.request.id, {
        version: this.request.version,
        adjustmentComment: this.adjustmentComment.trim(),
        ...this.editPayloadBase(),
      })
      .subscribe({
        next: (r) => {
          this.request = r;
          this.syncEditFields(r);
          this.busy = false;
          this.adjustmentComment = '';
          this.editing = false;
        },
        error: (e) => this.handleError(e),
      });
  }

  deletePending(): void {
    if (!this.request || this.busy) return;
    if (!confirm('Видалити цю заявку без можливості відновлення?')) {
      return;
    }
    this.busy = true;
    const deletedId = this.request.id;
    this.api.deleteRequest(this.request.id, this.request.version).subscribe({
      next: () => {
        void this.router.navigate(['/absences/requests'], {
          replaceUrl: true,
          state: { deletedRequestId: deletedId },
        });
      },
      error: (e) => this.handleError(e),
    });
  }

  requestDeletion(): void {
    if (!this.request) return;
    this.busy = true;
    const deletionComment = this.deletionComment.trim();
    this.api
      .requestDeletion(this.request.id, {
        version: this.request.version,
        ...(deletionComment ? { deletionComment } : {}),
      })
      .subscribe({
        next: (r) => {
          this.request = r;
          this.busy = false;
        },
        error: (e) => this.handleError(e),
      });
  }

  approveDeletion(): void {
    if (!this.request || this.busy) return;
    this.busy = true;
    this.api.approveDeletion(this.request.id, { version: this.request.version }).subscribe({
        next: () => void this.router.navigate(['/absences/requests']),
        error: (e) => this.handleError(e),
      });
  }

  rejectDeletion(): void {
    if (!this.request || !this.deletionRejectComment.trim()) {
      this.showError('Вкажіть причину');
      return;
    }
    this.busy = true;
    this.api
      .rejectDeletion(this.request.id, {
        version: this.request.version,
        comment: this.deletionRejectComment.trim(),
      })
      .subscribe({
        next: (r) => {
          this.request = r;
          this.busy = false;
        },
        error: (e) => this.handleError(e),
      });
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.request) return;

    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      input.value = '';
      this.showError('Максимальний розмір файлу — 10 МБ');
      return;
    }
    const allowedExt = /\.(pdf|png|jpe?g)$/i.test(file.name);
    if (!allowedExt) {
      input.value = '';
      this.showError('Дозволено лише PDF, JPG, JPEG, PNG');
      return;
    }

    this.busy = true;
    this.api.uploadRequestAttachment(this.request.id, file).subscribe({
      next: (uploaded) => {
        input.value = '';
        this.busy = false;
        if (this.request) {
          this.request = {
            ...this.request,
            attachments: [...(this.request.attachments ?? []), uploaded],
            version: this.request.version + 1,
          };
        }
        this.load(this.request!.id, { keepEditing: true });
      },
      error: (e) => {
        input.value = '';
        this.handleError(e);
      },
    });
  }

  removeAttachment(attachmentId: string): void {
    if (!this.request || this.busy) return;
    if (!confirm('Видалити це вкладення?')) {
      return;
    }
    this.busy = true;
    this.api.deleteRequestAttachment(this.request.id, attachmentId).subscribe({
      next: () => {
        this.load(this.request!.id, { keepEditing: this.editing });
        this.busy = false;
      },
      error: (e) => this.handleError(e),
    });
  }
}
