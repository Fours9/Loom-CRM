import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  EmployeeAboutFieldView,
  EmployeeAboutResponse,
  EmployeeAboutSubtabView,
  PeopleAboutSubtabId,
} from '@loom/contracts-employees';
import { Subscription } from 'rxjs';
import { EmployeeAboutApiService } from './employee-about-api.service';
import {
  resolvePeopleAboutSubtab,
  visiblePeopleAboutSubtabs,
} from './people-about-subtabs';

@Component({
  selector: 'loom-employee-about-panel',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="about" aria-label="Про себе">
      <p class="lead">
        Мʼякий контекст про працівника (хобі, сімʼя, стиль роботи) — окремо від
        кадрових «Даних працівника».
      </p>

      @if (loading) {
        <p class="muted">Завантаження…</p>
      } @else if (error) {
        <p class="error">{{ error }}</p>
      } @else if (data) {
        <nav class="tabs subtabs" role="tablist" aria-label="Про себе — розділи">
          @for (tab of data.subtabs; track tab.id) {
            <button
              type="button"
              class="tab"
              role="tab"
              [attr.aria-selected]="activeSubtab === tab.id"
              [class.active]="activeSubtab === tab.id"
              (mousedown)="$event.preventDefault()"
              (click)="selectSubtab(tab.id)"
            >
              {{ tab.labelUa }}
            </button>
          }
        </nav>

        @if (activeView; as view) {
          <div class="fields">
            @for (field of view.fields; track field.key) {
              <div class="field">
                <label [attr.for]="field.key">{{ field.labelUa }}</label>
                @if (canEdit) {
                  @switch (field.valueType) {
                    @case ('single_choice') {
                      <select
                        [id]="field.key"
                        [(ngModel)]="draft[field.key]"
                      >
                        <option [ngValue]="null">— не вказано —</option>
                        @for (opt of field.options ?? []; track opt.value) {
                          <option [ngValue]="opt.value">{{ opt.labelUa }}</option>
                        }
                      </select>
                    }
                    @case ('multi_choice') {
                      <div class="checks">
                        @for (opt of field.options ?? []; track opt.value) {
                          <label class="check">
                            <input
                              type="checkbox"
                              [checked]="isMultiChecked(field.key, opt.value)"
                              (change)="
                                toggleMulti(field.key, opt.value, $event)
                              "
                            />
                            {{ opt.labelUa }}
                          </label>
                        }
                      </div>
                    }
                    @case ('textarea') {
                      <textarea
                        [id]="field.key"
                        rows="3"
                        [(ngModel)]="draft[field.key]"
                      ></textarea>
                    }
                    @case ('date') {
                      <input
                        [id]="field.key"
                        type="date"
                        [(ngModel)]="draft[field.key]"
                      />
                    }
                    @case ('repeating_group') {
                      <p class="muted display">
                        {{ field.displayValue || 'не вказано' }}
                      </p>
                      <p class="hint">
                        Редагування списків — через анкету або наступний slice UI.
                      </p>
                    }
                    @default {
                      <input
                        [id]="field.key"
                        type="text"
                        [(ngModel)]="draft[field.key]"
                      />
                    }
                  }
                } @else {
                  <p class="display">
                    {{ field.displayValue || 'не вказано' }}
                  </p>
                }
              </div>
            }

            @if (canEdit) {
              <div class="actions">
                <button
                  type="button"
                  class="primary"
                  [disabled]="saving"
                  (click)="save()"
                >
                  {{ saving ? 'Збереження…' : 'Зберегти' }}
                </button>
                @if (saveError) {
                  <p class="error">{{ saveError }}</p>
                }
              </div>
            }
          </div>
        }
      }
    </section>
  `,
  styles: [
    `
      .about {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 0.25rem 0 1rem;
      }
      .lead {
        margin: 0;
        max-width: 42rem;
        line-height: 1.45;
      }
      .muted,
      .hint {
        margin: 0;
        color: var(--loom-muted, #667085);
        max-width: 42rem;
        line-height: 1.45;
      }
      .hint {
        font-size: 0.85rem;
      }
      .error {
        margin: 0;
        color: var(--loom-danger, #b42318);
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
        color: var(--pw-text);
      }
      .tab.active {
        border-color: var(--pw-accent);
        color: var(--pw-accent);
      }
      .subtabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
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
      .fields {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        max-width: 36rem;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .field label {
        font-weight: 600;
      }
      .display {
        margin: 0;
        line-height: 1.4;
      }
      .checks {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .check {
        font-weight: 400;
        display: flex;
        gap: 0.4rem;
        align-items: center;
      }
      textarea,
      input[type='text'],
      input[type='date'],
      select {
        width: 100%;
        box-sizing: border-box;
      }
      .actions {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        align-items: flex-start;
      }
    `,
  ],
})
export class EmployeeAboutPanelComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) employeeId!: string;

  private readonly api = inject(EmployeeAboutApiService);
  private sub: Subscription | null = null;

  loading = false;
  saving = false;
  error: string | null = null;
  saveError: string | null = null;
  data: EmployeeAboutResponse | null = null;
  activeSubtab: PeopleAboutSubtabId | null = null;
  draft: Record<string, unknown> = {};

  get canEdit(): boolean {
    return Boolean(this.data?.canEdit);
  }

  get activeView(): EmployeeAboutSubtabView | null {
    if (!this.data || !this.activeSubtab) return null;
    return this.data.subtabs.find((s) => s.id === this.activeSubtab) ?? null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['employeeId'] && this.employeeId) {
      this.load();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  selectSubtab(id: PeopleAboutSubtabId): void {
    this.activeSubtab = id;
    this.hydrateDraft();
    this.saveError = null;
  }

  isMultiChecked(key: string, value: string): boolean {
    const cur = this.draft[key];
    return Array.isArray(cur) && cur.includes(value);
  }

  toggleMulti(key: string, value: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const cur = Array.isArray(this.draft[key])
      ? [...(this.draft[key] as string[])]
      : [];
    if (checked) {
      if (!cur.includes(value)) cur.push(value);
    } else {
      const i = cur.indexOf(value);
      if (i >= 0) cur.splice(i, 1);
    }
    this.draft[key] = cur;
  }

  save(): void {
    if (!this.activeSubtab || !this.data) return;
    const view = this.activeView;
    if (!view) return;

    const values: Record<string, unknown> = {};
    for (const field of view.fields) {
      if (field.valueType === 'repeating_group') continue;
      const next = this.draft[field.key];
      const prev = field.raw;
      if (this.valuesEqual(next, prev)) continue;
      if (next === '' || next === undefined) {
        values[field.key] = null;
      } else {
        values[field.key] = next;
      }
    }

    if (!Object.keys(values).length) return;

    this.saving = true;
    this.saveError = null;
    this.sub?.unsubscribe();
    this.sub = this.api
      .patch(this.employeeId, {
        subtabId: this.activeSubtab,
        values,
      })
      .subscribe({
        next: (res) => {
          this.data = res;
          this.hydrateDraft();
          this.saving = false;
        },
        error: () => {
          this.saveError = 'Не вдалося зберегти';
          this.saving = false;
        },
      });
  }

  private load(): void {
    this.loading = true;
    this.error = null;
    this.sub?.unsubscribe();
    this.sub = this.api.get(this.employeeId).subscribe({
      next: (res) => {
        this.data = res;
        const visible = visiblePeopleAboutSubtabs();
        this.activeSubtab = resolvePeopleAboutSubtab(
          this.activeSubtab ?? visible[0]?.id ?? '',
          visible,
        );
        this.hydrateDraft();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.data = null;
        this.error =
          err?.status === 403
            ? 'Немає доступу до вкладки «Про себе»'
            : 'Не вдалося завантажити';
      },
    });
  }

  private hydrateDraft(): void {
    const view = this.activeView;
    const next: Record<string, unknown> = {};
    if (view) {
      for (const field of view.fields) {
        next[field.key] = this.cloneRaw(field);
      }
    }
    this.draft = next;
  }

  private cloneRaw(field: EmployeeAboutFieldView): unknown {
    if (field.raw == null) {
      if (field.valueType === 'multi_choice') return [];
      return null;
    }
    if (Array.isArray(field.raw)) return [...field.raw];
    return field.raw;
  }

  private valuesEqual(a: unknown, b: unknown): boolean {
    if (a == null && (b == null || b === '')) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    return a === b;
  }
}
