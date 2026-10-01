import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Surface } from '../../core/access/can-access-surface';
import { SessionStore } from '../../core/auth/session.store';

@Component({
  selector: 'loom-settings-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <section class="page" data-help-id="settings.shell">
      <header class="page-head">
        <h1>Налаштування</h1>
        <p class="lead">Платформені параметри</p>
      </header>
      @if (canManageAccessRoles()) {
        <nav class="settings-nav">
          <a
            routerLink="access-roles"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            data-help-id="settings.access-link"
            >Доступи</a
          >
        </nav>
      }
      <p class="hint">
        Довідники напрямків, відділів, посад і навичок —
        <a routerLink="/positions">Керування посадами</a>.
      </p>
      <router-outlet />
    </section>
  `,
  styles: [
    `
      .page {
        display: grid;
        gap: 1rem;
        max-width: 1400px;
        margin-inline: auto;
        width: 100%;
      }
      .page-head h1 {
        margin: 0;
        font-size: 1.75rem;
        color: var(--pw-text-strong);
      }
      .lead {
        margin: 0.35rem 0 0;
        color: var(--pw-muted);
      }
      .hint {
        margin: 0;
        color: var(--pw-muted);
      }
      .hint a {
        color: var(--pw-accent);
      }
      .settings-nav {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .settings-nav a {
        padding: 0.4rem 0.8rem;
        border-radius: 999px;
        border: 1px solid var(--pw-border);
        color: var(--pw-text);
        text-decoration: none;
        font-size: 0.9rem;
      }
      .settings-nav a.active {
        border-color: var(--pw-accent);
        color: var(--pw-accent);
        background: color-mix(in srgb, var(--pw-accent) 12%, transparent);
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
