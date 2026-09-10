import { Component, OnDestroy, OnInit, computed, inject, input, output } from '@angular/core';
import type { QuestionnaireAttachConstraint } from '@loom/contracts-questionnaires';
import type { EmployeeListItem } from '@loom/contracts-employees';
import { QuestionnaireEmployeeTypeaheadComponent } from '../shared/questionnaire-employee-typeahead.component';
import { signal } from '@angular/core';
import { OverlayScrollLockService } from '../../../core/overlay/overlay-scroll-lock.service';

/**
 * Modal for attaching an unattached/detached assignment to any employee.
 */
@Component({
  selector: 'loom-questionnaire-attach-picker',
  standalone: true,
  imports: [QuestionnaireEmployeeTypeaheadComponent],
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
      >
        <h2>Прикріпити анкету</h2>

        @if (constraint()?.kind === 'any_employee') {
          <loom-questionnaire-employee-typeahead
            (employeeChange)="onEmployee($event)"
          />
        } @else {
          <p class="muted">Прикріплення недоступне для цього стану.</p>
        }

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <div class="actions">
          <button
            type="button"
            class="btn"
            [disabled]="busy()"
            (click)="close.emit()"
          >
            Скасувати
          </button>
          <button
            type="button"
            class="btn primary"
            [disabled]="busy() || !canConfirm()"
            (click)="onConfirm()"
          >
            {{ busy() ? 'Прикріплення…' : 'Прикріпити' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: 50;
        display: grid;
        place-items: center;
        background: color-mix(in srgb, #0f172a 45%, transparent);
        padding: 1rem;
        overflow-y: auto;
      }
      .modal {
        display: grid;
        gap: 0.75rem;
        width: min(28rem, 100%);
        margin: auto;
        padding: 1.1rem 1.2rem 1.25rem;
        border-radius: 12px;
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
        overflow: visible;
      }
      h2 {
        margin: 0;
        font-size: 1.1rem;
      }
      .muted {
        margin: 0;
        color: var(--pw-muted);
        font-size: 0.9rem;
      }
      .error {
        margin: 0;
        color: #b42318;
        font-size: 0.9rem;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 0.25rem;
      }
      .btn {
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        padding: 0.4rem 0.85rem;
        background: var(--pw-surface);
        cursor: pointer;
      }
      .btn.primary {
        background: var(--pw-accent);
        border-color: var(--pw-accent);
        color: #fff;
      }
      .btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
    `,
  ],
})
export class QuestionnaireAttachPickerComponent implements OnInit, OnDestroy {
  private readonly scrollLock = inject(OverlayScrollLockService);
  readonly constraint = input<QuestionnaireAttachConstraint>(null);
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly confirm = output<string>();
  readonly close = output<void>();

  readonly selectedEmployeeId = signal<string | null>(null);

  readonly canConfirm = computed(
    () =>
      this.constraint()?.kind === 'any_employee' && !!this.selectedEmployeeId(),
  );

  private backdropPress = false;

  ngOnInit(): void {
    this.scrollLock.acquire();
  }

  ngOnDestroy(): void {
    this.scrollLock.release();
  }

  onBackdropPointerDown(event: MouseEvent): void {
    this.backdropPress = event.target === event.currentTarget;
  }

  onBackdropClick(event: MouseEvent): void {
    if (this.backdropPress && event.target === event.currentTarget) {
      this.close.emit();
    }
    this.backdropPress = false;
  }

  onEmployee(emp: Pick<EmployeeListItem, 'id' | 'fullName'> | null): void {
    this.selectedEmployeeId.set(emp?.id ?? null);
  }

  onConfirm(): void {
    const employeeId = this.selectedEmployeeId();
    if (!employeeId) return;
    this.confirm.emit(employeeId);
  }
}
