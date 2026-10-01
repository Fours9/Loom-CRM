import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
  catchError,
  distinctUntilChanged,
  EMPTY,
  filter,
  forkJoin,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import type {
  EmploymentAssignmentHistoryItem,
  EmployeeProfileHistoryItem,
  EmployeeProfileResponse,
} from '@loom/contracts-employees';
import { Permission } from '@loom/contracts-auth';
import { SessionStore } from '../../core/auth/session.store';
import {
  CalendarPageComponent,
  EmployeeAbsenceRequestsPanelComponent,
  EmployeeWorkSchedulePanelComponent,
} from '../absences/public-api';
import { EmployeeQuestionnairesPanelComponent } from '../questionnaires/public-api';
import { EmployeeDocumentsPanelComponent } from './employee-documents-panel.component';
import { EmployeeProfileCompletenessComponent } from './employee-profile-completeness.component';
import { EmployeeHistoryPanelComponent } from './employee-history-panel.component';
import { EmployeeDataPanelComponent } from './employee-data-panel.component';
import { EmployeeAboutPanelComponent } from './employee-about-panel.component';
import { EmployeeSkillsMatrixPanelComponent } from './employee-skills-matrix-panel.component';
import { EmployeeAccountPanelComponent } from './employee-account-panel.component';
import { EmployeeRoleAccessPanelComponent } from './employee-role-access-panel.component';
import {
  canShowAccountAdminTab,
  canShowRoleAccessAdminTab,
  peopleProfileTabLabel,
  resolvePeopleProfileTab,
  visiblePeopleProfileTabs,
  type PeopleProfileTabId,
} from './people-profile-tabs';
import { HelpPageContextService } from '../../core/help';

type AssignmentHistoryItem = EmploymentAssignmentHistoryItem;

type AbsenceTabId = 'position' | 'requests' | 'calendar' | 'schedule';
type AdminTabId = 'history' | 'account' | 'roleAccess';
type MetricsTabId = 'skills';

