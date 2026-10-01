import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ApiAvailabilityStore } from './core/api/api-availability.store';
import { SessionStore } from './core/auth/session.store';
import { HelpSpotlightOverlayComponent } from './core/help';
import { HelpPageContextService } from './core/help/help-page-context.service';
import { registerAppHelp } from './help/register-app-help';

registerAppHelp();

@Component({
  selector: 'loom-root',
  standalone: true,
  imports: [RouterOutlet, HelpSpotlightOverlayComponent],
  template: `
    <router-outlet />
    <loom-help-spotlight-overlay />

    @if (api.status() === 'unreachable') {
      <div class="api-lock" role="alertdialog" aria-modal="true" aria-labelledby="api-lock-title">
        <div class="api-lock-card">
          <h1 id="api-lock-title">Сервер недоступний</h1>
          <p>
            Немає зв’язку з API. Меню й сторінки заблоковано, доки сервер знову не відповість.
            Це не офлайн-копія даних — лише оболонка в браузері.
          </p>
          @if (retryError()) {
            <p class="err">{{ retryError() }}</p>
          }
          <button type="button" (click)="retry()" [disabled]="retrying()">
            {{ retrying() ? 'Перевірка…' : 'Повторити' }}
          </button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .api-lock {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: grid;
        place-items: center;
        padding: 1.25rem;
        background: color-mix(in srgb, #0f172a 72%, transparent);
        pointer-events: auto;
      }
      .api-lock-card {
        width: min(28rem, 100%);
        display: grid;
        gap: 0.85rem;
        padding: 1.35rem 1.4rem;
        border-radius: 12px;
        background: var(--pw-surface, #fff);
        border: 1px solid var(--pw-border, #d0d7de);
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28);
        color: var(--pw-text, #1f2328);
      }
      h1 {
        margin: 0;
        font-size: 1.25rem;
      }
      p {
        margin: 0;
        font-size: 0.95rem;
        line-height: 1.45;
        color: var(--pw-muted, #656d76);
      }
      .err {
        color: var(--pw-danger, #a32d2d);
      }
      button {
        justify-self: start;
        padding: 0.55rem 1rem;
        border: 0;
        border-radius: 8px;
        background: var(--pw-accent, #2563eb);
        color: var(--pw-on-accent, #fff);
        font: inherit;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.55;
        cursor: default;
      }
    `,
  ],
})
export class AppComponent {
  readonly api = inject(ApiAvailabilityStore);
  private readonly session = inject(SessionStore);
  /** Eager: NavigationStart clears feature overrides from app boot. */
  private readonly _helpPageContext = inject(HelpPageContextService);

  readonly retrying = signal(false);
  readonly retryError = signal<string | null>(null);

  async retry(): Promise<void> {
    if (this.retrying()) return;
    this.retrying.set(true);
    this.retryError.set(null);
    try {
      const ok = await this.api.probe();
      if (!ok) {
        this.retryError.set('API досі не відповідає. Перевірте, що бекенд запущено.');
        return;
      }
      await this.session.initialize();
    } catch {
      this.retryError.set('Не вдалося відновити сесію. Спробуйте ще раз.');
    } finally {
      this.retrying.set(false);
    }
  }
}
