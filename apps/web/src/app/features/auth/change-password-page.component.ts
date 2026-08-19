import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import type { LoginResponse } from '@loom/contracts-auth';
import { SessionStore } from '../../core/auth/session.store';
import { environment } from '../../../environments/environment';
import {
  MODULE_NAME,
  PLATFORM_NAME,
} from '../../core/brand/platform';
import { ThemeService } from '../../core/theme/theme.service';
import { PasswordVisibilityToggleComponent } from '../../shared/password-visibility-toggle.component';

const NEW_PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const next = group.get('newPassword')?.value ?? '';
  const confirm = group.get('confirmPassword')?.value ?? '';
  if (!confirm) {
    return null;
  }
  return next === confirm ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'loom-change-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, PasswordVisibilityToggleComponent],
  template: `
    <div class="login app-shell">
      <button
        type="button"
        class="theme-toggle"
        (click)="theme.toggle()"
        [attr.aria-label]="
          theme.mode() === 'dark' ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'
        "
        [title]="theme.mode() === 'dark' ? 'Темна тема' : 'Світла тема'"
      >
        @if (theme.mode() === 'dark') {
          <span aria-hidden="true">☾</span> Темна
        } @else {
          <span aria-hidden="true">☀</span> Світла
        }
      </button>

      <section class="card">
        <div class="brand">
          <img
            class="brand-mark"
            src="assets/loom-mark.png"
            width="44"
            height="44"
            alt=""
          />
          <span class="brand-text">
            <span class="brand-name">{{ platformName }}</span>
            <span class="brand-module">{{ moduleName }}</span>
          </span>
        </div>
        <h1>Зміна пароля</h1>
        <p class="hint">
          Після першого входу потрібно змінити тимчасовий пароль.
        </p>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <form class="login-form" [formGroup]="form" (ngSubmit)="submit()">
          <label>
            Поточний пароль
            <div class="password-row">
              <input
                [type]="showCurrent() ? 'text' : 'password'"
                formControlName="currentPassword"
                autocomplete="current-password"
              />
              <app-password-visibility-toggle
                [visible]="showCurrent()"
                showLabel="Показати"
                hideLabel="Сховати"
                (toggled)="toggleCurrent()"
              />
            </div>
          </label>
          <label>
            Новий пароль
            <div class="password-row">
              <input
                [type]="showNext() ? 'text' : 'password'"
                formControlName="newPassword"
                autocomplete="new-password"
              />
              <app-password-visibility-toggle
                [visible]="showNext()"
                showLabel="Показати"
                hideLabel="Сховати"
                (toggled)="toggleNext()"
              />
            </div>
          </label>
          <label>
            Повтор нового пароля
            <div class="password-row">
              <input
                [type]="showConfirm() ? 'text' : 'password'"
                formControlName="confirmPassword"
                autocomplete="new-password"
              />
              <app-password-visibility-toggle
                [visible]="showConfirm()"
                showLabel="Показати"
                hideLabel="Сховати"
                (toggled)="toggleConfirm()"
              />
            </div>
          </label>
          <p class="hint">Мінімум 8 символів, літера та цифра.</p>
          @if (form.hasError('passwordsMismatch') && form.get('confirmPassword')?.touched) {
            <p class="error">Паролі не збігаються</p>
          }
          <button type="submit" class="btn" [disabled]="busy()">
            {{ busy() ? 'Збереження…' : 'Зберегти' }}
          </button>
        </form>
        <button type="button" class="link" (click)="logout()">Вийти</button>
      </section>
    </div>
  `,
  styles: [
    `
      .login {
        min-height: 100vh;
        min-height: 100dvh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
        background: linear-gradient(
          180deg,
          var(--pw-bg-grad-top) 0%,
          var(--pw-bg-grad-mid) 40%,
          var(--pw-bg-grad-bot) 100%
        );
        color: var(--pw-text);
        font-family: Manrope, 'Segoe UI', sans-serif;
      }
      .theme-toggle {
        position: fixed;
        top: 1rem;
        right: 1rem;
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        border: 1px solid var(--pw-border-strong);
        background: var(--pw-surface);
        color: var(--pw-text);
        border-radius: 8px;
        padding: 0.4rem 0.7rem;
        cursor: pointer;
      }
      .card {
        width: min(420px, 100%);
        padding: 2rem;
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        background: var(--pw-surface);
        display: grid;
        gap: 1rem;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .brand-text {
        display: grid;
      }
      .brand-name {
        font-weight: 700;
      }
      .brand-module {
        font-size: 0.85rem;
        color: var(--pw-muted);
      }
      h1 {
        margin: 0;
        font-size: 1.35rem;
      }
      .hint {
        margin: 0;
        color: var(--pw-muted);
        font-size: 0.9rem;
      }
      .error {
        margin: 0;
        color: var(--pw-danger);
      }
      label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.9rem;
        color: var(--pw-muted);
      }
      .login-form {
        display: grid;
        gap: 1rem;
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
      input {
        border: 1px solid var(--pw-border-strong);
        background: var(--pw-input-bg);
        color: var(--pw-text);
        border-radius: 8px;
        padding: 0.65rem 0.75rem;
        min-height: 2.75rem;
      }
      .btn {
        margin-top: 0.25rem;
        padding: 0.75rem 1rem;
        border: 0;
        border-radius: 8px;
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        font-weight: 600;
        min-height: 2.75rem;
        cursor: pointer;
      }
      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .link {
        background: transparent;
        border: 1px solid var(--pw-border-strong);
        color: var(--pw-accent);
        font-size: 0.9rem;
        text-align: center;
        cursor: pointer;
        border-radius: 8px;
        padding: 0.75rem 1rem;
      }
    `,
  ],
})
export class ChangePasswordPageComponent {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly theme = inject(ThemeService);

  readonly platformName = PLATFORM_NAME;
  readonly moduleName = MODULE_NAME;

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly showCurrent = signal(false);
  readonly showNext = signal(false);
  readonly showConfirm = signal(false);

  toggleCurrent(): void {
    this.showCurrent.update((v) => !v);
  }

  toggleNext(): void {
    this.showNext.update((v) => !v);
  }

  toggleConfirm(): void {
    this.showConfirm.update((v) => !v);
  }

  readonly form = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(NEW_PASSWORD_PATTERN),
        ],
      ],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  submit(): void {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (!this.form.hasError('passwordsMismatch')) {
        this.error.set('Перевірте поля пароля (мін. 8 символів, літера та цифра).');
      }
      return;
    }

    this.busy.set(true);
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.http
      .post<LoginResponse>(`${environment.apiBaseUrl}/auth/change-password`, {
        currentPassword,
        newPassword,
      })
      .subscribe({
        next: (res) => {
          this.session.setAuthenticated(res.user, res.accessToken);
          this.busy.set(false);
          void this.router.navigateByUrl('/');
        },
        error: () => {
          this.error.set('Не вдалося змінити пароль');
          this.busy.set(false);
        },
      });
  }

  logout(): void {
    this.session.logout();
    void this.router.navigateByUrl('/login');
  }
}