@Component({
  selector: 'loom-people-profile-page',
  standalone: true,
  imports: [
    RouterLink,
    CalendarPageComponent,
    EmployeeAbsenceRequestsPanelComponent,
    EmployeeWorkSchedulePanelComponent,
    EmployeeDocumentsPanelComponent,
    EmployeeQuestionnairesPanelComponent,
    EmployeeProfileCompletenessComponent,
    EmployeeHistoryPanelComponent,
    EmployeeDataPanelComponent,
    EmployeeAboutPanelComponent,
    EmployeeSkillsMatrixPanelComponent,
    EmployeeAccountPanelComponent,
    EmployeeRoleAccessPanelComponent,
  ],
  template: `
    @if (loading()) {
      <p class="muted">Завантаження профілю…</p>
    } @else if (error() && !profile()) {
      <p class="error">{{ error() }}</p>
    } @else if (profile()) {
      <article class="profile">
        <header class="hero">
          <div class="hero-main">
            <div class="avatar" aria-hidden="true">
              @if (profile()!.header.photoUrl) {
                <img [src]="profile()!.header.photoUrl" alt="" />
              } @else {
                <span>{{ initials(profile()!.header.displayName) }}</span>
              }
            </div>
            <div>
              <p class="eyebrow">#{{ profile()!.header.employeeNumber }}</p>
              <h1>{{ profile()!.header.displayName }}</h1>
              <p class="meta">
                {{ profile()!.header.position?.name || 'Без посади' }}
                ·
                {{ profile()!.header.department?.name || 'Без відділу' }}
                @if (profile()!.header.direction?.name) {
                  · {{ profile()!.header.direction?.name }}
                }
              </p>
              <div class="badges">
                <span class="badge" [attr.data-status]="profile()!.header.employmentStatus">
                  {{ statusLabel(profile()!.header.employmentStatus) }}
                </span>
                <span class="badge accent">
                  Профіль {{ profile()!.completeness.core.percent }}%
                </span>
              </div>
            </div>
          </div>
          <div class="actions">
            <a class="btn ghost" [routerLink]="['/absences/employees', profile()!.header.id]">
              Анкета Absences
            </a>
          </div>
        </header>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <loom-employee-profile-completeness
          #completenessAnchor
          [completeness]="profile()!.completeness"
        />

        <nav class="tabs" aria-label="Розділи профілю">
          @for (t of visibleTabs(); track t.id) {
            <button
              type="button"
              class="tab"
              [class.active]="tab() === t.id"
              (mousedown)="$event.preventDefault()"
              (click)="setTab(t.id)"
            >
              {{ t.label }}
            </button>
          }
        </nav>

        <section class="panel">
          @switch (tab()) {
            @case ('data') {
              <loom-employee-data-panel
                panelMode="employee-data"
                [employeeId]="employeeId"
                [profile]="profile()!"
                [historyAssign]="historyAssign()"
                (profileChange)="onDataProfileChange($event)"
                (historyAssignChange)="historyAssign.set($event)"
                (errorChange)="error.set($event)"
              />
            }
            @case ('absences') {
              <nav class="tabs subtabs" role="tablist" aria-label="Робота працівника">
                <button
                  type="button"
                  class="tab"
                  role="tab"
                  [attr.aria-selected]="absenceTab() === 'position'"
                  [class.active]="absenceTab() === 'position'"
                  (mousedown)="$event.preventDefault()"
                  (click)="setAbsenceTab('position')"
                >
                  Посада
                </button>
                @if (canViewAbsencesSchedule()) {
                  <button
                    type="button"
                    class="tab"
                    role="tab"
                    [attr.aria-selected]="absenceTab() === 'schedule'"
                    [class.active]="absenceTab() === 'schedule'"
                    (mousedown)="$event.preventDefault()"
                    (click)="setAbsenceTab('schedule')"
                  >
                    Графік роботи
                  </button>
                  <button
                    type="button"
                    class="tab"
                    role="tab"
                    [attr.aria-selected]="absenceTab() === 'requests'"
                    [class.active]="absenceTab() === 'requests'"
                    (mousedown)="$event.preventDefault()"
                    (click)="setAbsenceTab('requests')"
                  >
                    Заявки
                  </button>
                  <button
                    type="button"
                    class="tab"
                    role="tab"
                    [attr.aria-selected]="absenceTab() === 'calendar'"
                    [class.active]="absenceTab() === 'calendar'"
                    (mousedown)="$event.preventDefault()"
                    (click)="setAbsenceTab('calendar')"
                  >
                    Календар
                  </button>
                }
              </nav>

              @if (absenceTab() === 'position') {
                <loom-employee-data-panel
                  panelMode="position"
                  [employeeId]="employeeId"
                  [profile]="profile()!"
                  [historyAssign]="historyAssign()"
                  (profileChange)="onDataProfileChange($event)"
                  (historyAssignChange)="historyAssign.set($event)"
                  (errorChange)="error.set($event)"
                />
              } @else if (absenceTab() === 'schedule') {
                <app-employee-work-schedule-panel [employeeId]="profile()!.header.id" />
              } @else if (absenceTab() === 'requests') {
                <app-employee-absence-requests-panel [employeeId]="profile()!.header.id" />
              } @else {
                @defer (on immediate) {
                  <app-calendar-page
                    [presetEmployeeId]="profile()!.header.id"
                    [employeeOnlyMode]="true"
                    [embedded]="true"
                  />
                } @placeholder {
                  <p class="muted">Підготовка календаря…</p>
                } @loading (after 100ms) {
                  <p class="muted">Завантаження календаря…</p>
                } @error {
                  <p class="error">Не вдалося завантажити календар.</p>
                }
              }
            }
            @case ('documents') {
              @defer (on immediate) {
                <app-employee-documents-panel [employeeId]="profile()!.header.id" />
              } @placeholder {
                <p class="muted">Підготовка документів…</p>
              } @loading (after 100ms) {
                <p class="muted">Завантаження документів…</p>
              } @error {
                <p class="error">Не вдалося завантажити документи.</p>
              }
            }
            @case ('questionnaires') {
              @defer (on immediate) {
                <loom-employee-questionnaires-panel
                  [employeeId]="profile()!.header.id"
                  [employeeFullName]="profile()!.header.displayName"
                />
              } @placeholder {
                <p class="muted">Підготовка анкет…</p>
              } @loading (after 100ms) {
                <p class="muted">Завантаження анкет…</p>
              } @error {
                <p class="error">Не вдалося завантажити анкети.</p>
              }
            }
            @case ('about') {
              <loom-employee-about-panel [employeeId]="employeeId" />
            }
            @case ('metrics') {
              <nav
                class="tabs subtabs"
                role="tablist"
                aria-label="Показники працівника"
              >
                <button
                  type="button"
                  class="tab"
                  role="tab"
                  [attr.aria-selected]="metricsTab() === 'skills'"
                  [class.active]="metricsTab() === 'skills'"
                  (mousedown)="$event.preventDefault()"
                  (click)="setMetricsTab('skills')"
                >
                  Матриця навичок
                </button>
              </nav>
              @if (metricsTab() === 'skills') {
                <loom-employee-skills-matrix-panel [employeeId]="employeeId" />
              }
            }
            @case ('administration') {
              <nav
                class="tabs subtabs"
                role="tablist"
                aria-label="Адміністрування працівника"
              >
                @if (profile()!.capabilities.canViewHistory) {
                  <button
                    type="button"
                    class="tab"
                    role="tab"
                    [attr.aria-selected]="adminTab() === 'history'"
                    [class.active]="adminTab() === 'history'"
                    (mousedown)="$event.preventDefault()"
                    (click)="setAdminTab('history')"
                  >
                    Історія
                  </button>
                }
                @if (showAccountAdminTab()) {
                  <button
                    type="button"
                    class="tab"
                    role="tab"
                    [attr.aria-selected]="adminTab() === 'account'"
                    [class.active]="adminTab() === 'account'"
                    (mousedown)="$event.preventDefault()"
                    (click)="setAdminTab('account')"
                  >
                    Акаунт
                  </button>
                }
                @if (showRoleAccessAdminTab()) {
                  <button
                    type="button"
                    class="tab"
                    role="tab"
                    [attr.aria-selected]="adminTab() === 'roleAccess'"
                    [class.active]="adminTab() === 'roleAccess'"
                    (mousedown)="$event.preventDefault()"
                    (click)="setAdminTab('roleAccess')"
                  >
                    Роль та допуски
                  </button>
                }
              </nav>

              @if (adminTab() === 'history' && profile()!.capabilities.canViewHistory) {
                <loom-employee-history-panel [items]="audit()" />
              }
              @if (adminTab() === 'account' && showAccountAdminTab()) {
                <loom-employee-account-panel
                  [employeeId]="employeeId"
                  [header]="profile()!.header"
                  [caps]="profile()!.capabilities"
                  (changed)="reloadProfile()"
                  (deleted)="onEmployeeHardDeleted()"
                />
              }
              @if (adminTab() === 'roleAccess' && showRoleAccessAdminTab()) {
                <loom-employee-role-access-panel
                  [employeeId]="employeeId"
                  [access]="profile()!.sections.access"
                  [caps]="profile()!.capabilities"
                  (changed)="reloadProfile()"
                />
              }
            }
            @default {
              <h2>Наступні модулі</h2>
              <p class="muted">
                Onboarding, Skills, Goals, Reviews —
                див. roadmap (Phases 2–9). Не змішуємо з Profile Core.
              </p>
            }
          }
        </section>
      </article>
    }
  `,
  styles: [
    `
      .profile {
        display: grid;
        gap: 1rem;
      }
      .hero {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem;
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        background: var(--pw-surface);
      }
      .hero-main {
        display: flex;
        gap: 1rem;
        min-width: 0;
      }
      .avatar {
        width: 72px;
        height: 72px;
        border-radius: 16px;
        background: color-mix(in srgb, var(--pw-accent) 15%, var(--pw-surface));
        display: grid;
        place-items: center;
        overflow: hidden;
        flex-shrink: 0;
        font-weight: 700;
      }
      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      h1 {
        margin: 0;
        font-size: 1.5rem;
      }
      h2 {
        margin: 0;
      }
      .eyebrow {
        margin: 0;
        color: var(--pw-muted);
        font-size: 0.85rem;
      }
      .meta {
        margin: 0.25rem 0;
        color: var(--pw-muted);
      }
      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 0.2rem 0.65rem;
        font-size: 0.8rem;
        border: 1px solid var(--pw-border);
        background: var(--pw-surface);
      }
      .badge.accent {
        border-color: color-mix(in srgb, var(--pw-accent) 40%, var(--pw-border));
        color: var(--pw-accent);
      }
      .badge[data-status='active'] {
        background: color-mix(in srgb, #1a7f37 12%, var(--pw-surface));
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: flex-start;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        border: 1px solid var(--pw-border);
        background: var(--pw-accent);
        color: #fff;
        border-radius: 8px;
        padding: 0.45rem 0.8rem;
        text-decoration: none;
        cursor: pointer;
      }
      .btn.ghost {
        background: var(--pw-accent-soft, #e8eef5);
        border: 1px solid color-mix(in srgb, var(--pw-accent) 35%, var(--pw-border));
        color: var(--pw-accent);
      }
      .btn.ghost:hover {
        background: color-mix(in srgb, var(--pw-accent) 16%, var(--pw-surface));
        border-color: var(--pw-accent);
      }
      .tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
      }
      .tab {
        border: 1px solid var(--pw-border);
        background: var(--pw-surface);
        border-radius: 999px;
        padding: 0.35rem 0.85rem;
        cursor: pointer;
      }
      .tab.active {
        border-color: var(--pw-accent);
        color: var(--pw-accent);
      }
      .panel {
        padding: 1rem;
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        background: var(--pw-surface);
        /* Keep header/completeness stable when tab body height changes. */
        overflow-anchor: none;
      }
      .subtabs {
        margin-bottom: 0.25rem;
        padding-bottom: 0.65rem;
        border-bottom: 1px solid var(--pw-border);
      }
      .subtabs .tab {
        min-height: 2.1rem;
        padding: 0.35rem 0.7rem;
        font-size: 0.9rem;
        border-width: 1.5px;
        border-color: var(--pw-border-strong, var(--pw-border));
        background: var(--pw-surface-2, color-mix(in srgb, var(--pw-muted) 8%, var(--pw-surface)));
        color: var(--pw-text);
      }
      .subtabs .tab:hover {
        border-color: var(--pw-accent);
        color: var(--pw-accent);
      }
      .subtabs .tab.active {
        border-color: var(--pw-accent);
        background: var(--pw-accent-soft);
        color: var(--pw-accent);
        font-weight: 700;
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pw-accent) 35%, transparent);
      }
      .muted {
        color: var(--pw-muted);
      }
      .error {
        color: var(--pw-danger, #a32d2d);
      }
      @media (max-width: 640px) {
        .hero {
          padding: 0.85rem;
        }
        .actions {
          width: 100%;
        }
        .btn {
          flex: 1 1 auto;
          justify-content: center;
        }
      }
    `,
  ],
})
export class PeopleProfilePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(SessionStore);
  private readonly helpPageContext = inject(HelpPageContextService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly profile = signal<EmployeeProfileResponse | null>(null);
  readonly tab = signal<PeopleProfileTabId>('data');
  readonly absenceTab = signal<AbsenceTabId>('position');
  readonly adminTab = signal<AdminTabId>('history');
  readonly metricsTab = signal<MetricsTabId>('skills');
  readonly audit = signal<EmployeeProfileHistoryItem[]>([]);
  readonly historyAssign = signal<AssignmentHistoryItem[]>([]);

  @ViewChild('completenessAnchor', { read: ElementRef })
  private completenessAnchor?: ElementRef<HTMLElement>;

  employeeId = '';

  readonly visibleTabs = computed(() =>
    visiblePeopleProfileTabs({
      capabilities: this.profile()?.capabilities,
      permissions: this.session.user()?.permissions ?? [],
      surfaces: this.session.surfaces(),
      isAdminEquivalent: this.session.isAdminEquivalent(),
    }),
  );

  readonly showAccountAdminTab = computed(() =>
    canShowAccountAdminTab(this.profile()?.capabilities),
  );

  readonly showRoleAccessAdminTab = computed(() =>
    canShowRoleAccessAdminTab(this.profile()?.capabilities),
  );

  readonly canViewAbsencesSchedule = computed(() =>
    (this.session.user()?.permissions ?? []).includes(
      Permission.AbsencesCalendarView,
    ),
  );

  constructor() {
    effect(() => {
      const visible = this.visibleTabs();
      const current = this.tab();
      const resolved = resolvePeopleProfileTab(current, visible);
      if (resolved !== current) {
        this.tab.set(resolved);
      }
    });

    effect(() => {
      const tab = this.tab();
      this.helpPageContext.setFeatureContext('people-profile', {
        label: peopleProfileTabLabel(tab),
        tourId: tab === 'questionnaires' ? 'questionnaires.employee' : null,
        soon: tab !== 'questionnaires',
      });
    });
    this.destroyRef.onDestroy(() => {
      this.helpPageContext.clearFeatureContext('people-profile');
    });

    effect(() => {
      if (!this.canViewAbsencesSchedule() && this.absenceTab() !== 'position') {
        this.absenceTab.set('position');
      }
    });

    effect(() => {
      const caps = this.profile()?.capabilities;
      const historyOk = Boolean(caps?.canViewHistory);
      const accountOk = canShowAccountAdminTab(caps);
      const roleAccessOk = canShowRoleAccessAdminTab(caps);
      const current = this.adminTab();
      const allowed =
        (current === 'history' && historyOk) ||
        (current === 'account' && accountOk) ||
        (current === 'roleAccess' && roleAccessOk);
      if (allowed) return;
      if (historyOk) {
        this.adminTab.set('history');
      } else if (accountOk) {
        this.adminTab.set('account');
      } else if (roleAccessOk) {
        this.adminTab.set('roleAccess');
      }
    });
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        filter((id): id is string => Boolean(id)),
        distinctUntilChanged(),
        tap((employeeId) => {
          this.employeeId = employeeId;
          this.resetProfileState();
          this.loading.set(true);
        }),
        switchMap((employeeId) =>
          this.http.get<EmployeeProfileResponse>(`/api/v1/employees/${employeeId}/profile`).pipe(
            map((profile) => ({ employeeId, profile })),
            catchError(() => {
              this.error.set('Не вдалося завантажити профіль');
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ employeeId, profile }) => {
        this.profile.set(profile);
        this.loading.set(false);
        this.loadSecondaryData(employeeId, profile);
      });
  }

  setTab(requested: PeopleProfileTabId): void {
    const resolved = resolvePeopleProfileTab(requested, this.visibleTabs());
    if (this.tab() === resolved) return;
    this.withPreservedScroll(() => this.tab.set(resolved));
  }

  setAbsenceTab(id: AbsenceTabId): void {
    if (id !== 'position' && !this.canViewAbsencesSchedule()) return;
    if (this.absenceTab() === id) return;
    this.withPreservedScroll(() => this.absenceTab.set(id));
  }

  setAdminTab(id: AdminTabId): void {
    if (this.adminTab() === id) return;
    this.withPreservedScroll(() => this.adminTab.set(id));
  }

  setMetricsTab(id: MetricsTabId): void {
    if (this.metricsTab() === id) return;
    this.withPreservedScroll(() => this.metricsTab.set(id));
  }

  onDataProfileChange(next: EmployeeProfileResponse): void {
    this.profile.set(next);
    this.error.set(null);
  }

  reloadProfile(): void {
    if (!this.employeeId) return;
    this.http
      .get<EmployeeProfileResponse>(`/api/v1/employees/${this.employeeId}/profile`)
      .pipe(
        catchError(() => {
          this.error.set('Не вдалося оновити профіль');
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((profile) => {
        this.profile.set(profile);
        this.error.set(null);
        this.loadSecondaryData(this.employeeId, profile);
      });
  }

  onEmployeeHardDeleted(): void {
    void this.router.navigate(['/people']);
  }

  initials(name: string): string {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      draft: 'Чернетка',
      candidate: 'Кандидат',
      preboarding: 'Preboarding',
      probation: 'Випробувальний',
      active: 'Активний',
      suspended: 'Призупинений',
      maternity_leave: 'Декрет',
      military_leave: 'Військова',
      dismissed: 'Звільнений',
      archived: 'Архів',
    };
    return map[status] ?? status;
  }

  private resetProfileState(): void {
    this.profile.set(null);
    this.audit.set([]);
    this.historyAssign.set([]);
    this.error.set(null);
    this.tab.set('data');
    this.absenceTab.set('position');
  }

  /** Keep completeness bar at the same viewport Y when tab body reflows. */
  private withPreservedScroll(action: () => void): void {
    const anchor = this.completenessAnchor?.nativeElement ?? null;
    const beforeTop = anchor?.getBoundingClientRect().top ?? null;
    const y = window.scrollY;
    action();
    const restore = () => {
      if (anchor && beforeTop != null) {
        const delta = anchor.getBoundingClientRect().top - beforeTop;
        if (Math.abs(delta) > 0.5) {
          window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
          return;
        }
      }
      window.scrollTo({ top: y, left: 0, behavior: 'auto' });
    };
    requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(restore);
    });
  }

  private loadSecondaryData(employeeId: string, profile: EmployeeProfileResponse): void {
    const history$ = profile.capabilities.canViewHistory
      ? this.http
          .get<EmployeeProfileHistoryItem[]>(
            `/api/v1/employees/${employeeId}/history`,
          )
          .pipe(catchError(() => of([])))
      : of([]);

    const assignments$ = this.http
      .get<AssignmentHistoryItem[]>(`/api/v1/employees/${employeeId}/employment-history`)
      .pipe(catchError(() => of([] as AssignmentHistoryItem[])));

    forkJoin({ history: history$, assignments: assignments$ }).subscribe({
      next: ({ history, assignments }) => {
        if (employeeId !== this.employeeId) return;
        this.audit.set(history);
        this.historyAssign.set(assignments);
      },
      });
  }
}
