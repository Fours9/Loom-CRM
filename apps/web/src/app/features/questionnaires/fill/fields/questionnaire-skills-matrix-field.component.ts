import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
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
  type PositionSkillsMatrixAnswer,
} from '@loom/questionnaire-schema';

/** Fill presentation row. Frozen context is used literally; null input → registry. */
export type MatrixAvailableSkill = {
  code: string;
  labelUa: string;
  group: string;
  targetLevel?: number | null;
  scaleKind?: 'range' | 'percent';
  scaleMin?: number;
  scaleMax?: number;
};

type GroupView = {
  code: string;
  label: string;
  skills: MatrixAvailableSkill[];
};

@Component({
  selector: 'loom-questionnaire-skills-matrix-field',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="matrix" [class.disabled]="disabled">
      <p class="hint">
        Оцініть навички від {{ levelMin }} до {{ levelMax }}. Оцінка незалежна від вимоги
        посади.
      </p>
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
                <div class="dots" role="group" [attr.aria-label]="skill.labelUa">
                  @for (lvl of levels; track lvl) {
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
              </li>
            }
          </ul>
        </section>
      }

      <section class="custom">
        <h3>Додаткові навички</h3>
        @for (row of matrix.custom; track $index; let i = $index) {
          <div class="custom-row">
            <input
              type="text"
              placeholder="Назва"
              [disabled]="disabled"
              [ngModel]="row.name"
              (ngModelChange)="onCustomName(i, $event)"
            />
            <div class="dots">
              @for (lvl of levels; track lvl) {
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
        <button type="button" class="add" [disabled]="disabled" (click)="addCustom()">
          Додати власну навичку
        </button>
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
        cursor: pointer;
      }
      .dot.active {
        background: color-mix(in srgb, currentColor 18%, transparent);
        font-weight: 600;
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
      input[type='text'] {
        width: 100%;
        padding: 0.35rem 0.5rem;
      }
    `,
  ],
})
export class QuestionnaireSkillsMatrixFieldComponent implements OnChanges {
  @Input() value: unknown;
  @Input() disabled = false;
  /**
   * `null` → legacy registry.
   * Array (including `[]`) → literal frozen rows; do not fall back to registry.
   */
  @Input() availableSkills: MatrixAvailableSkill[] | null = null;
  @Output() matrixChange = new EventEmitter<PositionSkillsMatrixAnswer>();

  readonly levelMin = SKILL_LEVEL_MIN;
  readonly levelMax = SKILL_LEVEL_MAX;
  readonly levels = Array.from(
    { length: SKILL_LEVEL_MAX - SKILL_LEVEL_MIN + 1 },
    (_, i) => SKILL_LEVEL_MIN + i,
  );

  groups: GroupView[] = this.buildGroups(null);

  matrix: PositionSkillsMatrixAnswer = emptyPositionSkillsMatrix();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['availableSkills']) {
      this.groups = this.buildGroups(this.availableSkills);
    }
    if (changes['value']) {
      try {
        this.matrix = parsePositionSkillsMatrixStrict(this.value);
      } catch {
        this.matrix = emptyPositionSkillsMatrix();
      }
    }
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

  private buildGroups(
    available: MatrixAvailableSkill[] | null,
  ): GroupView[] {
    const rows =
      available === null
        ? SKILL_DEFINITIONS.map((s) => ({
            code: s.code,
            labelUa: s.labelUa,
            group: s.group,
          }))
        : available;
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
    return (
      SKILL_GROUP_LABELS_UA[code as keyof typeof SKILL_GROUP_LABELS_UA] ??
      (code.trim() ? code : 'Без групи')
    );
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

  clearLevel(code: string): void {
    if (this.disabled) return;
    this.emit({
      ...this.matrix,
      ratings: this.matrix.ratings.filter((r) => r.skillCode !== code),
    });
  }

  addCustom(): void {
    if (this.disabled) return;
    this.matrix = {
      ...this.matrix,
      custom: [...this.matrix.custom, { name: '', level: null, comment: null }],
    };
  }

  onCustomName(index: number, name: string): void {
    const custom = this.matrix.custom.map((c, i) =>
      i === index ? { ...c, name } : c,
    );
    this.matrix = { ...this.matrix, custom };
    if (name.trim() || custom[index]?.level != null) {
      this.emit(this.matrix);
    }
  }

  setCustomLevel(index: number, level: number): void {
    const custom = this.matrix.custom.map((c, i) =>
      i === index ? { ...c, level } : c,
    );
    this.emit({ ...this.matrix, custom });
  }

  removeCustom(index: number): void {
    const custom = this.matrix.custom.filter((_, i) => i !== index);
    this.matrix = { ...this.matrix, custom };
    this.emit({ ...this.matrix, custom });
  }

  private emit(next: PositionSkillsMatrixAnswer): void {
    try {
      const parsed = parsePositionSkillsMatrixStrict(next);
      this.matrix = {
        ...parsed,
        custom: next.custom.some((c) => !c.name.trim() && c.level == null)
          ? next.custom
          : parsed.custom,
      };
      this.matrixChange.emit(parsed);
    } catch {
      this.matrix = next;
      this.matrixChange.emit(next);
    }
  }
}
