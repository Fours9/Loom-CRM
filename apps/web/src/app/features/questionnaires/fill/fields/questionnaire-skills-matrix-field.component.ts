import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SKILL_DEFINITIONS,
  SKILL_GROUP_CODES,
  SKILL_GROUP_LABELS_UA,
  SKILL_LEVEL_MAX,
  SKILL_LEVEL_MIN,
} from '@loom/position-skill-catalog';
import {
  emptyPositionSkillsMatrix,
  parsePositionSkillsMatrixStrict,
  pruneUnratedMatrixRatings,
  resolveMatrixRatingPolicy,
  type MatrixRatingPolicy,
  type PositionSkillsMatrixAnswer,
} from '@loom/questionnaire-schema';
import {
  SettingsOrgApiService,
  type OrgSkill,
} from '../../../settings/settings-org-api.service';
import { Subscription } from 'rxjs';

/** Fill presentation row. Frozen context is used literally; null input → registry. */
export type MatrixAvailableSkill = {
  code: string;
  labelUa: string;
  group: string;
  skillId?: string;
  targetLevel?: number | null;
  scaleKind?: 'range' | 'percent';
  scaleMin?: number;
  scaleMax?: number;
  source?: 'position_requirement' | 'questionnaire_extra';
};

type GroupView = {
  code: string;
  label: string;
  skills: MatrixAvailableSkill[];
};

type LocalExtraMeta = {
  labelUa: string;
  group: string;
  skillId?: string;
  scaleKind?: 'range' | 'percent';
  scaleMin?: number;
  scaleMax?: number;
};

type RatingUiMode = 'percent' | 'digits' | 'slider';

