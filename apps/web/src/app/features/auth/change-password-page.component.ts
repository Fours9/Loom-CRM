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
        class="theme-toggle pw-rise"
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

      <section class="card pw-stage">
        <span class="pw-stage__glow" aria-hidden="true"></span>
        <div class="brand pw-rise">
          <img
            class="brand-mark"
            src="assets/loom-mark.png"
            width="56"
            height="56"
            alt=""
          />
          <span class="brand-text">
            <span class="brand-name">{{ platformName }}</span>
            <span class="brand-module">{{ moduleName }}</span>
          </span>
        </div>
        <h1 class="pw-rise" style="--pw-delay: 70ms">Зміна пароля</h1>
        <p class="hint pw-rise" style="--pw-delay: 100ms">
          Після першого входу потрібно змінити тимчасовий пароль.
        </p>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <form class="login-form pw-rise" style="--pw-delay: 140ms" [formGroup]="form" (ngSubmit)="submit()">
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
          <ul class="reqs" aria-label="Вимоги до нового пароля">
            <li [class.ok]="reqMinLength()">Мінімум 8 символів</li>
            <li [class.ok]="reqLetter()">
              Щонайменше одна латинська літера (A–Z / a–z)
            </li>
            <li [class.ok]="reqDigit()">Щонайменше одна цифра (0–9)</li>
            <li [class.ok]="reqMatch()">Новий пароль і підтвердження збігаються</li>
          </ul>
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
          @if (form.hasError('passwordsMismatch') && form.get('confirmPassword')?.touched) {
            <p class="error">Паролі не збігаються</p>
          }
          <button type="submit" class="btn pw-btn" [disabled]="busy()">
            {{ busy() ? 'Збереження…' : 'Зберегти' }}
          </button>
        </form>
        <button type="button" class="link pw-rise" style="--pw-delay: 190ms" (click)="logout()">Вийти</button>
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
        background: color-mix(in srgb, var(--pw-surface) 92%, transparent);
        color: var(--pw-text);
        border-radius: 12px;
        padding: 0.45rem 0.85rem;
        cursor: pointer;
        font-weight: 700;
        box-shadow: 0 4px 16px var(--pw-shadow);
        backdrop-filter: blur(8px);
      }
      .card {
        width: min(440px, 100%);
        padding: clamp(1.5rem, 4vw, 2.15rem);
        display: grid;
        gap: 1.05rem;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .brand-mark {
        width: 56px;
        height: 56px;
        border-radius: 16px;
        box-shadow:
          0 0 0 1px color-mix(in srgb, var(--pw-accent) 18%, var(--pw-border)),
          0 8px 22px var(--pw-shadow);
      }
      .brand-text {
        display: grid;
        gap: 0.12rem;
      }
      .brand-name {
        font-weight: 750;
        font-size: 1.55rem;
        letter-spacing: -0.03em;
        color: var(--pw-accent);
      }
      .brand-module {
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--pw-muted);
      }
      h1 {
        margin: 0;
        font-size: clamp(1.45rem, 3vw, 1.7rem);
        font-weight: 750;
        letter-spacing: -0.02em;
      }
      .hint {
        margin: 0;
        color: var(--pw-accent);
        font-size: 1rem;
        font-weight: 600;
        line-height: 1.35;
      }
      .reqs {
        list-style: none;
        margin: 0;
        padding: 0.65rem 0.85rem;
        display: grid;
        gap: 0.35rem;
        border-radius: 14px;
        border: 1px solid color-mix(in srgb, var(--pw-accent) 14%, var(--pw-border));
        background: color-mix(in srgb, var(--pw-surface) 88%, transparent);
        font-size: 0.85rem;
        color: var(--pw-muted);
      }
      .reqs li.ok {
        color: var(--pw-success, #15803d);
        font-weight: 600;
      }
      .error {
        margin: 0;
        color: var(--pw-danger);
        font-weight: 600;
      }
      label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.82rem;
        font-weight: 700;
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
        border-radius: 12px;
        padding: 0.7rem 0.85rem;
        min-height: 2.85rem;
      }
      input:focus-visible {
        outline: none;
        border-color: var(--pw-accent);
        box-shadow: var(--pw-focus-ring, 0 0 0 3px color-mix(in srgb, var(--pw-accent) 28%, transparent));
      }
      .btn {
        margin-top: 0.2rem;
        width: 100%;
      }
      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }
      .link {
        background: color-mix(in srgb, var(--pw-surface) 88%, transparent);
        border: 1px solid color-mix(in srgb, var(--pw-accent) 28%, var(--pw-border));
        color: var(--pw-accent);
        font-size: 0.9rem;
        font-weight: 700;
        text-align: center;
        cursor: pointer;
        border-radius: 14px;
        padding: 0.75rem 1rem;
        transition:
          background 0.16s ease,
          border-color 0.16s ease;
      }
      .link:hover {
        background: var(--pw-accent-soft);
        border-color: var(--pw-accent);
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

  reqMinLength(): boolean {
    const v = this.form.controls.newPassword.value ?? '';
    return v.length >= 8;
  }

  reqLetter(): boolean {
    return /[A-Za-z]/.test(this.form.controls.newPassword.value ?? '');
  }

  reqDigit(): boolean {
    return /\d/.test(this.form.controls.newPassword.value ?? '');
  }

  reqMatch(): boolean {
    const next = this.form.controls.newPassword.value ?? '';
    const confirm = this.form.controls.confirmPassword.value ?? '';
    return confirm.length > 0 && next === confirm;
  }

  submit(): void {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (!this.form.hasError('passwordsMismatch')) {
        this.error.set(
          'Пароль: мін. 8 символів, латинська літера та цифра.',
        );
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
