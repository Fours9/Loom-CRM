import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { QuestionnaireSchemaField } from '@loom/contracts-questionnaires';
import { parseNumberInput } from '../validation/questionnaire-validation';

let rowUiSeq = 0;

@Component({
  selector: 'loom-questionnaire-field-host',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="field" [attr.data-field-key]="field.key">
      @switch (field.valueType) {
        @case ('textarea') {
          <label [attr.for]="inputId">{{ field.label }}</label>
          @if (field.helpText) {
            <p class="help">{{ field.helpText }}</p>
          }
          <textarea
            [id]="inputId"
            rows="4"
            [disabled]="disabled"
            [ngModel]="asString(value)"
            (ngModelChange)="onText($event)"
          ></textarea>
        }
        @case ('date') {
          <label [attr.for]="inputId">{{ field.label }}</label>
          @if (field.helpText) {
            <p class="help">{{ field.helpText }}</p>
          }
          <input
            [id]="inputId"
            type="date"
            [disabled]="disabled"
            [ngModel]="asString(value)"
            (ngModelChange)="onText($event)"
          />
        }
        @case ('number') {
          <label [attr.for]="inputId">{{ field.label }}</label>
          @if (field.helpText) {
            <p class="help">{{ field.helpText }}</p>
          }
          <input
            [id]="inputId"
            type="text"
            inputmode="decimal"
            [disabled]="disabled"
            [ngModel]="numberDraft"
            (ngModelChange)="onNumberDraft($event)"
            (blur)="commitNumber()"
          />
          @if (numberError) {
            <p class="field-error">{{ numberError }}</p>
          }
        }
        @case ('boolean') {
          @if (field.uiControl === 'checkbox') {
            <label class="check">
              <input
                type="checkbox"
                [disabled]="disabled"
                [checked]="value === true"
                (change)="onBooleanCheckbox($event)"
              />
              <span>{{ field.label }}</span>
            </label>
            @if (field.helpText) {
              <p class="help">{{ field.helpText }}</p>
            }
          } @else {
            <fieldset class="choice">
              <legend>{{ field.label }}</legend>
              @if (field.helpText) {
                <p class="help">{{ field.helpText }}</p>
              }
              <label class="radio">
                <input
                  type="radio"
                  [name]="inputId"
                  [disabled]="disabled"
                  [checked]="value === true"
                  (change)="emitValue(true)"
                />
                Так
              </label>
              <label class="radio">
                <input
                  type="radio"
                  [name]="inputId"
                  [disabled]="disabled"
                  [checked]="value === false"
                  (change)="emitValue(false)"
                />
                Ні
              </label>
            </fieldset>
          }
        }
        @case ('single_choice') {
          <fieldset class="choice">
            <legend>{{ field.label }}</legend>
            @if (field.helpText) {
              <p class="help">{{ field.helpText }}</p>
            }
            @for (opt of field.options ?? []; track opt.value) {
              <label class="radio">
                <input
                  type="radio"
                  [name]="inputId"
                  [disabled]="disabled"
                  [checked]="value === opt.value"
                  (change)="emitValue(opt.value)"
                />
                {{ opt.label }}
              </label>
            }
          </fieldset>
        }
        @case ('multi_choice') {
          <fieldset class="choice">
            <legend>{{ field.label }}</legend>
            @if (field.helpText) {
              <p class="help">{{ field.helpText }}</p>
            }
            @for (opt of field.options ?? []; track opt.value) {
              <label class="check">
                <input
                  type="checkbox"
                  [disabled]="disabled"
                  [checked]="isMultiSelected(opt.value)"
                  (change)="onMultiToggle(opt.value, $event)"
                />
                {{ opt.label }}
              </label>
            }
          </fieldset>
        }
        @case ('repeating_group') {
          <fieldset class="repeating">
            <legend>{{ field.label }}</legend>
            @if (field.helpText) {
              <p class="help">{{ field.helpText }}</p>
            }
            @if (!rows.length) {
              <p class="empty">Немає записів</p>
            }
            @for (row of rows; track row.__uiId; let i = $index) {
              <div class="row">
                <div class="row-head">
                  <strong>#{{ i + 1 }}</strong>
                  <button
                    type="button"
                    class="btn danger"
                    [disabled]="disabled || !canRemove"
                    (click)="removeRow(i)"
                  >
                    Видалити
                  </button>
                </div>
                @for (child of field.children ?? []; track child.key) {
                  <div class="child-field">
                    <label [attr.for]="childInputId(child.key, i)">{{
                      child.label
                    }}</label>
                    @if (child.valueType === 'single_choice') {
                      <fieldset class="choice">
                        <legend class="sr-only">{{ child.label }}</legend>
                        @for (opt of child.options ?? []; track opt.value) {
                          <label class="radio">
                            <input
                              type="radio"
                              [name]="childInputId(child.key, i)"
                              [disabled]="disabled"
                              [checked]="row[child.key] === opt.value"
                              (change)="onChildChange(i, child.key, opt.value)"
                            />
                            {{ opt.label }}
                          </label>
                        }
                      </fieldset>
                    } @else if (child.valueType === 'date') {
                      <input
                        [id]="childInputId(child.key, i)"
                        type="date"
                        [disabled]="disabled"
                        [ngModel]="asString(row[child.key])"
                        (ngModelChange)="onChildChange(i, child.key, $event)"
                      />
                    } @else {
                      <input
                        [id]="childInputId(child.key, i)"
                        type="text"
                        [disabled]="disabled"
                        [ngModel]="asString(row[child.key])"
                        (ngModelChange)="onChildChange(i, child.key, $event)"
                      />
                    }
                  </div>
                }
              </div>
            }
            <button
              type="button"
              class="btn"
              [disabled]="disabled || !canAdd"
              (click)="addRow()"
            >
              Додати
            </button>
          </fieldset>
        }
        @default {
          <label [attr.for]="inputId">{{ field.label }}</label>
          @if (field.helpText) {
            <p class="help">{{ field.helpText }}</p>
          }
          <input
            [id]="inputId"
            type="text"
            [disabled]="disabled"
            [ngModel]="asString(value)"
            (ngModelChange)="onText($event)"
          />
        }
      }
      @if (error) {
        <p class="field-error" role="alert">{{ error }}</p>
      }
    </div>
  `,
  styles: [
    `
      .field {
        display: grid;
        gap: 0.35rem;
      }
      label,
      legend {
        font-weight: 600;
      }
      .help {
        margin: 0;
        color: var(--pw-muted);
        font-size: 0.85rem;
        font-weight: 400;
      }
      input[type='text'],
      input[type='date'],
      textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 0.55rem 0.65rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        background: var(--pw-surface);
        color: inherit;
        min-height: 44px;
      }
      textarea {
        min-height: 6rem;
        resize: vertical;
      }
      .choice,
      .repeating {
        border: 1px solid var(--pw-border);
        border-radius: 10px;
        padding: 0.75rem;
        display: grid;
        gap: 0.45rem;
        margin: 0;
      }
      .radio,
      .check {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 400;
        min-height: 44px;
      }
      .row {
        border: 1px dashed var(--pw-border);
        border-radius: 8px;
        padding: 0.65rem;
        display: grid;
        gap: 0.5rem;
      }
      .row-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .btn {
        min-height: 44px;
        padding: 0.45rem 0.8rem;
        border-radius: 8px;
        border: 1px solid var(--pw-border);
        background: var(--pw-surface);
        cursor: pointer;
      }
      .btn.danger {
        color: #b42318;
      }
      .btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .empty {
        color: var(--pw-muted);
        margin: 0;
      }
      .field-error {
        margin: 0;
        color: #b42318;
        font-size: 0.85rem;
      }
      .child-field {
        display: grid;
        gap: 0.25rem;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        border: 0;
      }
    `,
  ],
})
export class QuestionnaireFieldHostComponent implements OnChanges {
  @Input({ required: true }) field!: QuestionnaireSchemaField;
  @Input() value: unknown;
  @Input() disabled = false;
  @Input() error: string | null = null;
  @Output() readonly valueChange = new EventEmitter<unknown>();

  numberDraft = '';
  numberError: string | null = null;
  /** Local UI identity only — never persisted in answers_json. */
  rows: Array<Record<string, unknown> & { __uiId: string }> = [];

  private syncedForField: string | null = null;

  get inputId(): string {
    return `q-field-${this.field.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }

  childInputId(childKey: string, index: number): string {
    return `${this.inputId}-r${index}-${childKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }

  get canAdd(): boolean {
    const max = this.field.maxItems;
    if (max === undefined) return true;
    return this.rows.length < max;
  }

  get canRemove(): boolean {
    const min = this.field.minItems ?? 0;
    return this.rows.length > min;
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.field.valueType === 'number') {
      if (typeof this.value === 'number' && Number.isFinite(this.value)) {
        this.numberDraft = String(this.value);
      } else if (this.value === undefined || this.value === null) {
        this.numberDraft = '';
      }
      this.numberError = null;
    }
    if (this.field.valueType === 'repeating_group') {
      this.syncRowsFromValue();
    }
  }

  asString(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  onText(raw: string): void {
    this.emitValue(raw);
  }

  onNumberDraft(raw: string): void {
    this.numberDraft = raw;
    this.numberError = null;
  }

  commitNumber(): void {
    const raw = this.numberDraft.trim();
    if (!raw) {
      this.numberError = null;
      this.emitValue(null);
      return;
    }
    const parsed = parseNumberInput(raw);
    if (parsed === null) {
      this.numberError = 'Введіть число';
      return;
    }
    this.numberError = null;
    this.emitValue(parsed);
  }

  onBooleanCheckbox(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.emitValue(checked);
  }

  isMultiSelected(opt: string): boolean {
    return Array.isArray(this.value) && this.value.includes(opt);
  }

  onMultiToggle(opt: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = Array.isArray(this.value) ? [...this.value] : [];
    if (checked) {
      if (!current.includes(opt)) current.push(opt);
    } else {
      const idx = current.indexOf(opt);
      if (idx >= 0) current.splice(idx, 1);
    }
    this.emitValue(current);
  }

  addRow(): void {
    if (!this.canAdd) return;
    this.rows = [
      ...this.rows,
      { __uiId: nextRowId() } as Record<string, unknown> & { __uiId: string },
    ];
    this.emitRows();
  }

  removeRow(index: number): void {
    if (!this.canRemove) return;
    const row = this.rows[index];
    const nonempty = row && Object.keys(row).some((k) => {
      if (k === '__uiId') return false;
      const v = row[k];
      return v !== null && v !== undefined && v !== '';
    });
    if (nonempty && !window.confirm('Видалити непорожній запис?')) return;
    this.rows = this.rows.filter((_, i) => i !== index);
    this.emitRows();
  }

  onChildChange(index: number, childKey: string, value: unknown): void {
    const next = this.rows.map((row, i) =>
      i === index ? { ...row, [childKey]: value } : row,
    );
    this.rows = next;
    this.emitRows();
  }

  emitValue(value: unknown): void {
    this.valueChange.emit(value);
  }

  private emitRows(): void {
    const payload = this.rows.map((row) => {
      const { __uiId: _ui, ...rest } = row;
      return rest;
    });
    this.valueChange.emit(payload);
  }

  private syncRowsFromValue(): void {
    const key = this.field.key;
    const incoming = Array.isArray(this.value) ? this.value : [];
    if (
      this.syncedForField === key &&
      this.rows.length === incoming.length &&
      JSON.stringify(stripUi(this.rows)) === JSON.stringify(incoming)
    ) {
      return;
    }
    this.syncedForField = key;
    this.rows = incoming.map((item) => {
      const base =
        item && typeof item === 'object' && !Array.isArray(item)
          ? { ...(item as Record<string, unknown>) }
          : {};
      return { ...base, __uiId: nextRowId() };
    });
  }
}

function nextRowId(): string {
  rowUiSeq += 1;
  return `row-${rowUiSeq}`;
}

function stripUi(
  rows: Array<Record<string, unknown> & { __uiId: string }>,
): Record<string, unknown>[] {
  return rows.map(({ __uiId: _u, ...rest }) => rest);
}
