import {
  Component,
  DestroyRef,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, switchMap, tap } from 'rxjs';
import { ApiService } from '../core/api/api.service';
import { ScheduleDay } from '../core/api/models';
import {
  cloneSchedule,
  normalizeSchedulePayload,
} from '../core/schedule/schedule.util';
import { ScheduleEditorComponent } from '../shared/schedule-editor.component';

/**
 * People / Absences integration panel for weekly work schedule.
 *
 * Loads via getEmployee() (schedule + permissions.canEditSchedule) because there
 * is no schedule+capability endpoint; do not duplicate permission logic on FE.
 *
 * View never calls cloneSchedule — empty API schedule stays empty until edit draft.
 */
@Component({
  selector: 'app-employee-work-schedule-panel',
  standalone: true,
  imports: [ScheduleEditorComponent],
  template: `
    <div class="panel">
      @if (!loading && !loadError && canEditSchedule) {
        <div class="card-head actions">
          @if (!editing) {
            <button type="button" class="pw-link-action" (click)="startEdit()">
              {{ persistedSchedule.length === 0 ? 'Налаштувати графік' : 'Редагувати' }}
            </button>
          } @else {
            <button
              type="button"
              class="btn pw-btn"
              [disabled]="saving"
              (click)="save()"
            >
              {{ saving ? 'Збереження…' : 'Зберегти' }}
            </button>
            <button
              type="button"
              class="pw-link-action"
              [disabled]="saving"
              (click)="cancelEdit()"
            >
              Скасувати
            </button>
          }
        </div>
      }

      @if (loading) {
        <p class="muted">Завантаження графіка…</p>
      } @else if (loadError) {
        <p class="error">{{ loadError }}</p>
      } @else if (!editing && persistedSchedule.length === 0) {
        <p class="muted">Графік роботи ще не налаштований.</p>
      } @else {
        @if (saveError) {
          <p class="error">{{ saveError }}</p>
        }
        <app-schedule-editor
          [days]="editing ? draftSchedule : persistedSchedule"
          [readonly]="!editing"
          namePrefix="people_schedule_"
        />
      }
    </div>
  `,
  styles: [
    `
      .panel {
        display: grid;
        gap: 0.6rem;
      }
      .card-head {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        align-items: center;
        flex-wrap: wrap;
        min-height: 2.75rem;
      }
      .muted {
        color: var(--pw-muted);
        margin: 0;
      }
      .error {
        color: var(--pw-danger);
        margin: 0;
      }
    `,
  ],
})
export class EmployeeWorkSchedulePanelComponent implements OnChanges {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly load$ = new Subject<string>();

  @Input({ required: true }) employeeId!: string;

  persistedSchedule: ScheduleDay[] = [];
  draftSchedule: ScheduleDay[] = [];
  canEditSchedule = false;
  editing = false;
  saving = false;
  loading = false;
  loadError = '';
  saveError = '';

  constructor() {
    this.load$
      .pipe(
        switchMap((employeeId) => {
          this.loading = true;
          this.loadError = '';
          return this.api.getEmployee(employeeId).pipe(
            tap((employee) => {
              if (employee.id !== this.employeeId) {
                return;
              }
              this.persistedSchedule = [...(employee.schedule ?? [])];
              this.canEditSchedule = Boolean(
                employee.permissions?.canEditSchedule,
              );
              this.loading = false;
            }),
            catchError(() => {
              if (employeeId === this.employeeId) {
                this.persistedSchedule = [];
                this.canEditSchedule = false;
                this.loadError = 'Не вдалося завантажити графік';
                this.loading = false;
              }
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['employeeId'] && this.employeeId) {
      this.resetLocalState();
      this.load$.next(this.employeeId);
    }
  }

  startEdit(): void {
    if (!this.canEditSchedule || this.saving) return;
    this.saveError = '';
    this.draftSchedule = cloneSchedule(this.persistedSchedule);
    this.editing = true;
  }

  cancelEdit(): void {
    if (this.saving) return;
    this.draftSchedule = [];
    this.editing = false;
    this.saveError = '';
  }

  save(): void {
    if (!this.canEditSchedule || this.saving || !this.editing) return;
    this.saving = true;
    this.saveError = '';
    const employeeId = this.employeeId;
    this.api
      .putSchedule(employeeId, normalizeSchedulePayload(this.draftSchedule))
      .subscribe({
        next: (savedDays) => {
          if (employeeId !== this.employeeId) {
            return;
          }
          this.persistedSchedule = savedDays;
          this.draftSchedule = [];
          this.editing = false;
          this.saving = false;
          this.saveError = '';
        },
        error: () => {
          if (employeeId !== this.employeeId) {
            return;
          }
          this.saveError = 'Не вдалося зберегти графік';
          this.saving = false;
        },
      });
  }

  private resetLocalState(): void {
    this.editing = false;
    this.saving = false;
    this.persistedSchedule = [];
    this.draftSchedule = [];
    this.loadError = '';
    this.saveError = '';
    this.canEditSchedule = false;
  }
}
