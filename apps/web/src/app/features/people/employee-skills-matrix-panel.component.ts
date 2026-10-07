import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  inject,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { EmployeeSkillMatrixItem } from '@loom/contracts-employees';
import { resolveMatrixRatingPolicy } from '@loom/questionnaire-schema';
import {
  SettingsOrgApiService,
  type OrgSkill,
} from '../settings/settings-org-api.service';
import { Subscription } from 'rxjs';
import { EmployeeSkillsMatrixApiService } from './employee-skills-matrix-api.service';
import {
  PwSelectComponent,
  type PwSelectOption,
} from '../../shared/ui/pw-select.component';

@Component({
  selector: 'loom-employee-skills-matrix-panel',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, PwSelectComponent],
  template: `
    <section class="panel" data-help-id="people.metrics.skills.matrix">
      <h3>Матриця навичок</h3>
      @if (loading) {
        <p class="muted">Завантаження…</p>
      } @else if (error) {
        <p class="error">{{ error }}</p>
      } @else {
        <section class="block">
          <h4>Профільні (з посади)</h4>
          @if (!profileItems.length) {
            <p class="muted">Немає вимог посади або немає поточної посади.</p>
          } @else {
            <ul>
              @for (row of profileItems; track trackItem(row)) {
                <li>
                  <span class="label">
                    {{ row.skill.name }}
                    @if (requirementHint(row); as hint) {
                      <small>{{ hint }}</small>
                    }
                  </span>
                  @if (canEdit) {
                    <ng-container
                      *ngTemplateOutlet="levelEditor; context: { row: row, removable: false }"
                    />
                  } @else {
                    <span class="level">{{ formatLevel(row) }}</span>
                  }
                </li>
              }
            </ul>
          }
        </section>

        <section class="block">
          <h4>Додаткові</h4>
          @if (!extraItems.length) {
            <p class="muted">Немає додаткових навичок.</p>
          } @else {
            <ul>
              @for (row of extraItems; track trackItem(row)) {
                <li>
                  <span class="label">{{ row.skill.name }}</span>
                  @if (canEdit) {
                    <ng-container
                      *ngTemplateOutlet="levelEditor; context: { row: row, removable: true }"
                    />
                  } @else {
                    <span class="level">{{ formatLevel(row) }}</span>
                  }
                </li>
              }
            </ul>
          }

          @if (canEdit) {
            <div class="add">
              @if (!pickerOpen) {
                <button
                  type="button"
                  class="pw-link-action"
                  data-help-id="people.metrics.skills.add"
                  (click)="openPicker()"
                >
                  Додати навичку
                </button>
              } @else {
                <div class="picker">
                  <loom-pw-select
                    [value]="pickerSkillId"
                    [options]="pickerSkillOptions()"
                    [disabled]="pickerLoading"
                    [placeholder]="pickerLoading ? 'Завантаження…' : '— оберіть —'"
                    (valueChange)="onPickerSkillSelected($event)"
                  />
                  @if (pickerError) {
                    <p class="error">{{ pickerError }}</p>
                  }
                  <div class="picker-actions">
                    <button
                      type="button"
                      class="pw-link-action"
                      [disabled]="!pickerSkillId || saving"
                      (click)="confirmAdd()"
                    >
                      Додати
                    </button>
                    <button type="button" class="pw-link-action" (click)="closePicker()">
                      Скасувати
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </section>
      }

      <ng-template #levelEditor let-row="row" let-removable="removable">
        <div class="level-edit" role="group" [attr.aria-label]="row.skill.name">
          @if (useDigits(row)) {
            <div class="dots">
              @for (lvl of digitLevels(row); track lvl) {
                <button
                  type="button"
                  class="dot"
                  [class.active]="currentLevel(row) === lvl"
                  [disabled]="saving"
                  (click)="setLevel(row, lvl)"
                >
                  {{ lvl }}
                </button>
              }
            </div>
          } @else {
            <label class="num-wrap">
              <input
                type="number"
                class="num"
                [min]="row.skill.scaleMin"
                [max]="row.skill.scaleMax"
                [step]="1"
                [disabled]="saving"
                [ngModel]="currentLevel(row)"
                (ngModelChange)="onLevelInput(row, $event)"
              />
              @if (row.skill.scaleKind === 'percent') {
                <span class="unit">%</span>
              }
            </label>
          }
          @if (currentLevel(row) != null) {
            <button
              type="button"
              class="pw-link-action"
              [disabled]="saving"
              (click)="setLevel(row, null)"
            >
              Без оцінки
            </button>
          }
          @if (removable && row.assessment) {
            <button
              type="button"
              class="pw-link-action danger"
              [disabled]="saving"
              (click)="removeExtra(row)"
            >
              Видалити
            </button>
          }
        </div>
      </ng-template>
    </section>
  `,
  styles: [
    `
      .panel {
        display: grid;
        gap: 1rem;
      }
      h3 {
        margin: 0;
        font-size: 1.05rem;
      }
      h4 {
        margin: 0 0 0.5rem;
        font-size: 0.95rem;
      }
      .block {
        display: grid;
        gap: 0.5rem;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.5rem;
      }
      li {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: center;
        padding: 0.5rem 0.75rem;
        border-radius: 8px;
        border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
      }
      .label {
        display: grid;
        gap: 0.15rem;
      }
      .label small {
        font-size: 0.8rem;
        opacity: 0.8;
      }
      .level-edit {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
        justify-content: flex-end;
      }
      .dots {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
      }
      .dot {
        min-width: 2rem;
        height: 2rem;
        border-radius: 0.35rem;
        border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
        background: transparent;
        color: inherit;
        cursor: pointer;
        font: inherit;
      }
      .dot.active {
        background: color-mix(in srgb, currentColor 18%, transparent);
        font-weight: 600;
      }
      .num-wrap {
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
      }
      .num {
        width: 4.5rem;
        min-height: 2rem;
        padding: 0.25rem 0.4rem;
        border-radius: 0.35rem;
        border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
        background: var(--pw-input-bg, transparent);
        color: inherit;
        font: inherit;
      }
      .unit {
        font-size: 0.9rem;
        opacity: 0.85;
      }
      .pw-link-action.danger {
        color: var(--pw-danger, #b42318);
      }
      .muted {
        opacity: 0.75;
        margin: 0;
      }
      .error {
        color: var(--pw-danger, #b42318);
        margin: 0;
      }
      .picker {
        display: grid;
        gap: 0.5rem;
        max-width: 28rem;
      }
      .picker-actions {
        display: flex;
        gap: 0.75rem;
      }
    `,
  ],
})
export class EmployeeSkillsMatrixPanelComponent implements OnChanges, OnDestroy {
  private readonly matrixApi = inject(EmployeeSkillsMatrixApiService);
  private readonly skillsApi = inject(SettingsOrgApiService);

