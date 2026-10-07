import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  EmployeeAboutChildFieldView,
  EmployeeAboutFieldView,
} from '@loom/contracts-employees';
import { PwDateInputComponent } from '../../shared/ui/pw-date-input.component';
import {
  PwSelectComponent,
  type PwSelectOption,
} from '../../shared/ui/pw-select.component';

type AboutGoalRow = Record<string, unknown> & { __uiId: string };

/**
 * About Profile Core repeating_group editor.
 * Schema/children come from projected catalog fields (single vocabulary SoT).
 */
@Component({
  selector: 'loom-employee-about-repeating-field',
  standalone: true,
  imports: [FormsModule, PwSelectComponent, PwDateInputComponent],
  template: `
    <div class="rg" [attr.aria-label]="field.labelUa">
      @if (!editable) {
        @if (field.displayValue) {
          <ul class="display-list">
            @for (line of displayLines; track $index) {
              <li>{{ line }}</li>
            }
          </ul>
        } @else {
          <p class="muted">не вказано</p>
        }
      } @else {
        @if (!rows.length) {
          <p class="muted">Немає записів</p>
        }
        @for (row of rows; track row.__uiId; let i = $index) {
          <div class="row">
            <div class="row-head">
              <strong>#{{ i + 1 }}</strong>
              <button
                type="button"
                class="pw-link-action danger"
                title="Видалити"
                aria-label="Видалити запис"
                (click)="removeRow(i)"
              >
                Видалити
              </button>
            </div>
            @for (child of children; track child.key) {
              <label class="child">
                <span>{{ child.labelUa }}</span>
                @switch (child.valueType) {
                  @case ('single_choice') {
                    <loom-pw-select
                      [value]="asSelectValue(row[child.key])"
                      [options]="choiceOptions(child)"
                      placeholder="— не вказано —"
                      (valueChange)="onChoiceSelected(i, child.key, $event)"
                    />
                  }
                  @case ('textarea') {
                    <textarea
                      rows="2"
                      [ngModel]="asString(row[child.key])"
                      (ngModelChange)="onChildChange(i, child.key, $event)"
                    ></textarea>
                  }
                  @case ('date') {
                    <loom-pw-date-input
                      [value]="asString(row[child.key])"
                      (valueChange)="onChildChange(i, child.key, $event || null)"
                    />
                  }
                  @default {
                    <input
                      type="text"
                      [ngModel]="asString(row[child.key])"
                      (ngModelChange)="onChildChange(i, child.key, $event)"
                    />
                  }
                }
              </label>
            }
          </div>
        }
        <button
          type="button"
          class="pw-link-action"
          [disabled]="!canAdd"
          (click)="addRow()"
        >
          Додати запис
        </button>
      }
    </div>
  `,
  styles: [
    `
      .rg {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }
      .muted {
        margin: 0;
        color: var(--loom-muted, #667085);
      }
      .display-list {
        margin: 0;
        padding-left: 1.1rem;
        display: grid;
        gap: 0.35rem;
        line-height: 1.4;
      }
      .row {
        display: grid;
        gap: 0.45rem;
        padding: 0.65rem;
        border: 1px solid var(--pw-border, #d0d7e2);
        border-radius: 10px;
        background: var(--pw-surface, #fff);
      }
      .row-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
      }
      .child {
        display: grid;
        gap: 0.25rem;
        font-weight: 500;
      }
      .child span {
        font-size: 0.85rem;
        color: var(--pw-muted, #667085);
      }
      textarea,
      input {
        width: 100%;
        box-sizing: border-box;
        font-weight: 400;
      }
      .pw-link-action.danger {
        color: var(--pw-danger, #b91c1c);
      }
    `,
  ],
})
export class EmployeeAboutRepeatingFieldComponent {
  @Input({ required: true }) field!: EmployeeAboutFieldView;
  @Input() editable = false;
  @Input() value: unknown = null;
  @Output() readonly valueChange = new EventEmitter<unknown>();

  private uiSeq = 0;
  rows: AboutGoalRow[] = [];

  get children(): readonly EmployeeAboutChildFieldView[] {
    return this.field.children ?? [];
  }

  get canAdd(): boolean {
    const max = this.field.maxItems;
    if (max == null) return true;
    return this.rows.length < max;
  }

  get displayLines(): string[] {
    const raw = this.field.displayValue?.trim();
    if (!raw) return [];
    return raw.split(' | ').map((s) => s.trim()).filter(Boolean);
  }

  ngOnChanges(): void {
    this.rows = this.toRows(this.value);
  }

  addRow(): void {
    if (!this.canAdd) return;
    this.rows = [...this.rows, this.emptyRow()];
    this.emit();
  }

  removeRow(index: number): void {
    this.rows = this.rows.filter((_, i) => i !== index);
    this.emit();
  }

  onChildChange(index: number, key: string, next: unknown): void {
    const copy = this.rows.map((r, i) =>
      i === index ? { ...r, [key]: next } : r,
    );
    this.rows = copy;
    this.emit();
  }

  onChoiceSelected(index: number, key: string, next: string): void {
    this.onChildChange(index, key, next === '' ? null : next);
  }

  asSelectValue(value: unknown): string {
    return value == null ? '' : String(value);
  }

  choiceOptions(child: EmployeeAboutChildFieldView): PwSelectOption[] {
    return [
      { value: '', label: '— не вказано —' },
      ...(child.options ?? []).map((opt) => ({
        value: String(opt.value),
        label: opt.labelUa,
      })),
    ];
  }

  asString(value: unknown): string {
    return value == null ? '' : String(value);
  }

  private emit(): void {
    this.valueChange.emit(this.rows.map((r) => this.stripUi(r)));
  }

  private toRows(value: unknown): AboutGoalRow[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((row) => row && typeof row === 'object' && !Array.isArray(row))
      .map((row) => ({
        ...(row as Record<string, unknown>),
        __uiId: this.nextUiId(),
      }));
  }

  private emptyRow(): AboutGoalRow {
    const row: AboutGoalRow = { __uiId: this.nextUiId() };
    for (const child of this.children) {
      row[child.key] = null;
    }
    return row;
  }

  private stripUi(row: AboutGoalRow): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const child of this.children) {
      const v = row[child.key];
      if (v === '' || v === undefined) {
        out[child.key] = null;
      } else {
        out[child.key] = v;
      }
    }
    return out;
  }

  private nextUiId(): string {
    this.uiSeq += 1;
    return `about-rg-${this.uiSeq}`;
  }
}
