import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api/api.service';
import { PrivacySettings } from '../core/api/models';
import { AuthService } from '../core/auth/auth.service';
import {
  ABSENCE_VISIBILITY_MODE_OPTIONS,
  EMPLOYEE_ABSENCE_DETAIL_OPTIONS,
  PROFILE_VISIBILITY_MODE_OPTIONS,
} from '../core/api/labels';
import {
  PwSelectComponent,
  type PwSelectOption,
} from '../../../shared/ui/pw-select.component';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [FormsModule, RouterLink, PwSelectComponent],
  template: `
    <section class="page pw-stage" data-help-id="absences.admin">
      <span class="pw-stage__glow" aria-hidden="true"></span>
      <header class="page-head pw-page-head pw-rise">
        <div>
          <h1>Адміністрування</h1>
          <p class="pw-lead">Налаштування конфіденційності</p>
        </div>
      </header>

      @if (!isAdmin) {
        <p class="muted">Керувати налаштуваннями може лише адміністратор.</p>
      }

      <p class="catalog-link">
        Довідники відділів і посад:
        <a routerLink="/positions">Керування посадами</a>
      </p>

      <div class="grid">
        <article class="card card-privacy pw-panel pw-rise" style="--pw-delay: 60ms">
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

            <div class="privacy-profile-block" data-help-id="absences.admin.privacy.profile">
              <h3 class="privacy-section">Налаштування анкет</h3>
              <label>
                Режим видимості чужих анкет
                <loom-pw-select
                  [value]="privacy.profileVisibilityMode"
                  [options]="profileModePwOptions"
                  [disabled]="!isAdmin"
                  (valueChange)="onProfileModeSelected($event)"
                />
              </label>
            </div>

            <div class="privacy-absence-stack" data-help-id="absences.admin.privacy.absences">
              <h3 class="privacy-section">Налаштування відсутностей</h3>
              <label>
                Режим видимості чужих відсутностей
                <loom-pw-select
                  [value]="privacy.absenceVisibilityMode"
                  [options]="absenceModePwOptions"
                  [disabled]="!isAdmin"
                  (valueChange)="onAbsenceModeSelected($event)"
                />
              </label>
              @if (privacy.absenceVisibilityMode !== 'none') {
                <div class="privacy-subsetting">
                  <p class="subsetting-caption">Підрежим режиму видимості відсутностей</p>
                  <label>
                    Деталі (тип / причина)
                    <loom-pw-select
                      [value]="employeeAbsenceDetail"
                      [options]="employeeAbsenceDetailPwOptions"
                      [disabled]="!isAdmin"
                      (valueChange)="onEmployeeAbsenceDetailSelected($event)"
                    />
                  </label>
                  <p class="muted detail-hint">
                    Лише чужі peer-відсутності в календарі й списках заявок (працівник і менеджер
                    поза managed). Власні, admin і заявки керованих відділів завжди повні.
                  </p>
                </div>
              }
            </div>
            @if (isAdmin) {
              <button type="button" class="btn pw-btn" (click)="savePrivacy()">Зберегти</button>
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
      .catalog-link {
        margin: 0;
        color: var(--pw-text);
      }
      .catalog-link a {
        color: var(--pw-accent);
        font-weight: 600;
      }
      .grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: 1fr;
        align-items: start;
      }
      @media (min-width: 800px) {
        .grid { grid-template-columns: minmax(18rem, 32rem); }
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
      input, select, button { padding: 0.5rem 0.7rem; border-radius: 8px; border: 1px solid var(--pw-border-strong); box-sizing: border-box; }
      button { background: var(--pw-accent); color: var(--pw-on-accent); border: 0; cursor: pointer; }
      label { display: grid; gap: 0.35rem; }
      .check { display: flex; gap: 0.5rem; align-items: center; }
      .check input { width: auto; }
      .detail-hint { margin: 0; font-size: 0.85rem; }
      .privacy-section {
        margin: 0.35rem 0 0;
        font-size: 0.95rem;
        font-weight: 600;
      }
      .privacy-profile-block,
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

  privacy: PrivacySettings | null = null;
  error = '';
  privacyMessage = '';
  readonly absenceModeOptions = ABSENCE_VISIBILITY_MODE_OPTIONS;
  readonly profileModeOptions = PROFILE_VISIBILITY_MODE_OPTIONS;
  readonly employeeAbsenceDetailOptions = EMPLOYEE_ABSENCE_DETAIL_OPTIONS;
  readonly profileModePwOptions: PwSelectOption[] = [...PROFILE_VISIBILITY_MODE_OPTIONS];
  readonly absenceModePwOptions: PwSelectOption[] = [...ABSENCE_VISIBILITY_MODE_OPTIONS];
  readonly employeeAbsenceDetailPwOptions: PwSelectOption[] = [
    ...EMPLOYEE_ABSENCE_DETAIL_OPTIONS,
  ];

  get isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  get employeeAbsenceDetail(): 'full' | 'hide_type' {
    return this.privacy?.showAbsenceTypeToPeers === false ? 'hide_type' : 'full';
  }

  onProfileModeSelected(next: string): void {
    if (!this.privacy) return;
    this.privacy.profileVisibilityMode = next as PrivacySettings['profileVisibilityMode'];
    this.privacyMessage = '';
  }

  onAbsenceModeSelected(next: string): void {
    if (!this.privacy) return;
    this.privacy.absenceVisibilityMode = next as PrivacySettings['absenceVisibilityMode'];
    this.privacyMessage = '';
  }

  onEmployeeAbsenceDetailSelected(next: string): void {
    this.onEmployeeAbsenceDetailChange(next as 'full' | 'hide_type');
  }

  onEmployeeAbsenceDetailChange(value: 'full' | 'hide_type'): void {
    if (!this.privacy) return;
    this.privacy.showAbsenceTypeToPeers = value === 'full';
    this.privacyMessage = '';
  }

  ngOnInit(): void {
    this.api.getPrivacy().subscribe({
      next: (p) => (this.privacy = p),
      error: () => (this.error = 'Не вдалося завантажити privacy'),
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
