import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import type { LoginResponse } from '@loom/contracts-auth';
import { destinationAfterAuth } from '../../core/auth/auth-session.policy';
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
        <blockquote class="tagline pw-rise" style="--pw-delay: 70ms">
          <p>{{ tagline }}</p>
        </blockquote>
        <h1 class="pw-rise" style="--pw-delay: 110ms">Вхід</h1>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <form class="login-form pw-rise" style="--pw-delay: 150ms" (ngSubmit)="submit()">
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
          <button type="submit" class="btn pw-btn" [disabled]="busy()">
            Увійти
          </button>
        </form>
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
        z-index: 5;
        min-height: 2.75rem;
        box-shadow: 0 4px 16px var(--pw-shadow);
        backdrop-filter: blur(8px);
        transition:
          border-color 0.16s ease,
          color 0.16s ease,
          background 0.16s ease;
      }
      .theme-toggle:hover {
        border-color: var(--pw-accent);
        color: var(--pw-accent);
        background: var(--pw-accent-soft);
      }
      .card {
        width: min(440px, 100%);
        padding: clamp(1.5rem, 4vw, 2.15rem);
        display: grid;
        gap: 1.05rem;
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 0.75rem;
        width: fit-content;
      }
      .brand-mark {
        width: 56px;
        height: 56px;
        border-radius: 16px;
        display: block;
        flex-shrink: 0;
        box-shadow:
          0 0 0 1px color-mix(in srgb, var(--pw-accent) 18%, var(--pw-border)),
          0 8px 22px var(--pw-shadow);
      }
      .brand-text {
        display: grid;
        gap: 0.15rem;
      }
      .brand-name {
        font-size: clamp(1.55rem, 4vw, 1.85rem);
        font-weight: 750;
        letter-spacing: -0.03em;
        color: var(--pw-accent);
        line-height: 1.05;
      }
      .brand-module {
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--pw-muted);
      }
      .tagline {
        margin: 0;
        padding: 0.95rem 1.05rem;
        border: 1px solid color-mix(in srgb, var(--pw-accent) 18%, var(--pw-border));
        border-left: 3px solid var(--pw-accent);
        border-radius: 14px;
        background: color-mix(in srgb, var(--pw-surface) 88%, transparent);
        box-shadow: 0 2px 12px var(--pw-shadow);
      }
      .tagline p {
        margin: 0;
        font-size: 1rem;
        font-weight: 650;
        line-height: 1.4;
        color: var(--pw-accent);
      }
      h1 {
        margin: 0.1rem 0 0;
        font-size: clamp(1.35rem, 3vw, 1.55rem);
        font-weight: 750;
        letter-spacing: -0.02em;
        color: var(--pw-text-strong);
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
        transition:
          border-color 0.16s ease,
          box-shadow 0.16s ease;
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
          void this.router.navigateByUrl(
            destinationAfterAuth(res.user.mustChangePassword),
          );
        },
        error: () => {
          this.error.set('Невірний email або пароль');
          this.busy.set(false);
        },
      });
  }
}
