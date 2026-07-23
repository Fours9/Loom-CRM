import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api/api.service';
import { Department, Position, PrivacySettings } from '../core/api/models';
import { AuthService } from '../core/auth/auth.service';
import {
  ABSENCE_VISIBILITY_MODE_OPTIONS,
  EMPLOYEE_ABSENCE_DETAIL_OPTIONS,
  PROFILE_VISIBILITY_MODE_OPTIONS,
} from '../core/api/labels';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="page">
      <h1>Адміністрування</h1>
      <p class="lead">Довідники та налаштування конфіденційності</p>

      @if (!isAdmin) {
        <p class="muted">Керувати довідниками може лише адміністратор.</p>
      }

      <div class="grid">
        <article class="card card-departments">
          <h2>Відділи</h2>
          @if (isAdmin) {
            <form class="inline" (ngSubmit)="addDepartment()">
              <input [(ngModel)]="newDepartment" name="newDepartment" placeholder="Назва відділу" />
              <button type="submit">Додати</button>
            </form>
          }
          <ul>
            @for (d of departments; track d.id) {
              <li>
                <span>
                  {{ d.name }}
                  @if (!d.isActive || d.isHidden) {
                    <small class="badge">приховано</small>
                  }
                </span>
                @if (isAdmin) {
                  @if (d.isActive && !d.isHidden) {
                    <button type="button" class="ghost" (click)="hideDepartment(d)">Приховати</button>
                  } @else {
                    <button type="button" class="ok-btn" (click)="showDepartment(d)">Показати</button>
                  }
                }
              </li>
            }
          </ul>
        </article>

        <article class="card card-positions">
          <h2>Посади</h2>
          @if (isAdmin) {
            <form class="inline inline-positions" (ngSubmit)="addPosition()">
              <input [(ngModel)]="newPosition" name="newPosition" placeholder="Назва посади" />
              <select [(ngModel)]="newPositionDepartmentId" name="newPositionDepartmentId">
                <option value="">Без відділу</option>
                @for (d of activeDepartments; track d.id) {
                  <option [value]="d.id">{{ d.name }}</option>
                }
              </select>
              <button type="submit">Додати</button>
            </form>
          }
          <ul>
            @for (p of positions; track p.id) {
              <li>
                <span>
                  {{ p.name }} <small>{{ p.department?.name || '' }}</small>
                  @if (!p.isActive) {
                    <small class="badge">вимкнено</small>
                  }
                </span>
                @if (isAdmin) {
                  @if (p.isActive) {
                    <button type="button" class="ghost" (click)="disablePosition(p)">Вимкнути</button>
                  } @else {
                    <button type="button" class="ok-btn" (click)="enablePosition(p)">Увімкнути</button>
                  }
                }
              </li>
            }
          </ul>
        </article>

        <article class="card card-privacy">
          <h2>Конфіденційність</h2>
          @if (privacy) {
            <label class="check">
              <input
                type="checkbox"
                [(ngModel)]="privacy.globalPrivacyPriority"
                name="globalPriority"
                [disabled]="!isAdmin"
                (ngModelChange)="privacyMessage = ''"
              />
              Глобальні налаштування мають пріоритет над індивідуальними
            </label>
            @if (privacy.globalPrivacyPriority) {
              <p class="muted">Індивідуальні права в анкетах працівників зараз ігноруються.</p>
            }

            <h3 class="privacy-section">Налаштування анкет</h3>
            <label>
              Режим видимості чужих анкет
              <select
                [(ngModel)]="privacy.profileVisibilityMode"
                name="profileMode"
                [disabled]="!isAdmin"
                (ngModelChange)="privacyMessage = ''"
              >
                @for (opt of profileModeOptions; track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </label>

            <h3 class="privacy-section">Налаштування відсутностей</h3>
            <div class="privacy-absence-stack">
              <label>
                Режим видимості чужих відсутностей
                <select
                  [(ngModel)]="privacy.absenceVisibilityMode"
                  name="mode"
                  [disabled]="!isAdmin"
                  (ngModelChange)="privacyMessage = ''"
                >
                  @for (opt of absenceModeOptions; track opt.value) {
                    <option [value]="opt.value">{{ opt.label }}</option>
                  }
                </select>
              </label>
              @if (privacy.absenceVisibilityMode !== 'none') {
                <div class="privacy-subsetting">
                  <p class="subsetting-caption">Підрежим режиму видимості відсутностей</p>
                  <label>
                    Деталі (тип / причина)
                    <select
                      [ngModel]="employeeAbsenceDetail"
                      name="employeeAbsenceDetail"
                      [disabled]="!isAdmin"
                      (ngModelChange)="onEmployeeAbsenceDetailChange($event)"
                    >
                      @for (opt of employeeAbsenceDetailOptions; track opt.value) {
                        <option [value]="opt.value">{{ opt.label }}</option>
                      }
                    </select>
                  </label>
                  <p class="muted detail-hint">
                    Лише чужі peer-відсутності в календарі й списках заявок (працівник і менеджер
                    поза managed). Власні, admin і заявки керованих відділів завжди повні.
                  </p>
                </div>
              }
            </div>
            @if (isAdmin) {
              <button type="button" (click)="savePrivacy()">Зберегти</button>
            }
            @if (privacyMessage) {
              <p class="ok">{{ privacyMessage }}</p>
            }
          }
        </article>
      </div>
      @if (error) {
        <p class="error">{{ error }}</p>
      }
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
      .lead, .muted { color: var(--pw-muted); margin: 0; }
      .grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: 1fr;
        align-items: start;
      }
      @media (min-width: 641px) {
        .grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); }
      }
      @media (min-width: 1100px) {
        .grid { grid-template-columns: minmax(16rem, 1fr) minmax(22rem, 1.55fr) minmax(18rem, 1.15fr); }
      }
      .card-privacy {
        width: 100%;
      }
      .card {
        background: var(--pw-surface);
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        padding: 1rem;
        display: grid;
        gap: 0.75rem;
        align-content: start;
        min-width: 0;
      }
      .inline {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      }
      .inline input { flex: 1 1 120px; min-width: 0; }
      .inline select { flex: 1 1 120px; min-width: 0; }
      .inline button { flex: 0 0 auto; white-space: nowrap; }
      .inline-positions {
        flex-wrap: wrap;
      }
      .inline-positions input { flex: 1 1 auto; min-width: 6rem; }
      .inline-positions select { max-width: none; flex: 1 1 100%; }
      @media (min-width: 641px) {
        .inline-positions { flex-wrap: nowrap; }
        .inline-positions select { flex: 0 1 9rem; min-width: 7rem; max-width: 11rem; }
      }
      input, select, button { padding: 0.5rem 0.7rem; border-radius: 8px; border: 1px solid var(--pw-border-strong); box-sizing: border-box; }
      button { background: var(--pw-accent); color: var(--pw-on-accent); border: 0; cursor: pointer; }
      .ghost { background: transparent; color: var(--pw-danger); border: 1px solid #f3d1d1; }
      .ok-btn { background: transparent; color: #027a48; border: 1px solid #abefc6; }
      ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.45rem; }
      li { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; padding: 0.35rem 0; border-bottom: 1px solid #eef2f7; }
      small { color: var(--pw-muted); margin-left: 0.35rem; }
      .badge { background: #fef3c7; color: #92400e; padding: 0.1rem 0.4rem; border-radius: 999px; }
      label { display: grid; gap: 0.35rem; }
      .check { display: flex; gap: 0.5rem; align-items: center; }
      .check input { width: auto; }
      .detail-hint { margin: 0; font-size: 0.85rem; }
      .privacy-section {
        margin: 0.35rem 0 0;
        font-size: 0.95rem;
        font-weight: 600;
      }
      .privacy-absence-stack {
        display: grid;
        gap: 0.55rem;
      }
      .privacy-subsetting {
        display: grid;
        gap: 0.45rem;
        margin-left: 0.35rem;
        padding: 0.65rem 0.75rem;
        border-left: 3px solid color-mix(in srgb, var(--pw-accent) 55%, transparent);
        background: color-mix(in srgb, var(--pw-border) 35%, transparent);
        border-radius: 0 8px 8px 0;
      }
      .subsetting-caption {
        margin: 0;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--pw-muted);
      }
      .error { color: var(--pw-danger); } .ok { color: #027a48; margin: 0; }
    `,
  ],
})
export class AdminPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  departments: Department[] = [];
  positions: Position[] = [];
  privacy: PrivacySettings | null = null;
  newDepartment = '';
  newPosition = '';
  newPositionDepartmentId = '';
  error = '';
  privacyMessage = '';
  readonly absenceModeOptions = ABSENCE_VISIBILITY_MODE_OPTIONS;
  readonly profileModeOptions = PROFILE_VISIBILITY_MODE_OPTIONS;
  readonly employeeAbsenceDetailOptions = EMPLOYEE_ABSENCE_DETAIL_OPTIONS;

  get isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  get activeDepartments(): Department[] {
    return this.departments.filter((d) => d.isActive && !d.isHidden);
  }

  get employeeAbsenceDetail(): 'full' | 'hide_type' {
    return this.privacy?.showAbsenceTypeToPeers === false ? 'hide_type' : 'full';
  }

  onEmployeeAbsenceDetailChange(value: 'full' | 'hide_type'): void {
    if (!this.privacy) return;
    this.privacy.showAbsenceTypeToPeers = value === 'full';
    this.privacyMessage = '';
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.api.getDepartments(true).subscribe({
      next: (d) => (this.departments = d),
      error: () => (this.error = 'Не вдалося завантажити відділи'),
    });
    this.api.getPositions(undefined, true).subscribe({
      next: (p) => (this.positions = p),
      error: () => (this.error = 'Не вдалося завантажити посади'),
    });
    this.api.getPrivacy().subscribe((p) => (this.privacy = p));
  }

  addDepartment(): void {
    this.error = '';
    if (!this.newDepartment.trim()) {
      this.error = 'Вкажіть назву відділу';
      return;
    }
    this.api.createDepartment({ name: this.newDepartment.trim() }).subscribe({
      next: () => {
        this.newDepartment = '';
        this.reload();
      },
      error: (err) => {
        const msg = err?.error?.message;
        this.error = Array.isArray(msg) ? msg.join(', ') : msg || 'Не вдалося додати відділ';
      },
    });
  }

  hideDepartment(d: Department): void {
    this.api.deleteDepartment(d.id).subscribe({
      next: () => this.reload(),
      error: () => (this.error = 'Не вдалося приховати відділ'),
    });
  }

  showDepartment(d: Department): void {
    this.api.updateDepartment(d.id, { isActive: true, isHidden: false }).subscribe({
      next: () => this.reload(),
      error: () => (this.error = 'Не вдалося показати відділ'),
    });
  }

  addPosition(): void {
    this.error = '';
    if (!this.newPosition.trim()) {
      this.error = 'Вкажіть назву посади';
      return;
    }
    this.api
      .createPosition({
        name: this.newPosition.trim(),
        departmentId: this.newPositionDepartmentId || null,
      })
      .subscribe({
        next: () => {
          this.newPosition = '';
          this.newPositionDepartmentId = '';
          this.reload();
        },
        error: (err) => {
          const msg = err?.error?.message;
          this.error = Array.isArray(msg) ? msg.join(', ') : msg || 'Не вдалося додати посаду';
        },
      });
  }

  disablePosition(p: Position): void {
    this.api.deletePosition(p.id).subscribe({
      next: () => this.reload(),
      error: () => (this.error = 'Не вдалося вимкнути посаду'),
    });
  }

  enablePosition(p: Position): void {
    this.api.updatePosition(p.id, { isActive: true }).subscribe({
      next: () => this.reload(),
      error: () => (this.error = 'Не вдалося увімкнути посаду'),
    });
  }

  savePrivacy(): void {
    if (!this.privacy || !this.isAdmin) return;
    this.error = '';
    this.privacyMessage = '';
    this.api
      .updatePrivacy({
        absenceVisibilityMode: this.privacy.absenceVisibilityMode,
        profileVisibilityMode: this.privacy.profileVisibilityMode,
        globalPrivacyPriority: this.privacy.globalPrivacyPriority,
        showAbsenceTypeToPeers: this.privacy.showAbsenceTypeToPeers,
        showDepartmentOnCalendar: this.privacy.showDepartmentOnCalendar,
        showPositionOnCalendar: this.privacy.showPositionOnCalendar,
        sessionInactivityMinutes: this.privacy.sessionInactivityMinutes,
      })
      .subscribe({
        next: (p) => {
          this.privacy = p;
          this.privacyMessage = 'Збережено';
        },
        error: () => (this.error = 'Не вдалося зберегти privacy'),
      });
  }
}
