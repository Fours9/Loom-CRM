import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { QuestionnaireAttachConstraint } from '@loom/contracts-questionnaires';
import type { EmployeeListItem } from '@loom/contracts-employees';
import { QuestionnaireEmployeeTypeaheadComponent } from '../shared/questionnaire-employee-typeahead.component';
import { OverlayScrollLockService } from '../../../core/overlay/overlay-scroll-lock.service';
import { attachPwDialogHostToBody } from '../../../shared/ui/pw-dialog-host';

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
        aria-labelledby="questionnaire-attach-picker-title"
      >
        <div class="head">
          <h2 id="questionnaire-attach-picker-title">Прикріпити анкету</h2>
          <button
            type="button"
            class="icon-close"
            aria-label="Закрити"
            title="Закрити"
            [disabled]="busy()"
            (click)="close.emit()"
          >
            ×
          </button>
        </div>

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
            class="btn pw-btn pw-btn--ghost"
            [disabled]="busy()"
            (click)="close.emit()"
          >
            Скасувати
          </button>
          <button
            type="button"
            class="btn pw-btn"
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
        overflow-y: auto;
      }
      .modal {
        position: relative;
        display: grid;
        gap: 0.75rem;
        width: min(28rem, 100%);
        margin: auto;
        padding: 1.1rem 1.2rem 1.25rem;
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
        padding-right: 2.5rem;
      }
      h2 {
        margin: 0;
        font-size: 1.1rem;
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
        border: 1px solid var(--pw-border-strong, var(--pw-border));
        border-radius: 8px;
        cursor: pointer;
      }
      .icon-close:disabled {
        opacity: 0.55;
        cursor: default;
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
      .btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
    `,
  ],
})
export class QuestionnaireAttachPickerComponent implements OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
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
    attachPwDialogHostToBody(this.host);
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
