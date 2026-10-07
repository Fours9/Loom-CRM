import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  inject,
  output,
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
import { EmployeeAboutRepeatingFieldComponent } from './employee-about-repeating-field.component';
import { PwDateInputComponent } from '../../shared/ui/pw-date-input.component';
import {
  PwSelectComponent,
  type PwSelectOption,
} from '../../shared/ui/pw-select.component';
import {
  resolvePeopleAboutSubtab,
  visiblePeopleAboutSubtabs,
} from './people-about-subtabs';

@Component({
  selector: 'loom-employee-about-panel',
  standalone: true,
  imports: [
    FormsModule,
    EmployeeAboutRepeatingFieldComponent,
    PwSelectComponent,
    PwDateInputComponent,
  ],
  template: `
    <section class="about" aria-label="Про себе" data-help-id="people.about.region">
      <p class="lead">
        Мʼякий контекст про працівника (хобі, сімʼя, стиль роботи) — окремо від
        кадрових «Даних працівника». Sync з анкет не замінює цю вкладку.
      </p>

      @if (loading) {
        <p class="muted">Завантаження…</p>
      } @else if (error) {
        <p class="error">{{ error }}</p>
      } @else if (data) {
        <nav
          class="tabs subtabs"
          role="tablist"
          aria-label="Про себе — розділи"
          data-help-id="people.about.subtabs"
        >
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
          <div class="section-head">
            <h2>{{ view.labelUa }}</h2>
            @if (canEdit) {
              <div class="section-actions">
                <button
                  type="button"
                  class="btn pw-btn"
                  data-help-id="people.about.save"
                  [disabled]="saving"
                  (click)="save()"
                >
                  {{ saving ? 'Збереження…' : 'Зберегти' }}
                </button>
              </div>
            }
          </div>
          @if (activePurposeUa) {
            <p class="muted purpose">{{ activePurposeUa }}</p>
          }
          @if (saveError) {
            <p class="error">{{ saveError }}</p>
          }

          <div class="fields">
            @for (field of view.fields; track field.key) {
              <div class="field">
                <label [attr.for]="field.key">{{ field.labelUa }}</label>
                @if (field.valueType === 'repeating_group') {
                  <loom-employee-about-repeating-field
                    [field]="field"
                    [editable]="canEdit"
                    [value]="draft[field.key]"
                    (valueChange)="onRepeatingChange(field.key, $event)"
                  />
                } @else if (canEdit) {
                  @switch (field.valueType) {
                    @case ('single_choice') {
                      <loom-pw-select
                        [value]="singleChoiceValue(field)"
                        [options]="singleChoiceOptions(field)"
                        placeholder="— не вказано —"
                        (valueChange)="onSingleChoiceSelected(field.key, $event)"
                      />
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
                      <loom-pw-date-input
                        [value]="asDateString(draft[field.key])"
                        (valueChange)="onDateSelected(field.key, $event)"
                      />
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
      .hint,
      .purpose {
        margin: 0;
        color: var(--pw-muted, #667085);
        max-width: 42rem;
        line-height: 1.45;
      }
      .purpose {
        margin-top: -0.35rem;
        margin-bottom: 0.15rem;
        font-size: 0.9rem;
      }
      .hint {
        font-size: 0.85rem;
      }
      .error {
        margin: 0;
        color: var(--pw-danger, #b42318);
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
      .section-head {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
        margin-bottom: 1.15rem;
      }
      .section-head h2 {
        margin: 0;
      }
      .section-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      }
      .fields {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        max-width: 36rem;
        overflow: visible;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        overflow: visible;
      }
      .field > label {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--pw-muted, #667085);
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
        color: var(--pw-text);
        display: flex;
        gap: 0.4rem;
        align-items: center;
      }
      textarea,
      input[type='text'] {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid var(--pw-border);
        border-radius: 8px;
        padding: 0.5rem 0.65rem;
        min-height: 2.5rem;
        background: var(--pw-surface);
        color: inherit;
        font: inherit;
      }
      textarea {
        min-height: 4rem;
        resize: vertical;
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

  readonly subtabChange = output<PeopleAboutSubtabId | null>();

  get canEdit(): boolean {
    return Boolean(this.data?.canEdit);
  }

  get activeView(): EmployeeAboutSubtabView | null {
    if (!this.data || !this.activeSubtab) return null;
    return this.data.subtabs.find((s) => s.id === this.activeSubtab) ?? null;
  }

  /** Catalog purpose for the active subtab (FE adapter SoT — not on API view). */
  get activePurposeUa(): string | null {
    if (!this.activeSubtab) return null;
    const meta = visiblePeopleAboutSubtabs().find((t) => t.id === this.activeSubtab);
    const purpose = meta?.purposeUa?.trim();
    return purpose || null;
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
    this.setActiveSubtab(id);
    this.hydrateDraft();
    this.saveError = null;
  }

  private setActiveSubtab(
    next: PeopleAboutSubtabId | null,
    opts?: { forceEmit?: boolean },
  ): void {
    if (this.activeSubtab === next && !opts?.forceEmit) return;
    this.activeSubtab = next;
    this.subtabChange.emit(next);
  }

  singleChoiceOptions(field: EmployeeAboutFieldView): PwSelectOption[] {
    return (field.options ?? []).map((opt) => ({
      value: opt.value,
      label: opt.labelUa,
    }));
  }

  singleChoiceValue(field: EmployeeAboutFieldView): string {
    const current = this.draft[field.key];
    return typeof current === 'string' ? current : '';
  }

  onSingleChoiceSelected(key: string, value: string): void {
    this.draft[key] = value === '' ? null : value;
  }

  asDateString(value: unknown): string {
    return value == null || value === '' ? '' : String(value);
  }

  onDateSelected(key: string, value: string): void {
    this.draft[key] = value === '' ? null : value;
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

  onRepeatingChange(key: string, value: unknown): void {
    this.draft[key] = value;
  }

  save(): void {
    if (!this.activeSubtab || !this.data) return;
    const view = this.activeView;
    if (!view) return;

    const values: Record<string, unknown> = {};
    for (const field of view.fields) {
      const next = this.draft[field.key];
      const prev = field.raw;
      if (this.valuesEqual(next, prev)) continue;
      if (field.valueType === 'repeating_group') {
        if (!Array.isArray(next) || next.length === 0) {
          values[field.key] = null;
        } else {
          values[field.key] = next;
        }
        continue;
      }
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
        const next = resolvePeopleAboutSubtab(
          this.activeSubtab ?? visible[0]?.id ?? '',
          visible,
        );
        this.setActiveSubtab(next, { forceEmit: true });
        this.hydrateDraft();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.data = null;
        this.setActiveSubtab(null, { forceEmit: true });
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
      if (field.valueType === 'repeating_group') return [];
      return null;
    }
    if (Array.isArray(field.raw)) {
      return field.raw.map((row) =>
        row && typeof row === 'object' && !Array.isArray(row)
          ? { ...(row as Record<string, unknown>) }
          : row,
      );
    }
    return field.raw;
  }

  private valuesEqual(a: unknown, b: unknown): boolean {
    if (a == null && (b == null || b === '')) return true;
    if (Array.isArray(a) && (b == null || (Array.isArray(b) && b.length === 0))) {
      return a.length === 0;
    }
    if ((a == null || (Array.isArray(a) && a.length === 0)) && Array.isArray(b)) {
      return b.length === 0;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    return a === b;
  }
}
