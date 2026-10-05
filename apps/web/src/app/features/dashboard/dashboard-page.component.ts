import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PLATFORM_NAME, PLATFORM_TAGLINE } from '../../core/brand/platform';
import { SessionStore } from '../../core/auth/session.store';
import { homeWorkspaceActions } from './home-workspace.links';

@Component({
  selector: 'loom-dashboard-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="home" aria-labelledby="home-title">
      <div class="home__glow" aria-hidden="true"></div>

      <div class="home__stage">
        <header class="hero">
          <div class="hero__mark-wrap">
            <img
              class="hero__mark"
              src="assets/loom-mark.png"
              width="88"
              height="88"
              alt=""
            />
          </div>
          <p class="hero__brand">{{ brand }}</p>
          <h1 id="home-title" class="hero__title">Головна</h1>
          <p class="hero__tagline">{{ tagline }}</p>
        </header>

        <div class="cta" data-help-id="home.tiles">
          @for (action of actions(); track action.id; let i = $index) {
            @if (action.path; as path) {
              <a
                class="cta__card"
                [class.cta__card--primary]="action.id === 'profile'"
                [routerLink]="path"
                [style.--delay]="i * 60 + 'ms'"
              >
                <span class="cta__icon" aria-hidden="true">
                  @if (action.id === 'profile') {
                    <svg viewBox="0 0 24 24" width="28" height="28">
                      <path
                        fill="currentColor"
                        d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12zm0 2c-4 0-8 2-8 5v1.5h16V19c0-3-4-5-8-5z"
                      />
                    </svg>
                  } @else {
                    <svg viewBox="0 0 24 24" width="28" height="28">
                      <path
                        fill="currentColor"
                        d="M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V2zm12 7H5v10h14V9zM7 11h4v4H7v-4z"
                      />
                    </svg>
                  }
                </span>
                <span class="cta__copy">
                  <strong class="cta__label">{{ action.label }}</strong>
                  <span class="cta__blurb">{{ action.blurb }}</span>
                </span>
                <span class="cta__chevron" aria-hidden="true">→</span>
              </a>
            } @else {
              <span
                class="cta__card cta__card--disabled"
                aria-disabled="true"
                title="Профіль працівника не прив’язано до акаунта"
                [style.--delay]="i * 60 + 'ms'"
              >
                <span class="cta__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="28" height="28">
                    <path
                      fill="currentColor"
                      d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12zm0 2c-4 0-8 2-8 5v1.5h16V19c0-3-4-5-8-5z"
                    />
                  </svg>
                </span>
                <span class="cta__copy">
                  <strong class="cta__label">{{ action.label }}</strong>
                  <span class="cta__blurb">Акаунт без прив’язки до працівника</span>
                </span>
              </span>
            }
          }
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: min(70vh, 40rem);
      }

      .home {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        border-radius: 20px;
        border: 1px solid var(--pw-border);
        background:
          linear-gradient(
            165deg,
            color-mix(in srgb, var(--pw-accent) 10%, var(--pw-surface)) 0%,
            var(--pw-surface) 42%,
            var(--pw-surface-2) 100%
          );
        box-shadow: 0 12px 40px var(--pw-shadow);
        min-height: inherit;
      }

      .home__glow {
        pointer-events: none;
        position: absolute;
        inset: -20% auto auto -10%;
        width: min(70vw, 28rem);
        height: min(70vw, 28rem);
        border-radius: 50%;
        background: radial-gradient(
          circle,
          color-mix(in srgb, var(--pw-accent) 22%, transparent) 0%,
          transparent 68%
        );
        z-index: 0;
      }

      .home__stage {
        position: relative;
        z-index: 1;
        display: grid;
        gap: clamp(1.75rem, 4vw, 2.75rem);
        padding: clamp(1.75rem, 4vw, 3rem);
        max-width: 40rem;
      }

      .hero {
        display: grid;
        justify-items: start;
        gap: 0.65rem;
        animation: home-rise 0.55s ease both;
      }

      .hero__mark-wrap {
        margin-bottom: 0.35rem;
        padding: 0.55rem;
        border-radius: 18px;
        background: color-mix(in srgb, var(--pw-surface) 70%, transparent);
        border: 1px solid color-mix(in srgb, var(--pw-accent) 18%, var(--pw-border));
        box-shadow: 0 8px 24px var(--pw-shadow);
      }

      .hero__mark {
        display: block;
        width: 72px;
        height: 72px;
        border-radius: 14px;
      }

      .hero__brand {
        margin: 0;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--pw-muted);
      }

      .hero__title {
        margin: 0;
        font-size: clamp(2.1rem, 5vw, 2.75rem);
        font-weight: 750;
        letter-spacing: -0.03em;
        line-height: 1.05;
        color: var(--pw-text-strong);
      }

      .hero__tagline {
        margin: 0.15rem 0 0;
        max-width: 22rem;
        font-size: clamp(1.05rem, 2.4vw, 1.2rem);
        font-weight: 600;
        line-height: 1.35;
        color: var(--pw-accent);
      }

      .cta {
        display: grid;
        gap: 0.85rem;
      }

      .cta__card {
        --delay: 0ms;
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 1rem;
        padding: 1.05rem 1.15rem;
        border-radius: 16px;
        border: 1px solid var(--pw-border);
        background: color-mix(in srgb, var(--pw-surface) 92%, transparent);
        color: inherit;
        text-decoration: none;
        box-shadow: 0 2px 10px var(--pw-shadow);
        transition:
          transform 0.18s ease,
          border-color 0.18s ease,
          box-shadow 0.18s ease,
          background 0.18s ease;
        animation: home-rise 0.55s ease both;
        animation-delay: var(--delay);
      }

      .cta__card--primary {
        border-color: color-mix(in srgb, var(--pw-accent) 35%, var(--pw-border));
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--pw-accent) 12%, var(--pw-surface)),
          var(--pw-surface)
        );
      }

      .cta__card:hover {
        transform: translateY(-2px);
        border-color: var(--pw-accent);
        box-shadow: 0 10px 28px var(--pw-shadow);
      }

      .cta__card:focus-visible {
        outline: 2px solid var(--pw-accent);
        outline-offset: 3px;
      }

      .cta__card--disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .cta__icon {
        display: grid;
        place-items: center;
        width: 3rem;
        height: 3rem;
        border-radius: 12px;
        background: var(--pw-accent-soft);
        color: var(--pw-accent);
      }

      .cta__card--primary .cta__icon {
        background: var(--pw-accent);
        color: var(--pw-on-accent);
      }

      .cta__copy {
        display: grid;
        gap: 0.2rem;
        min-width: 0;
      }

      .cta__label {
        font-size: 1.08rem;
        font-weight: 700;
        color: var(--pw-text-strong);
      }

      .cta__blurb {
        font-size: 0.9rem;
        line-height: 1.35;
        color: var(--pw-muted);
      }

      .cta__chevron {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--pw-accent);
        transition: transform 0.18s ease;
      }

      .cta__card:hover .cta__chevron {
        transform: translateX(3px);
      }

      @keyframes home-rise {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .hero,
        .cta__card {
          animation: none;
        }
        .cta__card:hover {
          transform: none;
        }
        .cta__card:hover .cta__chevron {
          transform: none;
        }
      }

      @media (max-width: 480px) {
        .cta__card {
          grid-template-columns: auto 1fr;
        }
        .cta__chevron {
          display: none;
        }
      }
    `,
  ],
})
export class DashboardPageComponent {
  private readonly session = inject(SessionStore);

  readonly brand = PLATFORM_NAME;
  readonly tagline = PLATFORM_TAGLINE;

  /** Session → pure CTA SoT; component stays a thin view. */
  readonly actions = computed(() =>
    homeWorkspaceActions(this.session.user()?.employeeId ?? null),
  );
}
