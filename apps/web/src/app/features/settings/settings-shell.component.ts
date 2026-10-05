import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Surface } from '../../core/access/can-access-surface';
import { SessionStore } from '../../core/auth/session.store';

@Component({
  selector: 'loom-settings-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <section class="page pw-stage" data-help-id="settings.shell">
      <span class="pw-stage__glow" aria-hidden="true"></span>
      <header class="page-head pw-page-head pw-rise">
        <div>
          <p class="pw-eyebrow">Платформа</p>
          <h1>Налаштування</h1>
          <p class="pw-lead">Параметри доступів і довідників</p>
        </div>
      </header>
      @if (canManageAccessRoles()) {
        <nav class="settings-nav pw-rise" style="--pw-delay: 70ms">
          <a
            routerLink="access-roles"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            data-help-id="settings.access-link"
            >Доступи</a
          >
        </nav>
      }
      <p class="hint pw-panel pw-rise" style="--pw-delay: 110ms">
        Довідники напрямків, відділів, посад і навичок —
        <a routerLink="/positions">Керування посадами</a>.
      </p>
      <div class="outlet pw-rise" style="--pw-delay: 160ms">
        <router-outlet />
      </div>
    </section>
  `,
  styles: [
    `
      .page {
        max-width: 1400px;
        margin-inline: auto;
        width: 100%;
      }
      .hint {
        margin: 0;
        color: var(--pw-muted);
      }
      .hint a {
        color: var(--pw-accent);
        font-weight: 700;
      }
      .settings-nav {
        display: inline-flex;
        gap: 0.25rem;
        flex-wrap: wrap;
        padding: 0.22rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--pw-surface) 88%, transparent);
        border: 1px solid color-mix(in srgb, var(--pw-accent) 14%, var(--pw-border));
        width: fit-content;
        box-shadow: 0 2px 10px var(--pw-shadow);
      }
      .settings-nav a {
        padding: 0.45rem 0.95rem;
        border-radius: 999px;
        border: 0;
        color: var(--pw-muted);
        text-decoration: none;
        font-size: 0.9rem;
        font-weight: 700;
        transition:
          background 0.16s ease,
          color 0.16s ease,
          box-shadow 0.16s ease;
      }
      .settings-nav a.active {
        color: var(--pw-accent);
        background: var(--pw-surface);
        box-shadow: 0 2px 8px var(--pw-shadow);
      }
      .outlet {
        min-width: 0;
      }
    `,
  ],
})
export class SettingsShellComponent {
  private readonly session = inject(SessionStore);

  /** Role-definition CRUD is admin-equivalent only (ADR 0011 §8). */
  readonly canManageAccessRoles = computed(() =>
    this.session.canAccessSurface(Surface.SettingsAccessRoles),
  );
}
