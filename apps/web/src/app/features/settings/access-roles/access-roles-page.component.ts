import { Component, computed, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import {
  AccountRolesApiService,
  type AccountRole,
  type AppSurface,
  type CreateAccountRoleBody,
} from './account-roles-api.service';
import { AccountRoleEditDialogComponent } from './account-role-edit-dialog.component';
import type { PublishedQuestionnaireTemplate } from './account-role-edit-dialog.component';
import { PERMISSION_PRESET_LABELS } from './surface-catalog';
import { QuestionnairesApiService } from '../../questionnaires/core/questionnaires-api.service';

@Component({
  selector: 'loom-access-roles-page',
  standalone: true,
  imports: [AccountRoleEditDialogComponent],
  template: `
    <section class="access-roles" data-help-id="settings.access-roles">
      <header class="head">
        <div>
          <h2>Доступи</h2>
          <p class="muted">
            Роль акаунта визначає права в API та перелік екранів інтерфейсу. Керівництво
            у структурі задається посадою, а не роллю акаунта.
          </p>
        </div>
        <button
          type="button"
          data-help-id="settings.access-roles.create"
          (click)="openCreate()"
          [disabled]="loading()"
        >
          Нова роль
        </button>
      </header>

      @if (message()) {
        <p class="ok">{{ message() }}</p>
      }
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      @if (loading()) {
        <p class="muted">Завантаження…</p>
      } @else if (!roles().length) {
        <p class="muted">Ролей ще немає.</p>
      } @else {
        <ul class="role-list">
          @for (role of roles(); track role.id) {
            <li class="role-card">
              <div class="role-main">
                <div class="role-title">
                  <strong>{{ role.name }}</strong>
                  @if (role.isSystem) {
                    <span class="badge">Системна</span>
                  }
                  @if (role.isAdminEquivalent) {
                    <span class="badge badge-admin">Повний доступ</span>
                  }
                </div>
                <p class="muted">
                  Набір прав: {{ presetLabel(role) }} · Екранів:
                  {{ role.isAdminEquivalent ? 'усі' : role.surfaceIds.length }} ·
                  Користувачів: {{ role.userCount }}
                </p>
                @if (surfaceLabels(role); as labels) {
                  <p class="surface-line">{{ labels }}</p>
                }
              </div>
              <div class="role-actions">
                <button type="button" class="ghost-neutral" (click)="openEdit(role)">
                  {{ role.isSystem ? 'Налаштувати' : 'Редагувати' }}
                </button>
                @if (!role.isSystem) {
                  <button
                    type="button"
                    class="ghost-danger"
                    (click)="remove(role)"
                    [disabled]="role.userCount > 0"
                    [title]="
                      role.userCount > 0
                        ? 'Спочатку перепризначте користувачів на іншу роль'
                        : 'Видалити роль'
                    "
                  >
                    Видалити
                  </button>
                }
              </div>
            </li>
          }
        </ul>
      }
    </section>

    @if (dialogOpen()) {
      <loom-account-role-edit-dialog
        [role]="editing()"
        [surfaces]="surfaces()"
        [publishedTemplates]="publishedTemplates()"
        [busy]="saving()"
        [error]="dialogError()"
        (saved)="save($event)"
        (closed)="closeDialog()"
      />
    }
  `,
  styles: [
    `
      .access-roles {
        display: grid;
        gap: 1rem;
      }
      .head {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 1rem;
        flex-wrap: wrap;
      }
      h2 {
        margin: 0;
        font-size: 1.25rem;
      }
      .muted {
        margin: 0.3rem 0 0;
        color: var(--pw-muted);
        font-size: 0.9rem;
      }
      .role-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.6rem;
      }
      .role-card {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 1rem;
        flex-wrap: wrap;
        padding: 0.85rem 1rem;
        border: 1px solid var(--pw-border);
        border-radius: 12px;
        background: var(--pw-surface);
      }
      .role-main {
        display: grid;
        gap: 0.15rem;
        min-width: 0;
        flex: 1 1 20rem;
      }
      .role-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .role-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .surface-line {
        margin: 0.2rem 0 0;
        color: var(--pw-muted);
        font-size: 0.85rem;
      }
      .badge {
        padding: 0.1rem 0.5rem;
        border-radius: 999px;
        border: 1px solid var(--pw-border-strong);
        color: var(--pw-muted);
        font-size: 0.75rem;
      }
      .badge-admin {
        border-color: var(--pw-accent);
        color: var(--pw-accent);
      }
      button {
        padding: 0.5rem 0.8rem;
        border-radius: 8px;
        border: 0;
        background: var(--pw-accent);
        color: var(--pw-on-accent);
        cursor: pointer;
        font: inherit;
      }
      .ghost-neutral {
        background: transparent;
        color: var(--pw-text);
        border: 1px solid var(--pw-border-strong);
      }
      .ghost-danger {
        background: transparent;
        color: var(--pw-danger, #a32d2d);
        border: 1px solid var(--pw-border-strong);
      }
      button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .ok {
        margin: 0;
        color: var(--pw-success, #1f6b3a);
      }
      .error {
        margin: 0;
        color: var(--pw-danger, #a32d2d);
      }
    `,
  ],
})
export class AccessRolesPageComponent {
  private readonly api = inject(AccountRolesApiService);
  private readonly questionnairesApi = inject(QuestionnairesApiService);

  readonly roles = signal<AccountRole[]>([]);
  readonly surfaces = signal<AppSurface[]>([]);
  readonly publishedTemplates = signal<PublishedQuestionnaireTemplate[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly dialogError = signal('');
  readonly editing = signal<AccountRole | null>(null);
  readonly dialogOpen = signal(false);

  private readonly surfaceLabelById = computed(() => {
    const map = new Map<string, string>();
    for (const surface of this.surfaces()) map.set(surface.id, surface.label);
    return map;
  });

  constructor() {
    this.loadSurfaces();
    this.loadPublishedTemplates();
    this.loadRoles();
  }

  presetLabel(role: AccountRole): string {
    return PERMISSION_PRESET_LABELS[role.permissionPreset] ?? role.permissionPreset;
  }

  surfaceLabels(role: AccountRole): string {
    if (role.isAdminEquivalent) return '';
    const labels = this.surfaceLabelById();
    return role.surfaceIds.map((id) => labels.get(id) ?? id).join(', ');
  }

  openCreate(): void {
    this.editing.set(null);
    this.dialogError.set('');
    this.dialogOpen.set(true);
  }

  openEdit(role: AccountRole): void {
    this.editing.set(role);
    this.dialogError.set('');
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
    this.editing.set(null);
    this.dialogError.set('');
  }

  save(body: CreateAccountRoleBody): void {
    const role = this.editing();
    this.dialogError.set('');
    this.saving.set(true);
    const request = role
      ? this.api.updateRole(role.id, body)
      : this.api.createRole(body);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDialog();
        this.message.set(role ? 'Роль оновлено' : 'Роль створено');
        this.error.set('');
        this.loadRoles();
      },
      error: (err) => {
        this.saving.set(false);
        this.dialogError.set(errorText(err, 'Не вдалося зберегти роль'));
      },
    });
  }

  remove(role: AccountRole): void {
    if (!confirm(`Видалити роль «${role.name}»?`)) return;
    this.error.set('');
    this.message.set('');
    this.api.deleteRole(role.id).subscribe({
      next: () => {
        this.message.set('Роль видалено');
        this.loadRoles();
      },
      error: (err) => this.error.set(errorText(err, 'Не вдалося видалити роль')),
    });
  }

  private loadRoles(): void {
    this.loading.set(true);
    this.api.getRoles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(errorText(err, 'Не вдалося завантажити ролі'));
      },
    });
  }

  private loadSurfaces(): void {
    this.api.getSurfaces().subscribe({
      next: (surfaces) => this.surfaces.set(surfaces),
      error: (err) =>
        this.error.set(errorText(err, 'Не вдалося завантажити перелік екранів')),
    });
  }

  private loadPublishedTemplates(): void {
    this.questionnairesApi
      .listTemplates()
      .pipe(
        catchError(() => of({ items: [] as { code: string; title: string }[] })),
      )
      .subscribe({
        next: (response) =>
          this.publishedTemplates.set(
            response.items.map((item) => ({
              code: item.code,
              title: item.title,
            })),
          ),
      });
  }
}

function errorText(
  err: { error?: { message?: string | string[] } },
  fallback: string,
): string {
  const msg = err?.error?.message;
  return Array.isArray(msg) ? msg.join(', ') : msg || fallback;
}
