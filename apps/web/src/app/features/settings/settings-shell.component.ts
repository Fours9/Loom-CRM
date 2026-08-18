import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'loom-settings-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <section class="page">
      <header class="page-head">
        <h1>Налаштування</h1>
        <p class="lead">Платформені параметри</p>
      </header>
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
    `,
  ],
})
export class SettingsShellComponent {}
