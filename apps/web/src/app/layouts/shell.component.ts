import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { NavigationService } from '../core/navigation/navigation.service';
import { SessionStore } from '../core/auth/session.store';
import { TranslatePipe } from '../core/i18n/translate.pipe';
import { ThemeService } from '../core/theme/theme.service';
import { OverlayScrollLockService } from '../core/overlay/overlay-scroll-lock.service';
import { ViewportService } from '../core/viewport/viewport.service';
import { NotificationsApi } from '../core/notifications/notifications.api';
import { AppNotification } from '../core/notifications/notification.models';
import { notificationFrameTone } from '../core/notifications/notification-frame';

@Component({
  selector: 'loom-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, DatePipe],
  template: `
    <div
      class="shell app-shell"
      [class.in-absences]="inAbsences()"
      [class.app-chrome-hidden]="hideAppChrome()"
      [class.side-pinned]="sidePinned() && !hideAppChrome()"
      data-pw-app="1"
    >
      @if (!hideAppChrome()) {
      <header class="topbar">
        <div class="topbar-start">
          <button
            #menuBtn
            type="button"
            class="icon-btn menu-btn"
            [attr.aria-expanded]="sideExpanded()"
            aria-controls="side-nav"
            [attr.aria-label]="sideExpanded() ? 'Згорнути меню' : 'Відкрити меню'"
            (click)="toggleSideNav()"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="currentColor"
                d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"
              />
            </svg>
          </button>
          <a routerLink="/" class="brand" aria-label="Loom — на головну">
            <img
              class="brand-mark"
              src="assets/loom-mark.png"
              width="36"
              height="36"
              alt=""
            />
            <span class="brand-text">
              <span class="brand-name">{{ 'brandName' | t }}</span>
              @if (inAbsences()) {
                <span class="brand-module">{{ 'brandModule' | t }}</span>
              } @else {
                <span class="brand-module">CRM</span>
              }
            </span>
          </a>
        </div>

        @if (inAbsences()) {
          <nav class="desktop-nav" aria-label="Навігація відсутностей">
            <a
              routerLink="/absences"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: true }"
            >
              {{ 'nav.home' | t }}
            </a>
            <a routerLink="/absences/employees" routerLinkActive="active">
              {{ 'nav.employees' | t }}
            </a>
            <a routerLink="/absences/requests" routerLinkActive="active">
              {{ 'nav.requests' | t }}
            </a>
            <a routerLink="/absences/calendar" routerLinkActive="active">
              {{ 'nav.calendar' | t }}
            </a>
            @if (isAdmin()) {
              <a routerLink="/absences/admin" routerLinkActive="active">
                {{ 'nav.admin' | t }}
              </a>
            }
          </nav>
        }

          <div class="user">
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
              <span aria-hidden="true">☾</span>
              <span class="theme-label">Темна</span>
            } @else {
              <span aria-hidden="true">☀</span>
              <span class="theme-label">Світла</span>
            }
          </button>
          <div class="inbox">
            <button
              type="button"
              class="bell icon-btn"
              title="Сповіщення"
              aria-label="Сповіщення"
              (click)="toggleInbox()"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm6.7-6v-5a6.7 6.7 0 0 0-5.2-6.5V4a1.5 1.5 0 0 0-3 0v.5A6.7 6.7 0 0 0 5.3 11v5l-1.7 1.7a1 1 0 0 0 .7 1.7h15.4a1 1 0 0 0 .7-1.7L18.7 16z"
                />
              </svg>
              @if (unreadCount > 0) {
                <span class="badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
              }
            </button>
            @if (inboxOpen) {
              <div class="dropdown">
                <div class="dropdown-head">
                  <strong>Сповіщення</strong>
                  <button type="button" (click)="markAll()">Прочитати всі</button>
                </div>
                @if (notifications.length === 0) {
                  <p class="empty">Порожньо</p>
                } @else {
                  <ul>
                    @for (n of notifications; track n.id) {
                      <li
                        class="pw-request-frame"
                        [class.unread]="!n.isRead"
                        [attr.data-frame]="frameTone(n.type)"
                        (mouseenter)="markReadOnHover(n)"
                      >
                        @if (n.relatedRequestId) {
                          <a
                            [routerLink]="['/absences/requests', n.relatedRequestId]"
                            (click)="markNotificationRead(n)"
                          >
                            <strong>{{ n.title }}</strong>
                            <span>{{ n.body }}</span>
                          </a>
                        } @else {
                          <button
                            type="button"
                            class="plain"
                            (click)="markNotificationRead(n)"
                          >
                            <strong>{{ n.title }}</strong>
                            <span>{{ n.body }}</span>
                          </button>
                        }
                        <small>{{ n.createdAt | date: 'short' }}</small>
                      </li>
                    }
                  </ul>
                }
              </div>
            }
          </div>
          @if (accountEmail()) {
            <span class="user-email" [title]="accountEmail()">{{ accountEmail() }}</span>
          }
          <button type="button" class="logout-btn" (click)="logout()">
            {{ 'nav.logout' | t }}
          </button>
        </div>
      </header>
      }

      <div class="body">
        @if (!hideAppChrome()) {
        @if (!viewport.isTabletUp() && isMobileNavOpen()) {
          <div class="scrim" (click)="closeMobileNav('backdrop')" aria-hidden="true"></div>
        }
        <aside
          #mobileNav
          id="side-nav"
          class="side-nav"
          role="navigation"
          aria-label="Головна навігація"
          [attr.aria-hidden]="sideExpanded() ? 'false' : 'true'"
          [attr.inert]="sideExpanded() ? null : ''"
        >
          <div class="side-nav-links">
            @for (item of nav.visibleTree(); track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: item.path === '/' }"
                (click)="onNavLinkClick()"
              >
                {{ item.label }}
              </a>
              @if (item.path === '/absences' && inAbsences()) {
                <div class="side-nav-children" role="group" aria-label="Робочий календар">
                  <a
                    routerLink="/absences"
                    routerLinkActive="active"
                    [routerLinkActiveOptions]="{ exact: true }"
                    (click)="onNavLinkClick()"
                  >
                    {{ 'nav.home' | t }}
                  </a>
                  <a
                    routerLink="/absences/employees"
                    routerLinkActive="active"
                    (click)="onNavLinkClick()"
                  >
                    {{ 'nav.employees' | t }}
                  </a>
                  <a
                    routerLink="/absences/requests"
                    routerLinkActive="active"
                    (click)="onNavLinkClick()"
                  >
                    {{ 'nav.requests' | t }}
                  </a>
                  <a
                    routerLink="/absences/calendar"
                    routerLinkActive="active"
                    (click)="onNavLinkClick()"
                  >
                    {{ 'nav.calendar' | t }}
                  </a>
                  @if (isAdmin()) {
                    <a
                      routerLink="/absences/admin"
                      routerLinkActive="active"
                      (click)="onNavLinkClick()"
                    >
                      {{ 'nav.admin' | t }}
                    </a>
                  }
                </div>
              }
            }
          </div>
          @if (inAbsences()) {
            <div class="side-nav-footer">
              <span class="drawer-email">{{ accountEmail() }}</span>
              <button type="button" (click)="logout()">{{ 'nav.logout' | t }}</button>
            </div>
          }
        </aside>
        }

        <main
          class="content loom-absence-module"
        >
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [
    `
      .shell {
        min-height: 100vh;
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
        color: var(--pw-text);
        /* icon 2.75rem + vertical padding 0.65*2 + safe-area */
        --shell-topbar-h: calc(4.05rem + env(safe-area-inset-top, 0px));
        background: linear-gradient(
          180deg,
          var(--pw-bg-grad-top) 0%,
          var(--pw-bg-grad-mid) 40%,
          var(--pw-bg-grad-bot) 100%
        );
      }
      .body {
        display: flex;
        flex: 1;
        min-height: 0;
        min-width: 0;
      }
      .topbar {
        position: sticky;
        top: 0;
        z-index: calc(var(--pw-z-drawer, 210) + 20);
        display: flex;
        gap: 0.75rem;
        align-items: center;
        justify-content: space-between;
        padding: calc(0.65rem + env(safe-area-inset-top, 0px)) 1rem 0.65rem;
        border-bottom: 1px solid var(--pw-border);
        background: var(--pw-topbar, var(--pw-surface));
        backdrop-filter: blur(8px);
      }
      .topbar-start {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        min-width: 0;
        text-decoration: none;
        color: inherit;
      }
      .brand-mark {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        display: block;
        flex-shrink: 0;
      }
      .brand-text {
        display: flex;
        flex-direction: column;
        gap: 0.05rem;
        min-width: 0;
        line-height: 1.15;
      }
      .brand-name {
        font-weight: 700;
        font-size: 1.05rem;
        color: var(--pw-accent);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .brand-module {
        font-weight: 500;
        font-size: 0.72rem;
        color: var(--pw-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .menu-btn {
        display: inline-grid;
      }
      .desktop-nav {
        display: none;
      }
      .desktop-nav a,
      .side-nav a {
        text-decoration: none;
        color: var(--pw-text);
      }
      .desktop-nav a.active,
      .side-nav a.active {
        color: var(--pw-accent);
        font-weight: 600;
      }
      .user {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        flex-shrink: 0;
        min-width: 0;
      }
      .user-email {
        display: none;
        color: var(--pw-muted);
        font-size: 0.9rem;
        max-width: 14rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .logout-btn {
        display: none;
      }
      .theme-label {
        display: none;
      }
      button {
        border: 1px solid var(--pw-border-strong);
        background: var(--pw-surface);
        color: var(--pw-text);
        border-radius: 8px;
        padding: 0.4rem 0.75rem;
        cursor: pointer;
        min-height: 2.75rem;
      }
      .theme-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        font-weight: 600;
        width: 2.75rem;
        min-width: 2.75rem;
        height: 2.75rem;
        padding: 0;
      }
      .inbox {
        position: relative;
      }
      .icon-btn {
        position: relative;
        display: inline-grid;
        place-items: center;
        width: 2.75rem;
        height: 2.75rem;
        min-width: 2.75rem;
        padding: 0;
        border: 1px solid var(--pw-border-strong);
        border-radius: 8px;
        background: var(--pw-surface);
        color: var(--pw-text);
        cursor: pointer;
      }
      .icon-btn:hover {
        border-color: var(--pw-accent);
        color: var(--pw-accent);
        background: color-mix(in srgb, var(--pw-accent) 12%, var(--pw-surface));
      }
      .icon-btn svg {
        display: block;
      }
      .bell .badge {
        position: absolute;
        top: -0.35rem;
        right: -0.35rem;
        margin: 0;
        min-width: 1.15rem;
        height: 1.15rem;
        padding: 0 0.3rem;
        display: inline-grid;
        place-items: center;
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        border-radius: 999px;
        font-size: 0.68rem;
        font-weight: 700;
        line-height: 1;
        box-sizing: border-box;
      }
      .dropdown {
        position: absolute;
        right: 0;
        top: calc(100% + 0.4rem);
        width: min(360px, 80vw);
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        box-shadow: 0 8px 24px var(--pw-shadow);
        z-index: var(--pw-z-dropdown, 120);
        padding: 0.75rem;
      }
      .dropdown-head {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 0.5rem;
      }
      .dropdown ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.5rem;
        max-height: 320px;
        overflow: auto;
      }
      .dropdown li {
        display: grid;
        gap: 0.2rem;
        padding: 0.55rem 0.65rem;
      }
      .dropdown li.unread {
        box-shadow: inset 3px 0 0 var(--pw-accent);
      }
      .dropdown a,
      .plain {
        display: grid;
        gap: 0.15rem;
        text-align: left;
        border: 0;
        background: transparent;
        padding: 0;
        cursor: pointer;
        color: inherit;
        min-height: auto;
      }
      .dropdown span,
      .dropdown small,
      .empty {
        color: var(--pw-muted);
        font-size: 0.85rem;
      }
      .scrim {
        position: fixed;
        top: var(--shell-topbar-h);
        right: 0;
        bottom: 0;
        left: 0;
        background: color-mix(in srgb, var(--pw-text-strong) 35%, transparent);
        z-index: var(--pw-z-scrim, 200);
      }
      /* Phone (<641px): PW-style flyout. Tablet+: docked via .side-pinned. */
      .side-nav {
        position: fixed;
        top: var(--shell-topbar-h);
        left: 0;
        width: min(20rem, 88vw);
        height: calc(100vh - var(--shell-topbar-h));
        height: calc(100dvh - var(--shell-topbar-h));
        z-index: var(--pw-z-drawer, 210);
        display: flex;
        flex-direction: column;
        background: var(--pw-surface);
        border-right: 1px solid var(--pw-border);
        box-shadow: 0 8px 24px var(--pw-shadow);
        padding: 1rem 0 calc(1rem + env(safe-area-inset-bottom, 0px));
        transform: translateX(-105%);
        transition: transform 0.2s ease;
        visibility: hidden;
      }
      .side-nav[aria-hidden='false'] {
        transform: translateX(0);
        visibility: visible;
      }
      /* Tablet+: docked rail pushes content (CRM home + Absences), no overlay. */
      .shell.side-pinned .side-nav {
        position: relative;
        top: auto;
        align-self: stretch;
        width: var(--loom-sidebar-width, 240px);
        height: auto;
        min-height: 100%;
        z-index: 1;
        transform: none;
        visibility: visible;
        box-shadow: none;
        padding: 1rem 0;
        flex-shrink: 0;
      }
      @media (prefers-reduced-motion: reduce) {
        .side-nav {
          transition: none;
        }
      }
      .side-nav-links {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0 0.75rem;
        flex: 1;
        overflow: auto;
      }
      .side-nav-links a {
        padding: 0.85rem 1rem;
        border-radius: 8px;
        min-height: 2.75rem;
        display: flex;
        align-items: center;
      }
      .side-nav-links a:hover,
      .side-nav-links a.active {
        background: color-mix(in srgb, var(--pw-accent) 10%, var(--pw-surface));
      }
      .side-nav-children {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        padding: 0.15rem 0 0.35rem 0.75rem;
        margin: 0 0 0.25rem 0.5rem;
        border-left: 2px solid var(--pw-border);
      }
      .side-nav-children a {
        padding: 0.65rem 0.85rem;
        min-height: 2.5rem;
        font-size: 0.92rem;
      }
      .nav-section {
        margin: 0.75rem 0 0.25rem;
        padding: 0 1rem;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--pw-muted);
      }
      .nav-section:first-child {
        margin-top: 0.25rem;
      }
      .side-nav-footer {
        display: grid;
        gap: 0.75rem;
        padding: 1rem;
        border-top: 1px solid var(--pw-border);
      }
      .side-nav-footer .drawer-email {
        display: block;
        color: var(--pw-muted);
        font-size: 0.9rem;
        word-break: break-all;
      }
      .content {
        flex: 1;
        min-width: 0;
        padding: 1rem;
      }
      .shell.app-chrome-hidden {
        --shell-topbar-h: 0px;
      }
      .shell.app-chrome-hidden .content {
        padding: 0;
        min-height: 100vh;
        min-height: 100dvh;
      }
      @media (min-width: 641px) {
        .shell {
          --shell-topbar-h: 4.55rem;
        }
        .shell.app-chrome-hidden {
          --shell-topbar-h: 0px;
        }
        .topbar {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 1.5rem;
          padding: 0.9rem 1.5rem;
        }
        .shell:not(.in-absences) .topbar {
          display: flex;
          justify-content: space-between;
        }
        .brand-name {
          font-size: 1.15rem;
        }
        .brand-module {
          font-size: 0.78rem;
        }
        .brand-mark {
          width: 36px;
          height: 36px;
        }
        .desktop-nav {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          justify-content: center;
          justify-self: center;
        }
        .user-email {
          display: inline;
        }
        .logout-btn {
          display: inline-flex;
          align-items: center;
        }
        .theme-label {
          display: inline;
        }
        .theme-toggle {
          width: auto;
          min-width: auto;
          height: auto;
          padding: 0.4rem 0.75rem;
        }
        .user {
          justify-self: end;
          gap: 0.75rem;
        }
        .content {
          padding: 1.5rem;
        }
      }
    `,
  ],
})
export class ShellComponent implements OnInit, OnDestroy {
  readonly nav = inject(NavigationService);
  readonly session = inject(SessionStore);
  readonly theme = inject(ThemeService);
  readonly viewport = inject(ViewportService);
  readonly frameTone = notificationFrameTone;
  private readonly notificationsApi = inject(NotificationsApi);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly scrollLock = inject(OverlayScrollLockService);

  @ViewChild('menuBtn') menuBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('mobileNav') mobileNav?: ElementRef<HTMLElement>;

  unreadCount = 0;
  inboxOpen = false;
  notifications: AppNotification[] = [];
  /** Phone flyout open (PW-style). Closed by default. */
  readonly isMobileNavOpen = signal(false);
  /** Tablet+: docked sidebar open by default; ☰ toggles collapse. */
  readonly sideOpen = signal(true);

  private readonly url = signal(this.router.url);
  readonly inAbsences = computed(() => this.url().startsWith('/absences'));
  /** Route data flag — Shell stays feature-agnostic (no URL sniffing). */
  readonly hideAppChrome = signal(false);
  /** Docked rail only on tablet+ when open — never overlays content. */
  readonly sidePinned = computed(
    () => this.viewport.isTabletUp() && this.sideOpen(),
  );
  readonly sideExpanded = computed(() =>
    this.viewport.isTabletUp() ? this.sideOpen() : this.isMobileNavOpen(),
  );
  readonly accountEmail = computed(() => this.session.user()?.email ?? '');
  readonly isAdmin = computed(() => this.session.user()?.role === 'admin');

  private hasScrollLock = false;
  private routerSub?: Subscription;
  private keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.isMobileNavOpen()) {
      this.closeMobileNav('escape');
    }
  };

  constructor() {
    effect(() => {
      if (this.viewport.isTabletUp() && this.isMobileNavOpen()) {
        this.closeMobileNav('viewport');
      }
    });
  }

  ngOnInit(): void {
    this.refreshUnread();
    this.updateRouteFlags();
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.url.set(e.urlAfterRedirects);
        this.updateRouteFlags();
        this.inboxOpen = false;
        if (this.isMobileNavOpen()) {
          this.closeMobileNav('navigation');
        }
      });
    document.addEventListener('keydown', this.keyHandler);
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    document.removeEventListener('keydown', this.keyHandler);
    this.releaseScrollLock();
  }

  private updateRouteFlags(): void {
    let route = this.activatedRoute;
    while (route.firstChild) route = route.firstChild;
    this.hideAppChrome.set(route.snapshot.data['hideAppChrome'] === true);
  }

  /** Phone: close flyout after choosing a link (PW). Tablet+: no-op. */
  onNavLinkClick(): void {
    if (!this.viewport.isTabletUp() && this.isMobileNavOpen()) {
      this.closeMobileNav('navigation');
    }
  }

  toggleSideNav(): void {
    if (this.viewport.isTabletUp()) {
      this.sideOpen.update((open) => !open);
      return;
    }
    if (this.isMobileNavOpen()) {
      this.closeMobileNav('explicit');
    } else {
      this.openMobileNav();
    }
  }

  openMobileNav(): void {
    if (this.viewport.isTabletUp() || this.isMobileNavOpen()) {
      return;
    }
    this.isMobileNavOpen.set(true);
    this.acquireScrollLock();
    queueMicrotask(() => {
      const first = this.mobileNav?.nativeElement.querySelector('a');
      first?.focus();
    });
  }

  closeMobileNav(
    reason:
      | 'escape'
      | 'backdrop'
      | 'explicit'
      | 'viewport'
      | 'navigation'
      | 'logout' = 'explicit',
  ): void {
    if (!this.isMobileNavOpen()) {
      return;
    }
    this.isMobileNavOpen.set(false);
    this.releaseScrollLock();
    if (reason !== 'navigation' && reason !== 'logout') {
      queueMicrotask(() => this.menuBtn?.nativeElement.focus());
    }
  }

  logout(): void {
    this.closeMobileNav('logout');
    this.session.logout();
    void this.router.navigateByUrl('/login');
  }

  toggleInbox(): void {
    this.inboxOpen = !this.inboxOpen;
    if (this.inboxOpen) {
      this.notificationsApi.getNotifications({ page: 1, pageSize: 10 }).subscribe({
        next: (res) => (this.notifications = res.items),
      });
      this.refreshUnread();
    }
  }

  refreshUnread(): void {
    this.notificationsApi.getUnreadCount().subscribe({
      next: (res) => (this.unreadCount = res.count),
    });
  }

  markAll(): void {
    this.notificationsApi.markAllRead().subscribe({
      next: () => {
        this.notifications = this.notifications.map((n) => ({ ...n, isRead: true }));
        this.unreadCount = 0;
      },
    });
  }

  markReadOnHover(n: AppNotification): void {
    if (!this.canUseHoverRead()) {
      return;
    }
    this.markNotificationRead(n);
  }

  markNotificationRead(n: AppNotification): void {
    if (n.isRead) {
      return;
    }
    n.isRead = true;
    this.unreadCount = Math.max(0, this.unreadCount - 1);
    this.notificationsApi.markRead(n.id).subscribe({
      error: () => {
        n.isRead = false;
        this.unreadCount += 1;
      },
    });
  }

  private acquireScrollLock(): void {
    if (this.hasScrollLock) {
      return;
    }
    this.scrollLock.acquire();
    this.hasScrollLock = true;
  }

  private releaseScrollLock(): void {
    if (!this.hasScrollLock) {
      return;
    }
    this.scrollLock.release();
    this.hasScrollLock = false;
  }

  private canUseHoverRead(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }
}
