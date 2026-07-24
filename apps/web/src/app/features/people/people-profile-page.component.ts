import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import type {
  EmployeeProfileCapabilities,
  EmployeeProfileHeader,
  ProfileCompleteness,
} from '@loom/contracts-employees';

type ProfileResponse = {
  header: EmployeeProfileHeader;
  sections: {
    overview?: Record<string, unknown>;
    employment?: Record<string, unknown> | null;
    contacts?: Array<{ id: string; type: string; value: string }>;
    personal?: Record<string, unknown> | null;
    emergencyContact?: Array<Record<string, unknown>> | null;
  };
  capabilities: EmployeeProfileCapabilities;
  completeness: ProfileCompleteness;
};

type TabId =
  | 'overview'
  | 'employment'
  | 'personal'
  | 'absences'
  | 'history'
  | 'later';

@Component({
  selector: 'loom-people-profile-page',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    @if (loading()) {
      <p class="muted">Завантаження профілю…</p>
    } @else if (error()) {
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
                <span class="badge">{{ statusLabel(profile()!.header.employmentStatus) }}</span>
                <span class="badge accent">Профіль {{ profile()!.header.completenessPercent }}%</span>
              </div>
            </div>
          </div>
          <div class="actions">
            @if (profile()!.capabilities.canEditBasic) {
              <button type="button" class="btn" (click)="editing.set(!editing())">
                {{ editing() ? 'Скасувати' : 'Редагувати основні' }}
              </button>
            }
            <a class="btn ghost" [routerLink]="['/absences/requests/new']">Створити відсутність</a>
            <a class="btn ghost" [routerLink]="['/absences/calendar']">Календар</a>
            <a class="btn ghost" [routerLink]="['/absences/employees', profile()!.header.id]">
              Анкета Absences
            </a>
          </div>
        </header>

        <div class="completeness">
          <div class="bar"><span [style.width.%]="profile()!.completeness.percent"></span></div>
          <p>
            Заповнення core-профілю: <strong>{{ profile()!.completeness.percent }}%</strong>
            @if (profile()!.completeness.missingFields.length) {
              · відсутні: {{ profile()!.completeness.missingFields.join(', ') }}
            }
          </p>
        </div>

        <nav class="tabs" aria-label="Розділи профілю">
          @for (t of tabs; track t.id) {
            <button
              type="button"
              class="tab"
              [class.active]="tab() === t.id"
              (click)="tab.set(t.id)"
            >
              {{ t.label }}
            </button>
          }
        </nav>

        <section class="panel">
          @switch (tab()) {
            @case ('overview') {
              <h2>Огляд</h2>
              <dl class="grid">
                <div><dt>Статус</dt><dd>{{ statusLabel(profile()!.header.employmentStatus) }}</dd></div>
                <div><dt>Керівник</dt><dd>{{ profile()!.header.manager?.displayName || '—' }}</dd></div>
                <div><dt>Дата виходу</dt><dd>{{ profile()!.header.hiredAt || '—' }}</dd></div>
                <div><dt>Email</dt><dd>{{ profile()!.header.workEmail || '—' }}</dd></div>
                <div><dt>Телефон</dt><dd>{{ profile()!.header.workPhone || '—' }}</dd></div>
                <div><dt>Telegram</dt><dd>{{ profile()!.header.workTelegram || '—' }}</dd></div>
              </dl>
              @if (editing() && profile()!.capabilities.canEditBasic) {
                <form class="edit" (ngSubmit)="saveBasic()">
                  <label>Ім'я <input [(ngModel)]="basicForm.firstName" name="fn" /></label>
                  <label>Прізвище <input [(ngModel)]="basicForm.lastName" name="ln" /></label>
                  <label>По батькові <input [(ngModel)]="basicForm.middleName" name="mn" /></label>
                  <label>Ім'я для звернення <input [(ngModel)]="basicForm.preferredName" name="pn" /></label>
                  <button class="btn" type="submit" [disabled]="busy()">Зберегти</button>
                </form>
              }
            }
            @case ('employment') {
              <h2>Робота</h2>
              @if (profile()!.sections.employment) {
                <dl class="grid">
                  <div><dt>Компанія</dt><dd>{{ refName(profile()!.sections.employment!['company']) }}</dd></div>
                  <div><dt>Напрямок</dt><dd>{{ refName(profile()!.sections.employment!['direction']) }}</dd></div>
                  <div><dt>Відділ</dt><dd>{{ refName(profile()!.sections.employment!['department']) }}</dd></div>
                  <div><dt>Посада</dt><dd>{{ refName(profile()!.sections.employment!['position']) }}</dd></div>
                  <div><dt>Формат</dt><dd>{{ profile()!.sections.employment!['workFormat'] || '—' }}</dd></div>
                  <div><dt>Локація</dt><dd>{{ profile()!.sections.employment!['workLocation'] || '—' }}</dd></div>
                  <div><dt>Тип зайнятості</dt><dd>{{ profile()!.sections.employment!['employmentType'] || '—' }}</dd></div>
                  <div><dt>Початок</dt><dd>{{ profile()!.sections.employment!['startDate'] || '—' }}</dd></div>
                  <div><dt>Кінець випроб.</dt><dd>{{ profile()!.sections.employment!['probationEndDate'] || '—' }}</dd></div>
                </dl>
              } @else {
                <p class="muted">Призначення ще не задано.</p>
              }
              @if (profile()!.capabilities.canEditEmployment) {
                <details class="edit-block">
                  <summary>Нове призначення</summary>
                  <form class="edit" (ngSubmit)="saveAssignment()">
                    <label>Формат роботи
                      <select [(ngModel)]="assignmentForm.workFormat" name="wf">
                        <option value="">—</option>
                        <option value="office">Офіс</option>
                        <option value="remote">Remote</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </label>
                    <label>Локація <input [(ngModel)]="assignmentForm.workLocation" name="wl" /></label>
                    <label>Дата початку <input type="date" [(ngModel)]="assignmentForm.startDate" name="sd" /></label>
                    <label>Кінець випроб. <input type="date" [(ngModel)]="assignmentForm.probationEndDate" name="pe" /></label>
                    <label>Причина зміни <input [(ngModel)]="assignmentForm.changeReason" name="cr" /></label>
                    <button class="btn" type="submit" [disabled]="busy()">Зберегти призначення</button>
                  </form>
                </details>
              }
              @if (historyAssign().length) {
                <h3>Історія призначень</h3>
                <ul class="timeline">
                  @for (h of historyAssign(); track h.id) {
                    <li>
                      <strong>{{ h.status }}</strong>
                      {{ h.startDate || '?' }} → {{ h.endDate || 'зараз' }}
                      · {{ h.department?.name || '—' }} / {{ h.position?.name || '—' }}
                    </li>
                  }
                </ul>
              }
            }
            @case ('personal') {
              <h2>Особисті дані</h2>
              @if (!profile()!.capabilities.canViewPersonal) {
                <p class="muted">Немає доступу до особистих даних.</p>
              } @else {
                <dl class="grid">
                  <div><dt>Дата народження</dt><dd>{{ profile()!.sections.personal?.['birthDate'] || '—' }}</dd></div>
                  <div><dt>Місто</dt><dd>{{ profile()!.sections.personal?.['city'] || '—' }}</dd></div>
                  <div><dt>Мова</dt><dd>{{ profile()!.sections.personal?.['preferredLanguage'] || '—' }}</dd></div>
                  <div><dt>Ос. телефон</dt><dd>{{ profile()!.sections.personal?.['personalPhone'] || '—' }}</dd></div>
                  <div><dt>Ос. email</dt><dd>{{ profile()!.sections.personal?.['personalEmail'] || '—' }}</dd></div>
                  <div><dt>Ос. Telegram</dt><dd>{{ profile()!.sections.personal?.['personalTelegram'] || '—' }}</dd></div>
                </dl>
                @if (profile()!.capabilities.canEditPersonal) {
                  <form class="edit" (ngSubmit)="savePersonal()">
                    <label>Дата народження <input type="date" [(ngModel)]="personalForm.birthDate" name="bd" /></label>
                    <label>Місто <input [(ngModel)]="personalForm.city" name="city" /></label>
                    <label>Мова <input [(ngModel)]="personalForm.preferredLanguage" name="lang" /></label>
                    <label>Ос. телефон <input [(ngModel)]="personalForm.personalPhone" name="pph" /></label>
                    <label>Ос. email <input [(ngModel)]="personalForm.personalEmail" name="pem" /></label>
                    <label>Ос. Telegram <input [(ngModel)]="personalForm.personalTelegram" name="ptg" /></label>
                    <button class="btn" type="submit" [disabled]="busy()">Зберегти особисті</button>
                  </form>
                }
              }
              <h3>Екстрений контакт</h3>
              @if (!profile()!.capabilities.canViewEmergencyContact) {
                <p class="muted">Немає доступу.</p>
              } @else if ((profile()!.sections.emergencyContact?.length ?? 0) > 0) {
                <ul>
                  @for (e of profile()!.sections.emergencyContact!; track $index) {
                    <li>{{ e['fullName'] }} · {{ e['primaryPhone'] }} · {{ e['relationship'] || '' }}</li>
                  }
                </ul>
              } @else {
                <p class="muted">Не вказано.</p>
              }
              @if (profile()!.capabilities.canEditEmergencyContact) {
                <form class="edit" (ngSubmit)="saveEmergency()">
                  <label>ПІБ <input [(ngModel)]="emergencyForm.fullName" name="efn" required /></label>
                  <label>Зв'язок <input [(ngModel)]="emergencyForm.relationship" name="er" /></label>
                  <label>Телефон <input [(ngModel)]="emergencyForm.primaryPhone" name="epp" required /></label>
                  <button class="btn" type="submit" [disabled]="busy()">Зберегти екстрений</button>
                </form>
              }
            }
            @case ('absences') {
              <h2>Відсутності</h2>
              <p>Дані ведуться в модулі Absences (кадровий статус не змінюється на «відпустка»).</p>
              <p>
                <a [routerLink]="['/absences/employees', profile()!.header.id]">Відкрити картку Absences</a>
                ·
                <a [routerLink]="['/absences/requests']">Заявки</a>
                ·
                <a [routerLink]="['/absences/calendar']">Календар</a>
              </p>
            }
            @case ('history') {
              <h2>Історія</h2>
              @if (!profile()!.capabilities.canViewHistory) {
                <p class="muted">Немає доступу до історії.</p>
              } @else if (!audit().length) {
                <p class="muted">Подій ще немає.</p>
              } @else {
                <ul class="timeline">
                  @for (a of audit(); track a.id) {
                    <li>
                      <strong>{{ a.action }}</strong>
                      <span class="muted">{{ formatDate(a.createdAt) }}</span>
                    </li>
                  }
                </ul>
              }
            }
            @default {
              <h2>Наступні модулі</h2>
              <p class="muted">
                Onboarding, Skills, Goals, Reviews, Documents, Questionnaires —
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
      .profile { display: grid; gap: 1rem; }
      .hero {
        display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1rem;
        padding: 1rem; border: 1px solid var(--pw-border); border-radius: 12px;
        background: var(--pw-surface);
      }
      .hero-main { display: flex; gap: 1rem; min-width: 0; }
      .avatar {
        width: 72px; height: 72px; border-radius: 16px; background: color-mix(in srgb, var(--pw-accent) 15%, var(--pw-surface));
        display: grid; place-items: center; overflow: hidden; flex-shrink: 0; font-weight: 700;
      }
      .avatar img { width: 100%; height: 100%; object-fit: cover; }
      h1 { margin: 0; font-size: 1.5rem; }
      .eyebrow { margin: 0; color: var(--pw-muted); font-size: 0.85rem; }
      .meta { margin: 0.25rem 0; color: var(--pw-muted); }
      .badges { display: flex; flex-wrap: wrap; gap: 0.4rem; }
      .badge {
        border-radius: 999px; padding: 0.2rem 0.65rem; font-size: 0.78rem; font-weight: 600;
        background: var(--pw-paper-2, #f4f2ec); color: var(--pw-text);
      }
      .badge.accent { background: color-mix(in srgb, var(--pw-accent) 18%, transparent); color: var(--pw-accent); }
      .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: start; }
      .btn {
        border: 0; border-radius: 8px; background: var(--pw-accent); color: var(--pw-on-accent);
        padding: 0.55rem 0.9rem; min-height: 2.5rem; font-weight: 600; cursor: pointer; text-decoration: none;
        display: inline-flex; align-items: center;
      }
      .btn.ghost { background: transparent; border: 1px solid var(--pw-border); color: var(--pw-text); }
      .completeness { display: grid; gap: 0.35rem; }
      .bar { height: 8px; background: var(--pw-border); border-radius: 99px; overflow: hidden; }
      .bar span { display: block; height: 100%; background: var(--pw-accent); }
      .tabs { display: flex; flex-wrap: wrap; gap: 0.35rem; }
      .tab {
        border: 1px solid var(--pw-border); background: var(--pw-surface); border-radius: 999px;
        padding: 0.45rem 0.85rem; cursor: pointer; min-height: 2.4rem;
      }
      .tab.active { border-color: var(--pw-accent); color: var(--pw-accent); font-weight: 700; }
      .panel {
        padding: 1rem; border: 1px solid var(--pw-border); border-radius: 12px; background: var(--pw-surface);
        display: grid; gap: 0.75rem;
      }
      .grid { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin: 0; }
      .grid div { display: grid; gap: 0.15rem; }
      dt { color: var(--pw-muted); font-size: 0.8rem; }
      dd { margin: 0; font-weight: 600; }
      .edit, .edit-block { display: grid; gap: 0.6rem; margin-top: 0.75rem; }
      .edit label { display: grid; gap: 0.25rem; font-size: 0.9rem; }
      .edit input, .edit select {
        border: 1px solid var(--pw-border); border-radius: 8px; padding: 0.5rem 0.65rem; min-height: 2.5rem;
        background: var(--pw-surface); color: inherit;
      }
      .timeline { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.5rem; }
      .timeline li { padding: 0.55rem 0; border-bottom: 1px solid var(--pw-border); }
      .muted { color: var(--pw-muted); }
      .error { color: var(--pw-danger, #a32d2d); }
      @media (max-width: 640px) {
        .hero { padding: 0.85rem; }
        .actions { width: 100%; }
        .btn { flex: 1 1 auto; justify-content: center; }
      }
    `,
  ],
})
export class PeopleProfilePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly profile = signal<ProfileResponse | null>(null);
  readonly tab = signal<TabId>('overview');
  readonly editing = signal(false);
  readonly busy = signal(false);
  readonly audit = signal<Array<{ id: string; action: string; createdAt: string }>>([]);
  readonly historyAssign = signal<
    Array<{
      id: string;
      status: string;
      startDate: string | null;
      endDate: string | null;
      department?: { name: string } | null;
      position?: { name: string } | null;
    }>
  >([]);

  readonly tabs: Array<{ id: TabId; label: string }> = [
    { id: 'overview', label: 'Огляд' },
    { id: 'employment', label: 'Робота' },
    { id: 'personal', label: 'Особисті' },
    { id: 'absences', label: 'Відсутності' },
    { id: 'history', label: 'Історія' },
    { id: 'later', label: 'Згодом' },
  ];

  basicForm = {
    firstName: '',
    lastName: '',
    middleName: '',
    preferredName: '',
  };
  personalForm = {
    birthDate: '',
    city: '',
    preferredLanguage: '',
    personalPhone: '',
    personalEmail: '',
    personalTelegram: '',
  };
  emergencyForm = {
    fullName: '',
    relationship: '',
    primaryPhone: '',
  };
  assignmentForm = {
    workFormat: '',
    workLocation: '',
    startDate: '',
    probationEndDate: '',
    changeReason: '',
  };

  private employeeId = '';

  ngOnInit(): void {
    this.employeeId = this.route.snapshot.paramMap.get('id') ?? '';
    this.reload();
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

  refName(value: unknown): string {
    if (value && typeof value === 'object' && 'name' in value) {
      return String((value as { name: string }).name);
    }
    return '—';
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<ProfileResponse>(`/api/v1/employees/${this.employeeId}/profile`).subscribe({
      next: (p) => {
        this.profile.set(p);
        this.basicForm = {
          firstName: String(p.sections.overview?.['firstName'] ?? ''),
          lastName: String(p.sections.overview?.['lastName'] ?? ''),
          middleName: String(p.sections.overview?.['middleName'] ?? ''),
          preferredName: String(p.header.preferredName ?? ''),
        };
        const pers = p.sections.personal ?? {};
        this.personalForm = {
          birthDate: String(pers['birthDate'] ?? ''),
          city: String(pers['city'] ?? ''),
          preferredLanguage: String(pers['preferredLanguage'] ?? ''),
          personalPhone: String(pers['personalPhone'] ?? ''),
          personalEmail: String(pers['personalEmail'] ?? ''),
          personalTelegram: String(pers['personalTelegram'] ?? ''),
        };
        this.loading.set(false);
        if (p.capabilities.canViewHistory) {
          this.http
            .get<Array<{ id: string; action: string; createdAt: string }>>(
              `/api/v1/employees/${this.employeeId}/history`,
            )
            .subscribe({ next: (rows) => this.audit.set(rows) });
        }
        this.http
          .get<
            Array<{
              id: string;
              status: string;
              startDate: string | null;
              endDate: string | null;
              department?: { name: string } | null;
              position?: { name: string } | null;
            }>
          >(`/api/v1/employees/${this.employeeId}/employment-history`)
          .subscribe({ next: (rows) => this.historyAssign.set(rows) });
      },
      error: () => {
        this.error.set('Не вдалося завантажити профіль');
        this.loading.set(false);
      },
    });
  }

  formatDate(value: string): string {
    try {
      return new Date(value).toLocaleString('uk-UA');
    } catch {
      return value;
    }
  }

  saveBasic(): void {
    this.busy.set(true);
    this.http
      .patch(`/api/v1/employees/${this.employeeId}/basic`, {
        firstName: this.basicForm.firstName,
        lastName: this.basicForm.lastName,
        middleName: this.basicForm.middleName || null,
        preferredName: this.basicForm.preferredName || null,
      })
      .subscribe({
        next: (p) => {
          this.profile.set(p as ProfileResponse);
          this.editing.set(false);
          this.busy.set(false);
        },
        error: () => this.busy.set(false),
      });
  }

  savePersonal(): void {
    this.busy.set(true);
    this.http
      .patch(`/api/v1/employees/${this.employeeId}/personal`, {
        birthDate: this.personalForm.birthDate || null,
        city: this.personalForm.city || null,
        preferredLanguage: this.personalForm.preferredLanguage || null,
        personalPhone: this.personalForm.personalPhone || null,
        personalEmail: this.personalForm.personalEmail || null,
        personalTelegram: this.personalForm.personalTelegram || null,
      })
      .subscribe({
        next: (p) => {
          this.profile.set(p as ProfileResponse);
          this.busy.set(false);
        },
        error: () => this.busy.set(false),
      });
  }

  saveEmergency(): void {
    this.busy.set(true);
    this.http
      .put(`/api/v1/employees/${this.employeeId}/emergency-contact`, this.emergencyForm)
      .subscribe({
        next: (p) => {
          this.profile.set(p as ProfileResponse);
          this.busy.set(false);
        },
        error: () => this.busy.set(false),
      });
  }

  saveAssignment(): void {
    const p = this.profile();
    this.busy.set(true);
    this.http
      .post(`/api/v1/employees/${this.employeeId}/employment-assignments`, {
        departmentId: p?.sections.employment?.['departmentId'] ?? null,
        positionId: p?.sections.employment?.['positionId'] ?? null,
        workFormat: this.assignmentForm.workFormat || null,
        workLocation: this.assignmentForm.workLocation || null,
        startDate: this.assignmentForm.startDate || null,
        probationEndDate: this.assignmentForm.probationEndDate || null,
        changeReason: this.assignmentForm.changeReason || null,
      })
      .subscribe({
        next: (res) => {
          this.profile.set(res as ProfileResponse);
          this.busy.set(false);
          this.reload();
        },
        error: () => this.busy.set(false),
      });
  }
}

