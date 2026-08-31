import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  EmployeeProfileCapabilities,
  EmployeeProfileHeader,
} from '@loom/contracts-employees';
import { PasswordVisibilityToggleComponent } from '../absences/public-api';
import { EmployeeAccountApiService } from './employee-account-api.service';

@Component({
  selector: 'loom-employee-account-panel',
  standalone: true,
  imports: [FormsModule, PasswordVisibilityToggleComponent],
  template: `
    <div class="account-panel">
      @if (message()) {
        <p class="ok">{{ message() }}</p>
      }
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      @if (caps().canCreateAccount) {
        <details class="disclose" open>
          <summary>Створити акаунт</summary>
          <div class="disclose-body">
            <p class="muted">Анкета без входу. Задайте логін і тимчасовий пароль.</p>
            <label>
              Email акаунта
              <input
                type="email"
                name="attachAccountEmail"
                [(ngModel)]="attachEmail"
                maxlength="254"
                autocomplete="off"
              />
            </label>
            <label>
              Тимчасовий пароль
              <div class="password-row">
                <input
                  [type]="showAttachPassword() ? 'text' : 'password'"
                  name="attachAccountPassword"
                  [(ngModel)]="attachPassword"
                  autocomplete="new-password"
                />
                <app-password-visibility-toggle
                  [visible]="showAttachPassword()"
                  showLabel="Показати"
                  hideLabel="Сховати"
                  (toggled)="showAttachPassword.set(!showAttachPassword())"
                />
              </div>
            </label>
            <button type="button" (click)="attachAccount()" [disabled]="busy()">
              Створити акаунт
            </button>
            @if (shownOneShotPassword()) {
              <p class="ok">
                Тимчасовий пароль (показується один раз):
                <strong>{{ shownOneShotPassword() }}</strong>
              </p>
            }
          </div>
        </details>
      }

      @if (caps().canResetPassword && header().userId) {
        <details class="disclose" open>
          <summary>Скидання пароля</summary>
          <div class="disclose-body">
            <p class="muted">
              Чинний пароль не зберігається у відкритому вигляді. Задайте тимчасовий.
            </p>
            <label>
              Тимчасовий пароль
              <div class="password-row">
                <input
                  [type]="showTempPassword() ? 'text' : 'password'"
                  name="resetTempPassword"
                  [(ngModel)]="tempPassword"
                  autocomplete="new-password"
                />
                <app-password-visibility-toggle
                  [visible]="showTempPassword()"
                  showLabel="Показати"
                  hideLabel="Сховати"
                  (toggled)="showTempPassword.set(!showTempPassword())"
                />
              </div>
            </label>
            <button type="button" (click)="resetPassword()" [disabled]="busy()">
              Скинути пароль
            </button>
            @if (shownOneShotPassword()) {
              <p class="ok">
                Тимчасовий пароль (показується один раз):
                <strong>{{ shownOneShotPassword() }}</strong>
              </p>
            }
          </div>
        </details>
      }

      @if (caps().canManageAccount) {
        <section class="status-block">
          <h3>Статус акаунта</h3>
          <p class="muted">{{ accountStatusLabel() }}</p>
          @if (header().accountStatus === 'active') {
            <button
              type="button"
              class="danger"
              (click)="setStatus('deactivated')"
              [disabled]="busy()"
            >
              Деактивувати
            </button>
          } @else if (header().accountStatus === 'deactivated') {
            <button type="button" (click)="setStatus('active')" [disabled]="busy()">
              Активувати
            </button>
          }
          <button
            type="button"
            class="danger"
            (click)="deleteAccount()"
            [disabled]="busy()"
          >
            Видалити акаунт
          </button>
          <p class="muted hint">
            Видалення акаунта прибирає логін; анкета працівника лишається.
          </p>
        </section>
      }

      @if (caps().canDeleteEmployee) {
        <section class="danger-zone">
          <h3>Видалити анкету повністю</h3>
          <p class="muted">
            Незворотне видалення operational aggregate (відсутності, документи,
            анкети, посади). Історичні посилання на актора стануть
            «Видалений користувач». Це не GDPR-wipe усіх даних про людину.
          </p>
          <label>
            Підтвердіть номер працівника
            <input
              type="text"
              name="confirmEmployeeNumber"
              [(ngModel)]="confirmEmployeeNumber"
              [placeholder]="header().employeeNumber"
              autocomplete="off"
            />
          </label>
          <button
            type="button"
            class="danger"
            (click)="hardDeleteEmployee()"
            [disabled]="busy() || !confirmMatches()"
          >
            Видалити анкету повністю
          </button>
        </section>
      }
    </div>
  `,
  styles: [
    `
      .account-panel {
        display: grid;
        gap: 1rem;
      }
      .disclose {
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        background: var(--pw-surface);
        padding: 0.75rem 1rem;
      }
      .disclose summary {
        cursor: pointer;
        font-weight: 600;
      }
      .disclose-body {
        display: grid;
        gap: 0.75rem;
        margin-top: 0.75rem;
      }
      label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.9rem;
      }
      input {
        padding: 0.55rem 0.7rem;
        border: 1px solid var(--pw-border);
        border-radius: 8px;
        background: var(--pw-surface-2, var(--pw-surface));
        color: var(--pw-text);
      }
      .password-row {
        display: flex;
        gap: 0.5rem;
        align-items: stretch;
      }
      .password-row input {
        flex: 1 1 auto;
      }
      button {
        justify-self: start;
        padding: 0.55rem 0.9rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border-strong, var(--pw-border));
        background: var(--pw-accent-soft, color-mix(in srgb, var(--pw-accent) 18%, transparent));
        color: var(--pw-text);
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      button.danger {
        border-color: color-mix(in srgb, var(--pw-danger, #a32d2d) 55%, var(--pw-border));
        background: color-mix(in srgb, var(--pw-danger, #a32d2d) 12%, var(--pw-surface));
        color: var(--pw-danger, #a32d2d);
      }
      .status-block,
      .danger-zone {
        display: grid;
        gap: 0.75rem;
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        padding: 0.75rem 1rem;
        background: var(--pw-surface);
      }
      .danger-zone {
        border-color: color-mix(in srgb, var(--pw-danger, #a32d2d) 40%, var(--pw-border));
      }
      h3 {
        margin: 0;
        font-size: 1rem;
      }
      .muted {
        color: var(--pw-muted);
        margin: 0;
      }
      .hint {
        font-size: 0.85rem;
      }
      .ok {
        color: var(--pw-success, #1f6b3a);
        margin: 0;
      }
      .error {
        color: var(--pw-danger, #a32d2d);
        margin: 0;
      }
    `,
  ],
})
export class EmployeeAccountPanelComponent {
  private readonly api = inject(EmployeeAccountApiService);

