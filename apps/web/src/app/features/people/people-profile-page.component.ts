import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import type { EmployeeProfileResponse } from '@loom/contracts-employees';
import {
  CalendarPageComponent,
  EmployeeAbsenceRequestsPanelComponent,
} from '../absences/public-api';
import { EmployeeDocumentsPanelComponent } from './employee-documents-panel.component';
import { EmployeeProfileCompletenessComponent } from './employee-profile-completeness.component';
import { EmployeeHistoryPanelComponent } from './employee-history-panel.component';
import {
  AssignmentHistoryItem,
  EmployeeDataPanelComponent,
} from './employee-data-panel.component';

type TabId = 'data' | 'absences' | 'documents' | 'metrics' | 'history' | 'later';
type AbsenceTabId = 'requests' | 'calendar';

@Component({
  selector: 'loom-people-profile-page',
  standalone: true,
  imports: [
    RouterLink,
    CalendarPageComponent,
    EmployeeAbsenceRequestsPanelComponent,
    EmployeeDocumentsPanelComponent,
    EmployeeProfileCompletenessComponent,
    EmployeeHistoryPanelComponent,
    EmployeeDataPanelComponent,
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

        <loom-employee-profile-completeness [completeness]="profile()!.completeness" />

        <nav class="tabs" aria-label="Розділи профілю">
          @for (t of tabs; track t.id) {
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
                [employeeId]="employeeId"
                [profile]="profile()!"
                [historyAssign]="historyAssign()"
                (profileChange)="onDataProfileChange($event)"
                (historyAssignChange)="historyAssign.set($event)"
                (errorChange)="error.set($event)"
              />
            }
            @case ('absences') {
              <nav class="tabs subtabs" role="tablist" aria-label="Відсутності працівника">
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
              </nav>

              @if (absenceTab() === 'requests') {
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
            @case ('metrics') {
              <h2>Показники</h2>
              <p class="muted">Розділ у розробці. Тут з’являться KPI, цілі та метрики працівника.</p>
            }
            @case ('history') {
              <loom-employee-history-panel
                [canViewHistory]="profile()!.capabilities.canViewHistory"
                [items]="audit()"
              />
            }
            @default {
              <h2>Наступні модулі</h2>
              <p class="muted">
                Onboarding, Skills, Goals, Reviews, Questionnaires —
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
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly profile = signal<EmployeeProfileResponse | null>(null);
  readonly tab = signal<TabId>('data');
  readonly absenceTab = signal<AbsenceTabId>('requests');
  readonly audit = signal<Array<{ id: string; action: string; createdAt: string }>>([]);
  readonly historyAssign = signal<AssignmentHistoryItem[]>([]);

  employeeId = '';

  readonly tabs: Array<{ id: TabId; label: string }> = [
    { id: 'data', label: 'Дані працівника' },
    { id: 'absences', label: 'Відсутності' },
    { id: 'documents', label: 'Документи' },
    { id: 'metrics', label: 'Показники' },
    { id: 'history', label: 'Історія' },
    { id: 'later', label: 'Згодом' },
  ];

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

  setTab(id: TabId): void {
    if (this.tab() === id) return;
    this.withPreservedScroll(() => this.tab.set(id));
  }

  setAbsenceTab(id: AbsenceTabId): void {
    if (this.absenceTab() === id) return;
    this.withPreservedScroll(() => this.absenceTab.set(id));
  }

  onDataProfileChange(next: EmployeeProfileResponse): void {
    this.profile.set(next);
    this.error.set(null);
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
    this.absenceTab.set('requests');
  }

  private withPreservedScroll(action: () => void): void {
    const y = window.scrollY;
    action();
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, left: 0, behavior: 'auto' });
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, left: 0, behavior: 'auto' });
      });
    });
  }

  private loadSecondaryData(employeeId: string, profile: EmployeeProfileResponse): void {
    const history$ = profile.capabilities.canViewHistory
      ? this.http
          .get<Array<{ id: string; action: string; createdAt: string }>>(
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
