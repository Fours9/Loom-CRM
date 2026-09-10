import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ScheduleDay } from './schedule.model';
import { WEEKDAY_LABELS } from './weekday-labels';
import {
  applyWorkingDayToggle,
  clearScheduleBreak,
} from './schedule.util';

@Component({
  selector: 'app-schedule-editor',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (readonly) {
      <ul class="schedule">
        @for (day of days; track day.weekday) {
          <li>
            <strong>{{ weekdayLabel(day.weekday) }}</strong>
            @if (day.isWorkingDay) {
              <div class="day-meta">
                <span>{{ day.startTime }}–{{ day.endTime }}</span>
                @if (day.breakStart && day.breakEnd) {
                  <span class="muted break-line"
                    >перерва {{ day.breakStart }}–{{ day.breakEnd }}</span
                  >
                } @else {
                  <span class="muted break-line">без перерви</span>
                }
              </div>
            } @else {
              <span>вихідний</span>
            }
          </li>
        }
      </ul>
    } @else {
      <ul class="schedule schedule-edit">
        @for (day of days; track day.weekday) {
          <li>
            <label class="day-check">
              <input
                type="checkbox"
                [ngModel]="day.isWorkingDay"
                (ngModelChange)="onWorkingDayToggle(day, $event)"
                [name]="namePrefix + 'work_' + day.weekday"
              />
              <strong>{{ weekdayLabel(day.weekday) }}</strong>
            </label>
            @if (day.isWorkingDay) {
              <div class="day-fields">
                <div class="time-group">
                  <span class="muted time-group-label">робота</span>
                  <div class="time-pair">
                    <label class="time-field">
                      <span class="time-field-label">Початок</span>
                      <input
                        type="time"
                        [(ngModel)]="day.startTime"
                        [name]="namePrefix + 'start_' + day.weekday"
                        [attr.aria-label]="weekdayLabel(day.weekday) + ' — початок'"
                        required
                      />
                    </label>
                    <span class="time-dash" aria-hidden="true">–</span>
                    <label class="time-field">
                      <span class="time-field-label">Кінець</span>
                      <input
                        type="time"
                        [(ngModel)]="day.endTime"
                        [name]="namePrefix + 'end_' + day.weekday"
                        [attr.aria-label]="weekdayLabel(day.weekday) + ' — кінець'"
                        required
                      />
                    </label>
                  </div>
                </div>
                <div class="time-group">
                  <span class="muted time-group-label">перерва</span>
                  <div class="time-pair">
                    <label class="time-field">
                      <span class="time-field-label">Початок</span>
                      <input
                        type="time"
                        [(ngModel)]="day.breakStart"
                        [name]="namePrefix + 'break_start_' + day.weekday"
                        [attr.aria-label]="weekdayLabel(day.weekday) + ' — початок перерви'"
                      />
                    </label>
                    <span class="time-dash" aria-hidden="true">–</span>
                    <label class="time-field">
                      <span class="time-field-label">Кінець</span>
                      <input
                        type="time"
                        [(ngModel)]="day.breakEnd"
                        [name]="namePrefix + 'break_end_' + day.weekday"
                        [attr.aria-label]="weekdayLabel(day.weekday) + ' — кінець перерви'"
                      />
                    </label>
                    <button
                      type="button"
                      class="ghost-btn clear-break"
                      [disabled]="!day.breakStart && !day.breakEnd"
                      (click)="clearBreak(day)"
                    >
                      без перерви
                    </button>
                  </div>
                </div>
              </div>
            } @else {
              <span class="muted">вихідний</span>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 0;
      }
      .schedule {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0;
      }
      .schedule li {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0.5rem;
        padding: 0.75rem 0;
        border-bottom: 1px solid
          color-mix(in srgb, var(--pw-muted) 55%, transparent);
      }
      .schedule li:last-child {
        border-bottom: 0;
        padding-bottom: 0;
      }
      .schedule li:first-child {
        padding-top: 0;
      }
      @media (min-width: 641px) {
        .schedule li {
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          padding: 0.55rem 0;
        }
      }
      .day-meta {
        display: grid;
        justify-items: start;
        gap: 0.15rem;
        text-align: left;
      }
      @media (min-width: 641px) {
        .day-meta {
          justify-items: end;
          text-align: right;
        }
      }
      .break-line {
        font-size: 0.85rem;
      }
      .day-check {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0;
      }
      @media (min-width: 641px) {
        .day-check {
          min-width: 8rem;
        }
      }
      .day-check input {
        width: auto;
      }
      .day-fields {
        display: grid;
        gap: 0.6rem;
        padding-left: 1.7rem;
      }
      @media (min-width: 641px) {
        .day-fields {
          gap: 0.35rem;
          margin-left: auto;
          padding-left: 0;
        }
      }
      .time-group {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      @media (min-width: 641px) {
        .time-group {
          flex-direction: row;
          align-items: center;
          justify-content: flex-end;
          gap: 0.35rem;
        }
      }
      .time-group-label {
        font-size: 0.8rem;
        font-weight: 600;
      }
      @media (min-width: 641px) {
        .time-group-label {
          min-width: 3.6rem;
          text-align: right;
          font-weight: 400;
        }
      }
      .time-pair {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .time-field {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }
      @media (min-width: 641px) {
        .time-field {
          flex-direction: row;
          align-items: center;
          gap: 0.35rem;
        }
      }
      .time-field-label {
        font-size: 0.8rem;
        color: var(--pw-muted);
        white-space: nowrap;
      }
      .time-dash {
        display: none;
        color: var(--pw-muted);
      }
      @media (min-width: 641px) {
        .time-field-label {
          display: none;
        }
        .time-dash {
          display: inline;
        }
      }
      .time-field input[type='time'] {
        width: auto;
        min-width: 7rem;
        padding: 0.35rem 0.5rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border-strong);
        box-sizing: border-box;
      }
      .ghost-btn {
        background: transparent;
        border: 0;
        color: var(--pw-accent);
        cursor: pointer;
        padding: 0.25rem 0.4rem;
        width: auto;
      }
      .ghost-btn:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .ghost-btn:not(:disabled):hover {
        text-decoration: underline;
      }
      .clear-break {
        font-size: 0.8rem;
        white-space: nowrap;
      }
      .muted {
        color: var(--pw-muted);
        margin: 0;
      }
    `,
  ],
})
export class ScheduleEditorComponent {
  /** Мутабельний масив днів — батьківський компонент тримає стан. */
  @Input({ required: true }) days: ScheduleDay[] = [];
  @Input() readonly = false;
  /** Префікс name для уникнення колізій ngModel у формах з кількома редакторами. */
  @Input() namePrefix = '';

  weekdayLabel(day: number): string {
    return WEEKDAY_LABELS[day] ?? String(day);
  }

  onWorkingDayToggle(day: ScheduleDay, isWorkingDay: boolean): void {
    applyWorkingDayToggle(day, isWorkingDay);
  }

  clearBreak(day: ScheduleDay): void {
    clearScheduleBreak(day);
  }
}