  @Input({ required: true }) employeeId!: string;

  loading = false;
  saving = false;
  error: string | null = null;
  canEdit = false;
  profileItems: EmployeeSkillMatrixItem[] = [];
  extraItems: EmployeeSkillMatrixItem[] = [];

  pickerOpen = false;
  pickerLoading = false;
  pickerError: string | null = null;
  pickerSkillId = '';
  pickerSkills: OrgSkill[] = [];
  private pickerSub: Subscription | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['employeeId'] && this.employeeId) {
      this.load();
    }
  }

  ngOnDestroy(): void {
    this.pickerSub?.unsubscribe();
  }

  trackItem(row: EmployeeSkillMatrixItem): string {
    return row.assessment?.id ?? row.skill.id;
  }

  currentLevel(row: EmployeeSkillMatrixItem): number | null {
    return row.assessment?.level ?? null;
  }

  formatLevel(row: EmployeeSkillMatrixItem): string {
    const level = this.currentLevel(row);
    if (level == null) return 'Без оцінки';
    const policy = resolveMatrixRatingPolicy(2, {
      scaleKind: row.skill.scaleKind,
      scaleMin: row.skill.scaleMin,
      scaleMax: row.skill.scaleMax,
    });
    return policy.unit === '%'
      ? `${level}%`
      : `${level} / ${policy.max}`;
  }

  requirementHint(row: EmployeeSkillMatrixItem): string | null {
    const target = row.requirement?.targetLevel;
    if (target == null) return null;
    if (row.skill.scaleKind === 'percent') {
      return `Вимога посади: ${target}%`;
    }
    return `Вимога посади: ${target} / ${row.skill.scaleMax}`;
  }

  useDigits(row: EmployeeSkillMatrixItem): boolean {
    return row.skill.scaleMax - row.skill.scaleMin <= 10;
  }

  digitLevels(row: EmployeeSkillMatrixItem): number[] {
    const min = row.skill.scaleMin;
    const max = row.skill.scaleMax;
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }

  onLevelInput(row: EmployeeSkillMatrixItem, raw: unknown): void {
    if (this.saving) return;
    if (raw === '' || raw === null || raw === undefined) {
      this.setLevel(row, null);
      return;
    }
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) return;
    const level = Math.round(n);
    if (level < row.skill.scaleMin || level > row.skill.scaleMax) return;
    if (level === this.currentLevel(row)) return;
    this.setLevel(row, level);
  }

  setLevel(row: EmployeeSkillMatrixItem, level: number | null): void {
    if (this.saving) return;
    if (level === this.currentLevel(row) && row.assessment) return;
    // First rating on an unrated profile skill with null is a no-op.
    if (level == null && !row.assessment) return;

    this.saving = true;
    this.error = null;
    this.matrixApi
      .upsertLevel(this.employeeId, { skillId: row.skill.id, level })
      .subscribe({
        next: (updated) => {
          this.saving = false;
          this.replaceItem(row, updated);
        },
        error: () => {
          this.saving = false;
          this.error = 'Не вдалося оновити рівень';
          this.load();
        },
      });
  }

  removeExtra(row: EmployeeSkillMatrixItem): void {
    if (!row.assessment || this.saving) return;
    if (!window.confirm(`Видалити навичку «${row.skill.name}»?`)) return;
    this.saving = true;
    this.error = null;
    this.matrixApi.deleteExtra(this.employeeId, row.assessment.id).subscribe({
      next: () => {
        this.saving = false;
        this.load();
      },
      error: () => {
        this.saving = false;
        this.error = 'Не вдалося видалити навичку';
      },
    });
  }

  pickerSkillOptions(): PwSelectOption[] {
    return this.pickerSkills.map((skill) => ({
      value: skill.id,
      label: skill.group?.name ? `${skill.name} · ${skill.group.name}` : skill.name,
    }));
  }

  onPickerSkillSelected(value: string): void {
    this.pickerSkillId = value;
  }

  openPicker(): void {
    this.pickerOpen = true;
    this.pickerSkillId = '';
    this.pickerError = null;
    this.pickerLoading = true;
    this.pickerSub?.unsubscribe();
    this.pickerSub = this.skillsApi.getSkills(false).subscribe({
      next: (skills) => {
        const present = new Set([
          ...this.profileItems.map((r) => r.skill.id),
          ...this.extraItems.map((r) => r.skill.id),
        ]);
        this.pickerSkills = skills
          .filter((s) => s.isActive && !present.has(s.id))
          .sort((a, b) => a.name.localeCompare(b.name, 'uk'));
        this.pickerLoading = false;
      },
      error: () => {
        this.pickerLoading = false;
        this.pickerError = 'Не вдалося завантажити навички';
      },
    });
  }

  closePicker(): void {
    this.pickerOpen = false;
    this.pickerSkillId = '';
    this.pickerError = null;
    this.pickerSub?.unsubscribe();
    this.pickerSub = null;
    this.pickerLoading = false;
  }

  confirmAdd(): void {
    if (!this.pickerSkillId || this.saving) return;
    this.saving = true;
    this.pickerError = null;
    this.matrixApi
      .createExtra(this.employeeId, {
        skillId: this.pickerSkillId,
        level: null,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.closePicker();
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.pickerError =
            err?.error?.message ?? 'Не вдалося додати навичку';
        },
      });
  }

  private replaceItem(
    previous: EmployeeSkillMatrixItem,
    updated: EmployeeSkillMatrixItem,
  ): void {
    const matchSkill = (row: EmployeeSkillMatrixItem) =>
      row.skill.id === previous.skill.id;
    if (updated.requirement != null) {
      this.profileItems = this.profileItems.map((row) =>
        matchSkill(row) ? updated : row,
      );
    } else {
      this.extraItems = this.extraItems.map((row) =>
        matchSkill(row) ? updated : row,
      );
    }
  }

  private load(): void {
    this.loading = true;
    this.error = null;
    this.matrixApi.list(this.employeeId).subscribe({
      next: (res) => {
        this.profileItems = res.profileItems ?? [];
        this.extraItems = res.extraItems ?? [];
        this.canEdit = res.capabilities?.canEdit === true;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Не вдалося завантажити матрицю навичок';
      },
    });
  }
}
