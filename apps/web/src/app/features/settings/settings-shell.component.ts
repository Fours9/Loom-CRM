import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'loom-settings-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <section class="page">
      <header class="page-head">
        <h1>Налаштування</h1>
        <p class="lead">Платформені довідники та параметри</p>
        <nav class="subnav" aria-label="Розділи налаштувань">
          <a routerLink="positions" routerLinkActive="active">Керування посадами</a>
        </nav>
      </header>
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
      .subnav {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.75rem;
      }
      .subnav a {
        padding: 0.4rem 0.75rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        color: var(--pw-text);
        text-decoration: none;
        background: var(--pw-surface);
      }
      .subnav a.active {
        border-color: var(--pw-accent);
        color: var(--pw-accent);
        font-weight: 600;
      }
    `,
  ],
})
export class SettingsShellComponent {}
