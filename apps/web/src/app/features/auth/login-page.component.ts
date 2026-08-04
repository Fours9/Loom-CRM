import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import type { LoginResponse } from '@loom/contracts-auth';
import { SessionStore } from '../../core/auth/session.store';
import { environment } from '../../../environments/environment';
import {
  MODULE_NAME,
  PLATFORM_NAME,
  PLATFORM_TAGLINE,
} from '../../core/brand/platform';
import { ThemeService } from '../../core/theme/theme.service';
import { PasswordVisibilityToggleComponent } from '../../shared/password-visibility-toggle.component';

@Component({
  selector: 'loom-login-page',
  standalone: true,
  imports: [FormsModule, PasswordVisibilityToggleComponent],
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
        <blockquote class="tagline">
          <p>{{ tagline }}</p>
        </blockquote>
        <h1>Вхід</h1>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <form class="login-form" (ngSubmit)="submit()">
          <label>
            Email
            <input [(ngModel)]="email" name="email" type="email" autocomplete="username" />
          </label>
          <label>
            Пароль
            <div class="password-row">
              <input
                [(ngModel)]="password"
                name="password"
                [type]="showPassword() ? 'text' : 'password'"
                autocomplete="current-password"
              />
              <app-password-visibility-toggle
                [visible]="showPassword()"
                showLabel="Показати"
                hideLabel="Сховати"
                (toggled)="togglePassword()"
              />
            </div>
          </label>
          <button type="submit" class="btn" [disabled]="busy()">
            Увійти
          </button>
        </form>
        @if (showGuest()) {
          <button type="button" class="link" (click)="guest()">
            Продовжити як гість (dev)
          </button>
        }
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
        padding: 0.4rem 0.75rem;
        cursor: pointer;
        font-weight: 600;
        z-index: 5;
        min-height: 2.75rem;
      }
      .card {
        width: min(420px, 100%);
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        padding: 2rem;
        display: grid;
        gap: 1rem;
        box-shadow: 0 8px 24px var(--pw-shadow);
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 0.65rem;
        width: fit-content;
      }
      .brand-mark {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        display: block;
        flex-shrink: 0;
      }
      .brand-text {
        display: grid;
        gap: 0.15rem;
      }
      .brand-name {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--pw-accent);
        line-height: 1.1;
      }
      .brand-module {
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--pw-muted);
      }
      .tagline {
        margin: 0;
        padding: 0.85rem 1rem;
        border: 1px solid var(--pw-border);
        border-left: 3px solid var(--pw-accent);
        border-radius: 10px;
        background: var(--pw-surface-2);
      }
      .tagline p {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--pw-accent);
      }
      h1 {
        margin: 0.25rem 0 0;
        font-size: 1.15rem;
        font-weight: 600;
        color: var(--pw-text-strong);
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
        border: 0;
        color: var(--pw-muted);
        font-size: 0.9rem;
        text-align: center;
        cursor: pointer;
        min-height: auto;
        padding: 0.25rem;
      }
    `,
  ],
})
export class LoginPageComponent {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);

  readonly platformName = PLATFORM_NAME;
  readonly moduleName = MODULE_NAME;
  readonly tagline = PLATFORM_TAGLINE;

  email = '';
  password = '';
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  showGuest(): boolean {
    return environment.allowGuestMode;
  }

  guest(): void {
    void this.router.navigate(['/'], { queryParams: { guest: '1' } });
  }

  submit(): void {
    this.busy.set(true);
    this.error.set(null);
    this.http
      .post<LoginResponse>(`${environment.apiBaseUrl}/auth/login`, {
        email: this.email,
        password: this.password,
      })
      .subscribe({
        next: (res) => {
          this.session.setAuthenticated(res.user, res.accessToken);
          this.busy.set(false);
          void this.router.navigateByUrl('/');
        },
        error: () => {
          this.error.set('Невірний email або пароль');
          this.busy.set(false);
        },
      });
  }
}