@Component({
  selector: 'loom-questionnaire-skills-matrix-field',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="matrix" [class.disabled]="disabled">
      <p class="hint">Оцініть навички за шкалою навички.</p>
      @if (groups.length === 0 && availableSkills !== null) {
        <p class="empty">Немає навичок у знімку посади.</p>
      }
      @for (group of groups; track group.code) {
        <section class="group">
          <h3>{{ group.label }}</h3>
          <ul>
            @for (skill of group.skills; track skill.code) {
              <li>
                <span class="label">
                  {{ skill.labelUa }}
                  @if (nativeHint(skill); as hint) {
                    <small>{{ hint }}</small>
                  }
                </span>
                @switch (ratingUi(skill)) {
                  @case ('percent') {
                    <div class="scale-controls" role="group" [attr.aria-label]="skill.labelUa">
                      <input
                        type="range"
                        class="range"
                        [min]="policyFor(skill).min"
                        [max]="policyFor(skill).max"
                        [step]="1"
                        [disabled]="disabled"
                        [ngModel]="levelFor(skill.code)"
                        (ngModelChange)="setLevelFromNumber(skill.code, $event)"
                      />
                      <label class="num-wrap">
                        <input
                          type="number"
                          class="num"
                          [min]="policyFor(skill).min"
                          [max]="policyFor(skill).max"
                          [step]="1"
                          [disabled]="disabled"
                          [ngModel]="levelFor(skill.code)"
                          (ngModelChange)="setLevelFromNumber(skill.code, $event)"
                        />
                        <span class="unit">%</span>
                      </label>
                      @if (levelFor(skill.code) != null) {
                        <button
                          type="button"
                          class="clear"
                          [disabled]="disabled"
                          (click)="clearLevel(skill.code)"
                        >
                          ✕
                        </button>
                      }
                    </div>
                  }
                  @case ('slider') {
                    <div class="scale-controls" role="group" [attr.aria-label]="skill.labelUa">
                      <input
                        type="range"
                        class="range"
                        [min]="policyFor(skill).min"
                        [max]="policyFor(skill).max"
                        [step]="1"
                        [disabled]="disabled"
                        [ngModel]="levelFor(skill.code)"
                        (ngModelChange)="setLevelFromNumber(skill.code, $event)"
                      />
                      <input
                        type="number"
                        class="num"
                        [min]="policyFor(skill).min"
                        [max]="policyFor(skill).max"
                        [step]="1"
                        [disabled]="disabled"
                        [ngModel]="levelFor(skill.code)"
                        (ngModelChange)="setLevelFromNumber(skill.code, $event)"
                      />
                      @if (levelFor(skill.code) != null) {
                        <button
                          type="button"
                          class="clear"
                          [disabled]="disabled"
                          (click)="clearLevel(skill.code)"
                        >
                          ✕
                        </button>
                      }
                    </div>
                  }
                  @default {
                    <div class="dots" role="group" [attr.aria-label]="skill.labelUa">
                      @for (lvl of digitLevels(skill); track lvl) {
                        <button
                          type="button"
                          class="dot"
                          [class.active]="levelFor(skill.code) === lvl"
                          [disabled]="disabled"
                          (click)="setLevel(skill.code, lvl)"
                        >
                          {{ lvl }}
                        </button>
                      }
                      @if (levelFor(skill.code) != null) {
                        <button
                          type="button"
                          class="clear"
                          [disabled]="disabled"
                          (click)="clearLevel(skill.code)"
                        >
                          ✕
                        </button>
                      }
                    </div>
                  }
                }
                @if (isExtraSkill(skill.code)) {
                  <button
                    type="button"
                    class="clear"
                    [disabled]="disabled"
                    (click)="removeExtra(skill.code)"
                  >
                    Видалити
                  </button>
                }
              </li>
            }
          </ul>
        </section>
      }

      @if (matrix.custom.length) {
        <section class="custom">
          <h3>Додаткові (застарілі)</h3>
          @for (row of matrix.custom; track $index; let i = $index) {
            <div class="custom-row">
              <span class="label">{{ row.name || '—' }}</span>
              <div class="dots">
                @for (lvl of customLevels; track lvl) {
                  <button
                    type="button"
                    class="dot"
                    [class.active]="row.level === lvl"
                    [disabled]="disabled"
                    (click)="setCustomLevel(i, lvl)"
                  >
                    {{ lvl }}
                  </button>
                }
              </div>
              <button
                type="button"
                class="clear"
                [disabled]="disabled"
                (click)="removeCustom(i)"
              >
                Видалити
              </button>
            </div>
          }
        </section>
      }

      <section class="add-skill">
        @if (!pickerOpen) {
          <button
            type="button"
            class="add"
            [disabled]="disabled"
            (click)="openPicker()"
          >
            Додати навичку
          </button>
        } @else {
          <div class="picker">
            <label>
              Навичка
              <select
                [disabled]="disabled || pickerLoading"
                [(ngModel)]="pickerSkillCode"
              >
                <option value="">
                  {{ pickerLoading ? 'Завантаження…' : '— оберіть —' }}
                </option>
                @for (skill of pickerSkills; track skill.code) {
                  <option [value]="skill.code">
                    {{ skill.name
                    }}{{ skill.group?.name ? ' · ' + skill.group?.name : '' }}
                  </option>
                }
              </select>
            </label>
            @if (pickerError) {
              <p class="picker-error">{{ pickerError }}</p>
            }
            <div class="picker-actions">
              <button
                type="button"
                class="add"
                [disabled]="disabled || !pickerSkillCode"
                (click)="confirmAddSkill()"
              >
                Додати
              </button>
              <button
                type="button"
                class="clear"
                [disabled]="disabled"
                (click)="closePicker()"
              >
                Скасувати
              </button>
            </div>
          </div>
        }
      </section>
    </div>
  `,
  styles: [
    `
      .matrix {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .hint,
      .empty {
        margin: 0;
        opacity: 0.75;
        font-size: 0.9rem;
      }
      .label {
        display: grid;
        gap: 0.15rem;
      }
      .label small {
        font-size: 0.8rem;
        opacity: 0.8;
      }
      .group h3,
      .custom h3 {
        margin: 0 0 0.5rem;
        font-size: 1rem;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      li,
      .custom-row {
        display: grid;
        grid-template-columns: minmax(8rem, 1fr) auto auto;
        gap: 0.5rem;
        align-items: center;
      }
      .dots,
      .scale-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        align-items: center;
      }
      .dot {
        min-width: 2rem;
        height: 2rem;
        border-radius: 0.35rem;
        border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
        background: transparent;
        cursor: pointer;
      }
      .dot.active {
        background: color-mix(in srgb, currentColor 18%, transparent);
        font-weight: 600;
      }
      .range {
        width: min(10rem, 40vw);
        accent-color: var(--pw-accent, currentColor);
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
        background: transparent;
        color: inherit;
        font: inherit;
      }
      .unit {
        font-size: 0.9rem;
        opacity: 0.85;
      }
      .clear,
      .add {
        border: none;
        background: transparent;
        text-decoration: underline;
        cursor: pointer;
        font: inherit;
      }
      .disabled {
        opacity: 0.7;
        pointer-events: none;
      }
      .picker {
        display: grid;
        gap: 0.5rem;
        max-width: 28rem;
      }
      .picker label {
        display: grid;
        gap: 0.25rem;
        font-weight: 600;
      }
      .picker select {
        width: 100%;
        min-height: 44px;
        padding: 0.45rem 0.55rem;
        border-radius: 8px;
        border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
        background: transparent;
        color: inherit;
      }
      .picker-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: center;
      }
      .picker-error {
        margin: 0;
        color: #b42318;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class QuestionnaireSkillsMatrixFieldComponent
  implements OnChanges, OnDestroy
{
  private readonly skillsApi = inject(SettingsOrgApiService);

  @Input() value: unknown;
  @Input() disabled = false;
  /**
   * `null` → legacy registry.
   * Array (including `[]`) → literal frozen rows; do not fall back to registry.
   */
  @Input() availableSkills: MatrixAvailableSkill[] | null = null;
  @Input() contextVersion: 1 | 2 | null = null;
  @Input() desiredExtraCodes: string[] = [];
  @Output() matrixChange = new EventEmitter<PositionSkillsMatrixAnswer>();
  @Output() desiredExtraCodesChange = new EventEmitter<string[]>();

  readonly customLevels = Array.from(
    { length: SKILL_LEVEL_MAX - SKILL_LEVEL_MIN + 1 },
    (_, i) => SKILL_LEVEL_MIN + i,
  );

  groups: GroupView[] = this.buildGroups(null);

  matrix: PositionSkillsMatrixAnswer = emptyPositionSkillsMatrix();

  pickerOpen = false;
  pickerLoading = false;
  pickerError: string | null = null;
  pickerSkillCode = '';
  pickerSkills: OrgSkill[] = [];

  private pickerSub: Subscription | null = null;
  /** Codes present in availableSkills / registry rows (not free-text extras). */
  private rowCodes = new Set<string>();
  /** Labels / scale from picker for pending extras not yet in context. */
  private readonly localExtraMeta = new Map<string, LocalExtraMeta>();

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['availableSkills'] ||
      changes['desiredExtraCodes'] ||
      changes['contextVersion']
    ) {
      this.groups = this.buildGroups(this.availableSkills);
    }
    if (changes['value']) {
      try {
        this.matrix = parsePositionSkillsMatrixStrict(this.value);
      } catch {
        this.matrix = emptyPositionSkillsMatrix();
      }
      this.groups = this.buildGroups(this.availableSkills);
    }
  }

  ngOnDestroy(): void {
    this.pickerSub?.unsubscribe();
  }

  nativeHint(skill: MatrixAvailableSkill): string | null {
    if (skill.targetLevel == null) return null;
    if (skill.scaleKind === 'percent') {
      return `Вимога посади: ${skill.targetLevel}%`;
    }
    if (skill.scaleMax != null) {
      return `Вимога посади: ${skill.targetLevel} / ${skill.scaleMax}`;
    }
    return `Вимога посади: ${skill.targetLevel}`;
  }

  policyFor(skill: MatrixAvailableSkill): MatrixRatingPolicy {
    return resolveMatrixRatingPolicy(this.contextVersion, skill);
  }

  ratingUi(skill: MatrixAvailableSkill): RatingUiMode {
    const policy = this.policyFor(skill);
    if (policy.kind === 'percent') return 'percent';
    if (policy.max - policy.min <= 10) return 'digits';
    return 'slider';
  }

  digitLevels(skill: MatrixAvailableSkill): number[] {
    const policy = this.policyFor(skill);
    return Array.from(
      { length: policy.max - policy.min + 1 },
      (_, i) => policy.min + i,
    );
  }

  isExtraSkill(code: string): boolean {
    if (this.desiredExtraCodes.includes(code)) return true;
    if (this.localExtraMeta.has(code)) return true;
    const fromContext = this.availableSkills?.find((s) => s.code === code);
    return fromContext?.source === 'questionnaire_extra';
  }

  private buildGroups(
    available: MatrixAvailableSkill[] | null,
    desiredExtraCodes: string[] = this.desiredExtraCodes,
  ): GroupView[] {
    const baseRows =
      available === null
        ? SKILL_DEFINITIONS.map((s) => ({
            code: s.code,
            labelUa: s.labelUa,
            group: s.group,
          }))
        : available;
    this.rowCodes = new Set(baseRows.map((s) => s.code));

    const pendingExtras: MatrixAvailableSkill[] = [];
    if (available !== null) {
      for (const code of desiredExtraCodes) {
        if (!code || this.rowCodes.has(code)) continue;
        if (pendingExtras.some((s) => s.code === code)) continue;
        const cached = this.localExtraMeta.get(code);
        const fromPicker = this.pickerSkills.find((s) => s.code === code);
        pendingExtras.push({
          code,
          labelUa: cached?.labelUa ?? fromPicker?.name ?? code,
          group: cached?.group ?? fromPicker?.group?.code ?? '__extra__',
          skillId: cached?.skillId ?? fromPicker?.id,
          scaleKind: cached?.scaleKind ?? fromPicker?.scaleKind,
          scaleMin: cached?.scaleMin ?? fromPicker?.scaleMin,
          scaleMax: cached?.scaleMax ?? fromPicker?.scaleMax,
          source: 'questionnaire_extra',
        });
      }
    }

    const rows = [...baseRows, ...pendingExtras];
    if (rows.length === 0) return [];

    const byGroup = new Map<string, MatrixAvailableSkill[]>();
    for (const skill of rows) {
      const key = skill.group?.trim() ? skill.group : '__other__';
      const list = byGroup.get(key) ?? [];
      list.push(skill);
      byGroup.set(key, list);
    }

    const orderedKeys = [
      ...SKILL_GROUP_CODES.filter((code) => byGroup.has(code)),
      ...[...byGroup.keys()]
        .filter((code) => !SKILL_GROUP_CODES.includes(code as (typeof SKILL_GROUP_CODES)[number]))
        .sort((a, b) => a.localeCompare(b)),
    ];

    return orderedKeys.map((code) => ({
      code,
      label: this.groupLabel(code),
      skills: byGroup.get(code) ?? [],
    }));
  }

  private groupLabel(code: string): string {
    if (code === '__other__') return 'Без групи';
    if (code === '__extra__') return 'Додаткові навички';
    return (
      SKILL_GROUP_LABELS_UA[code as keyof typeof SKILL_GROUP_LABELS_UA] ??
      (code.trim() ? code : 'Без групи')
    );
  }

  private findSkillRow(code: string): MatrixAvailableSkill | undefined {
    for (const group of this.groups) {
      const found = group.skills.find((s) => s.code === code);
      if (found) return found;
    }
    return this.availableSkills?.find((s) => s.code === code);
  }

  levelFor(code: string): number | null {
    return this.matrix.ratings.find((r) => r.skillCode === code)?.level ?? null;
  }

  setLevel(code: string, level: number): void {
    if (this.disabled) return;
    const ratings = this.matrix.ratings.filter((r) => r.skillCode !== code);
    ratings.push({ skillCode: code, level, comment: null });
    this.emit({ ...this.matrix, ratings });
  }

  setLevelFromNumber(code: string, raw: unknown): void {
    if (this.disabled) return;
    if (raw === '' || raw === null || raw === undefined) {
      this.clearLevel(code);
      return;
    }
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) return;
    const skill = this.findSkillRow(code);
    const policy = resolveMatrixRatingPolicy(this.contextVersion, skill);
    const level = Math.min(
      policy.max,
      Math.max(policy.min, Math.round(n)),
    );
    this.setLevel(code, level);
  }

  clearLevel(code: string): void {
    if (this.disabled) return;
    this.emit({
      ...this.matrix,
      ratings: this.matrix.ratings.filter((r) => r.skillCode !== code),
    });
  }

  removeExtra(code: string): void {
    if (this.disabled) return;
    if (this.matrix.ratings.some((r) => r.skillCode === code)) {
      this.emit({
        ...this.matrix,
        ratings: this.matrix.ratings.filter((r) => r.skillCode !== code),
      });
    }
    this.localExtraMeta.delete(code);
    const nextDesired = this.desiredExtraCodes.filter((c) => c !== code);
    this.desiredExtraCodesChange.emit(nextDesired);
    this.groups = this.buildGroups(this.availableSkills, nextDesired);
  }

  openPicker(): void {
    if (this.disabled) return;
    this.pickerOpen = true;
    this.pickerSkillCode = '';
    this.pickerError = null;
    this.loadPickerSkills();
  }

  closePicker(): void {
    this.pickerOpen = false;
    this.pickerSkillCode = '';
    this.pickerError = null;
    this.pickerSub?.unsubscribe();
    this.pickerSub = null;
    this.pickerLoading = false;
  }

  confirmAddSkill(): void {
    if (this.disabled || !this.pickerSkillCode) return;
    const code = this.pickerSkillCode;
    if (
      this.rowCodes.has(code) ||
      this.desiredExtraCodes.includes(code) ||
      this.matrix.ratings.some((r) => r.skillCode === code)
    ) {
      this.pickerError = 'Ця навичка вже додана';
      return;
    }
    const skill = this.pickerSkills.find((s) => s.code === code);
    if (skill) {
      this.localExtraMeta.set(code, {
        labelUa: skill.name,
        group: skill.group?.code ?? '__extra__',
        skillId: skill.id,
        scaleKind: skill.scaleKind,
        scaleMin: skill.scaleMin,
        scaleMax: skill.scaleMax,
      });
    }
    const nextDesired = [...this.desiredExtraCodes, code];
    this.desiredExtraCodesChange.emit(nextDesired);
    this.groups = this.buildGroups(this.availableSkills, nextDesired);
    this.closePicker();
  }

  setCustomLevel(index: number, level: number): void {
    const custom = this.matrix.custom.map((c, i) =>
      i === index ? { ...c, level } : c,
    );
    this.emit({ ...this.matrix, custom });
  }

  removeCustom(index: number): void {
    const custom = this.matrix.custom.filter((_, i) => i !== index);
    this.emit({ ...this.matrix, custom });
  }

  private loadPickerSkills(): void {
    this.pickerSub?.unsubscribe();
    this.pickerLoading = true;
    this.pickerError = null;
    // Active only — never ?all=true.
    this.pickerSub = this.skillsApi.getSkills(false).subscribe({
      next: (skills) => {
        const present = new Set([
          ...this.rowCodes,
          ...this.desiredExtraCodes,
          ...this.matrix.ratings.map((r) => r.skillCode),
        ]);
        this.pickerSkills = skills
          .filter((s) => s.isActive && !present.has(s.code))
          .sort((a, b) => a.name.localeCompare(b.name, 'uk'));
        this.pickerLoading = false;
      },
      error: () => {
        this.pickerLoading = false;
        this.pickerError = 'Не вдалося завантажити навички';
      },
    });
  }

  private emit(next: PositionSkillsMatrixAnswer): void {
    const pruned = pruneUnratedMatrixRatings(next);
    const keepEmptyCustom = next.custom.some(
      (c) => !c.name.trim() && c.level == null,
    );
    try {
      const parsed = parsePositionSkillsMatrixStrict(pruned);
      this.matrix = keepEmptyCustom
        ? { ...parsed, custom: next.custom }
        : parsed;
      this.groups = this.buildGroups(this.availableSkills);
      this.matrixChange.emit(parsed);
    } catch {
      this.matrix = keepEmptyCustom
        ? { ...pruned, custom: next.custom }
        : pruned;
      this.groups = this.buildGroups(this.availableSkills);
      this.matrixChange.emit(pruned);
    }
  }
}