  readonly employeeId = input.required<string>();
  readonly header = input.required<EmployeeProfileHeader>();
  readonly caps = input.required<EmployeeProfileCapabilities>();

  readonly changed = output<void>();
  readonly deleted = output<void>();

  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly showAttachPassword = signal(false);
  readonly showTempPassword = signal(false);
  readonly shownOneShotPassword = signal('');

  attachEmail = '';
  attachPassword = 'TempPass123!';
  tempPassword = 'TempPass123!';
  confirmEmployeeNumber = '';

  accountStatusLabel(): string {
    const h = this.header();
    if (!h.hasAccount) return 'Без акаунта';
    return h.accountStatus === 'deactivated'
      ? 'Акаунт: деактивований'
      : 'Акаунт: активний';
  }

  confirmMatches(): boolean {
    return (
      this.confirmEmployeeNumber.trim() === this.header().employeeNumber.trim()
    );
  }

  attachAccount(): void {
    this.clearFeedback();
    this.busy.set(true);
    const shown = this.attachPassword;
    this.api
      .attachAccount(this.employeeId(), {
        email: this.attachEmail,
        temporaryPassword: this.attachPassword,
      })
      .subscribe({
        next: () => {
          this.attachEmail = '';
          this.attachPassword = 'TempPass123!';
          this.shownOneShotPassword.set(shown);
          this.message.set('Акаунт створено');
          this.busy.set(false);
          this.changed.emit();
        },
        error: (err) => this.fail(err, 'Не вдалося створити акаунт'),
      });
  }

  resetPassword(): void {
    const userId = this.header().userId;
    if (!userId) return;
    this.clearFeedback();
    this.busy.set(true);
    const shown = this.tempPassword;
    this.api.resetPassword(userId, this.tempPassword).subscribe({
      next: () => {
        this.shownOneShotPassword.set(shown);
        this.message.set('Пароль скинуто');
        this.busy.set(false);
        this.changed.emit();
      },
      error: (err) => this.fail(err, 'Не вдалося скинути пароль'),
    });
  }

  setStatus(status: 'active' | 'deactivated'): void {
    this.clearFeedback();
    this.busy.set(true);
    this.api.updateStatus(this.employeeId(), status).subscribe({
      next: () => {
        this.message.set(
          status === 'deactivated' ? 'Акаунт деактивовано' : 'Акаунт активовано',
        );
        this.busy.set(false);
        this.changed.emit();
      },
      error: (err) =>
        this.fail(
          err,
          status === 'deactivated'
            ? 'Не вдалося деактивувати'
            : 'Не вдалося активувати',
        ),
    });
  }

  deleteAccount(): void {
    const ok = confirm(
      'Видалити обліковий запис? Працівник більше не зможе входити в систему. Анкета залишиться.',
    );
    if (!ok) return;
    this.clearFeedback();
    this.busy.set(true);
    this.api.deleteAccount(this.employeeId()).subscribe({
      next: () => {
        this.message.set('Обліковий запис видалено');
        this.busy.set(false);
        this.changed.emit();
      },
      error: (err) => this.fail(err, 'Не вдалося видалити акаунт'),
    });
  }

  hardDeleteEmployee(): void {
    if (!this.confirmMatches()) return;
    const ok = confirm(
      `Видалити анкету ${this.header().employeeNumber} повністю? Дію неможливо скасувати.`,
    );
    if (!ok) return;
    this.clearFeedback();
    this.busy.set(true);
    this.api.deleteEmployee(this.employeeId()).subscribe({
      next: () => {
        this.busy.set(false);
        this.deleted.emit();
      },
      error: (err) => this.fail(err, 'Не вдалося видалити анкету'),
    });
  }

  private clearFeedback(): void {
    this.message.set('');
    this.error.set('');
    this.shownOneShotPassword.set('');
  }

  private fail(err: { error?: { message?: string | string[] } }, fallback: string): void {
    const msg = err?.error?.message;
    this.error.set(Array.isArray(msg) ? msg.join(', ') : msg || fallback);
    this.busy.set(false);
  }
}
