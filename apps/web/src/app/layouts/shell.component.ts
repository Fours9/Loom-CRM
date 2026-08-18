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
              width="32"
              height="32"
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
                        @if (n.relatedAssignmentId) {
                          <a
                            [routerLink]="['/questionnaires', n.relatedAssignmentId]"
                            (click)="markNotificationRead(n)"
                          >
                            <strong>{{ n.title }}</strong>
                            <span>{{ n.body }}</span>
                          </a>
                        } @else if (n.relatedRequestId) {
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
                class="side-link"
                [routerLink]="item.path"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: item.path === '/' }"
                [attr.title]="item.label"
                [attr.aria-label]="item.label"
                (click)="onNavLinkClick()"
              >
                <svg class="nav-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path fill="currentColor" [attr.d]="navIconPath(item.path)" />
                </svg>
                <span class="nav-label">{{ item.label }}</span>
              </a>
              @if (item.path === '/absences' && inAbsences()) {
                <div class="side-nav-children" role="group" aria-label="Робочий календар">
                  <a
                    class="side-link side-link-child"
                    routerLink="/absences"
                    routerLinkActive="active"
                    [routerLinkActiveOptions]="{ exact: true }"
                    [attr.title]="'nav.home' | t"
                    [attr.aria-label]="'nav.home' | t"
                    (click)="onNavLinkClick()"
                  >
                    <svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path fill="currentColor" [attr.d]="navIconPath('/absences')" />
                    </svg>
                    <span class="nav-label">{{ 'nav.home' | t }}</span>
                  </a>
                  <a
                    class="side-link side-link-child"
                    routerLink="/absences/employees"
                    routerLinkActive="active"
                    [attr.title]="'nav.employees' | t"
                    [attr.aria-label]="'nav.employees' | t"
                    (click)="onNavLinkClick()"
                  >
                    <svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path fill="currentColor" [attr.d]="navIconPath('/people')" />
                    </svg>
                    <span class="nav-label">{{ 'nav.employees' | t }}</span>
                  </a>
                  <a
                    class="side-link side-link-child"
                    routerLink="/absences/requests"
                    routerLinkActive="active"
                    [attr.title]="'nav.requests' | t"
                    [attr.aria-label]="'nav.requests' | t"
                    (click)="onNavLinkClick()"
                  >
                    <svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path fill="currentColor" [attr.d]="navIconPath('requests')" />
                    </svg>
                    <span class="nav-label">{{ 'nav.requests' | t }}</span>
                  </a>
                  <a
                    class="side-link side-link-child"
                    routerLink="/absences/calendar"
                    routerLinkActive="active"
                    [attr.title]="'nav.calendar' | t"
                    [attr.aria-label]="'nav.calendar' | t"
                    (click)="onNavLinkClick()"
                  >
                    <svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path fill="currentColor" [attr.d]="navIconPath('/absences/calendar')" />
                    </svg>
                    <span class="nav-label">{{ 'nav.calendar' | t }}</span>
                  </a>
                  @if (isAdmin()) {
                    <a
                      class="side-link side-link-child"
                      routerLink="/absences/admin"
                      routerLinkActive="active"
                      [attr.title]="'nav.admin' | t"
                      [attr.aria-label]="'nav.admin' | t"
                      (click)="onNavLinkClick()"
                    >
                      <svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path fill="currentColor" [attr.d]="navIconPath('/settings')" />
                      </svg>
                      <span class="nav-label">{{ 'nav.admin' | t }}</span>
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
        /* icon 2.4rem + vertical padding 0.4*2 + safe-area */
        --shell-topbar-h: calc(3.2rem + env(safe-area-inset-top, 0px));
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
        padding: calc(0.4rem + env(safe-area-inset-top, 0px)) 1rem 0.4rem;
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
        width: 32px;
        height: 32px;
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
        font-size: 1rem;
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
        min-height: 2.4rem;
      }
      .theme-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        font-weight: 600;
        width: 2.4rem;
        min-width: 2.4rem;
        height: 2.4rem;
        padding: 0;
      }
      .inbox {
        position: relative;
      }
      .icon-btn {
        position: relative;
        display: inline-grid;
        place-items: center;
        width: 2.4rem;
        height: 2.4rem;
        min-width: 2.4rem;
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
      .side-nav-links a.side-link {
        padding: 0.85rem 1rem;
        border-radius: 8px;
        min-height: 2.75rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .side-nav-links a.side-link:hover,
      .side-nav-links a.side-link.active {
        background: color-mix(in srgb, var(--pw-accent) 10%, var(--pw-surface));
      }
      .nav-icon {
        flex-shrink: 0;
        display: block;
      }
      .nav-label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      /* Docked rail: icons only — title attribute shows the name on hover. */
      .shell.side-pinned .side-nav-links {
        padding: 0 0.45rem;
        align-items: stretch;
      }
      .shell.side-pinned .side-nav-links a.side-link {
        justify-content: center;
        padding: 0.7rem 0.35rem;
        gap: 0;
      }
      .shell.side-pinned .side-nav-links .nav-label {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .side-nav-children {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding: 0.2rem 0 0.4rem 0.85rem;
        margin: 0.1rem 0 0.35rem 0.55rem;
        border-left: 2px solid color-mix(in srgb, var(--pw-accent) 35%, var(--pw-border));
      }
      .side-nav-children a.side-link-child {
        padding: 0.55rem 0.75rem;
        min-height: 2.35rem;
        font-size: 0.9rem;
        color: var(--pw-muted);
        border-radius: 8px;
      }
      .side-nav-children a.side-link-child .nav-icon {
        width: 18px;
        height: 18px;
        opacity: 0.85;
      }
      .side-nav-children a.side-link-child:hover,
      .side-nav-children a.side-link-child.active {
        color: var(--pw-text);
        background: color-mix(in srgb, var(--pw-accent) 12%, var(--pw-surface));
      }
      .side-nav-children a.side-link-child.active .nav-icon {
        opacity: 1;
        color: var(--pw-accent);
      }
      /* Docked icon rail: indent children so hierarchy reads clearly. */
      .shell.side-pinned .side-nav-children {
        padding: 0.25rem 0.25rem 0.4rem 0;
        margin: 0.15rem 0.2rem 0.4rem 0.55rem;
        border-left: 2px solid color-mix(in srgb, var(--pw-accent) 40%, var(--pw-border));
        align-items: stretch;
        gap: 0.15rem;
      }
      .shell.side-pinned .side-nav-children a.side-link-child {
        justify-content: center;
        padding: 0.45rem 0.2rem 0.45rem 0.55rem;
        min-height: 2.15rem;
        margin-left: 0.15rem;
      }
      .shell.side-pinned .side-nav-children a.side-link-child .nav-icon {
        width: 17px;
        height: 17px;
      }
      .shell.side-pinned .side-nav-footer .drawer-email {
        display: none;
      }
      .shell.side-pinned .side-nav-footer {
        padding: 0.75rem 0.35rem;
      }
      .shell.side-pinned .side-nav-footer button {
        padding: 0.5rem;
        font-size: 0.75rem;
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
          --shell-topbar-h: 3.5rem;
        }
        .shell.app-chrome-hidden {
          --shell-topbar-h: 0px;
        }
        .topbar {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 1.5rem;
          padding: 0.45rem 1.25rem;
        }
        .shell:not(.in-absences) .topbar {
          display: flex;
          justify-content: space-between;
        }
        .brand-name {
          font-size: 1.05rem;
        }
        .brand-module {
          font-size: 0.72rem;
        }
        .brand-mark {
          width: 32px;
          height: 32px;
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

  /** SVG path `d` for a nav route (24×24 viewBox). */
  navIconPath(path: string): string {
    switch (path) {
      case '/':
        return 'M12 3 4 9v12h5v-7h6v7h5V9l-8-6z';
      case '/people':
        return 'M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-8 0a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 8 11zm8 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zM8 13c-.29 0-.62.02-.97.05C4.84 13.42 2 14.53 2 17v2h6v-2c0-.7.18-2.32 2.39-3.47C9.5 13.18 8.74 13 8 13z';
      case '/questionnaires':
        return 'M7 3h10a2 2 0 0 1 2 2v14l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2zm2 5v2h6V8H9zm0 4v2h6v-2H9z';
      case '/absences':
      case '/absences/calendar':
        return 'M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V2zm12 7H5v10h14V9zM7 11h4v4H7v-4z';
      case 'requests':
        return 'M4 4h16v2H4V4zm0 5h16v2H4V9zm0 5h10v2H4v-2zm0 5h8v2H4v-2z';
      case '/statistics':
        return 'M4 19h16v2H4v-2zm2-2V9h3v8H6zm5 0V5h3v12h-3zm5 0v-6h3v6h-3z';
      case '/settings':
        return 'M19.14 12.94a7.43 7.43 0 0 0 .05-.94 7.43 7.43 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.66 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.05.62-.05.94s.02.63.05.94L2.78 14.5a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.71 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5z';
      default:
        return 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z';
    }
  }

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
