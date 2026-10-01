import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PLATFORM_TAGLINE } from '../../core/brand/platform';

@Component({
  selector: 'loom-dashboard-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page">
      <header class="page-head">
        <div class="brand-block">
          <img
            class="mark"
            src="assets/loom-mark.png"
            width="56"
            height="56"
            alt=""
          />
          <div>
            <h1>Головна</h1>
            <p class="lede">
              Центр Loom. Модулі підключаються звідси: працівники, робочий календар та
              інші сервіси.
            </p>
          </div>
        </div>
        <blockquote class="tagline">
          <p>{{ tagline }}</p>
        </blockquote>
      </header>

      <div class="grid" data-help-id="home.tiles">
        <a class="tile" routerLink="/absences">
          <strong>Робочий календар</strong>
          <span>Заявки, календар і командні події часу</span>
        </a>
        <a class="tile" routerLink="/people">
          <strong>Працівники</strong>
          <span>Список і швидке додавання співробітників</span>
        </a>
        <a class="tile" routerLink="/statistics">
          <strong>Статистика</strong>
          <span>Звіти та аналітика</span>
        </a>
        <a class="tile" routerLink="/settings">
          <strong>Налаштування</strong>
          <span>Платформені параметри CRM</span>
        </a>
      </div>

      <div class="actions">
        <a class="btn" routerLink="/absences">Робочий календар</a>
        <a class="btn ghost" routerLink="/people">Працівники</a>
      </div>
    </section>
  `,
  styles: [
    `
      .page {
        display: grid;
        gap: 1.25rem;
        max-width: 56rem;
      }
      .page-head {
        display: grid;
        gap: 1rem;
      }
      .brand-block {
        display: flex;
        gap: 1rem;
        align-items: flex-start;
      }
      .mark {
        width: 56px;
        height: 56px;
        border-radius: 12px;
        flex-shrink: 0;
        display: block;
      }
      .page-head h1 {
        margin: 0;
        font-size: 1.75rem;
        color: var(--pw-text-strong);
      }
      .lede {
        margin: 0.35rem 0 0;
        color: var(--pw-muted);
        line-height: 1.5;
        max-width: 40rem;
      }
      .tagline {
        margin: 0;
        padding: 1rem 1.15rem;
        border: 1px solid var(--pw-border);
        border-left: 3px solid var(--pw-accent);
        border-radius: 12px;
        background: var(--pw-surface);
        box-shadow: 0 1px 2px var(--pw-shadow);
      }
      .tagline p {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 600;
        color: var(--pw-accent);
        letter-spacing: 0.01em;
      }
      .grid {
        display: grid;
        gap: 0.75rem;
      }
      .tile {
        display: grid;
        gap: 0.35rem;
        padding: 1rem 1.1rem;
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        background: var(--pw-surface);
        color: inherit;
        text-decoration: none;
        box-shadow: 0 1px 2px var(--pw-shadow);
        transition:
          border-color 0.15s ease,
          background 0.15s ease;
      }
      .tile:hover {
        border-color: var(--pw-accent);
        background: color-mix(in srgb, var(--pw-accent) 8%, var(--pw-surface));
      }
      .tile strong {
        font-size: 1.05rem;
        color: var(--pw-accent);
      }
      .tile span {
        color: var(--pw-muted);
        font-size: 0.92rem;
        line-height: 1.4;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        min-height: 2.75rem;
        padding: 0.65rem 1rem;
        border-radius: 8px;
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        font-weight: 600;
        text-decoration: none;
      }
      .btn.ghost {
        background: var(--pw-surface);
        color: var(--pw-text);
        border: 1px solid var(--pw-border-strong);
      }
      @media (min-width: 641px) {
        .grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
    `,
  ],
})
export class DashboardPageComponent {
  readonly tagline = PLATFORM_TAGLINE;
}
