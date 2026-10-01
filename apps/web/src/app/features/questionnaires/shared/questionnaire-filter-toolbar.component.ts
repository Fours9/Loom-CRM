import { Component, input, output } from '@angular/core';

export type QuestionnaireFilterField =
  | 'code'
  | 'templateType'
  | 'status'
  | 'attachmentState'
  | 'createdFrom'
  | 'createdTo'
  | 'departmentId'
  | 'positionId';

export type QuestionnaireFilterToolbarValue = {
  code?: string;
  templateType?: string;
  status?: string;
  attachmentState?: string;
  createdFrom?: string;
  createdTo?: string;
  departmentId?: string;
  positionId?: string;
};

@Component({
  selector: 'loom-questionnaire-filter-toolbar',
  standalone: true,
  template: `
    <div class="filters">
      @if (has('code')) {
        <label>
          Код
          <input
            type="text"
            [value]="value().code ?? ''"
            (change)="emitField('code', $any($event.target).value)"
            placeholder="360-001"
          />
        </label>
      }
      @if (has('templateType')) {
        <label>
          Тип
          <select
            [value]="value().templateType ?? ''"
            (change)="emitField('templateType', $any($event.target).value)"
          >
            <option value="">Усі</option>
            @for (t of typeOptions(); track t.value) {
              <option [value]="t.value">{{ t.label }}</option>
            }
          </select>
        </label>
      }
      @if (has('status')) {
        <label>
          Статус
          <select
            [value]="value().status ?? ''"
            (change)="emitField('status', $any($event.target).value)"
          >
            <option value="">Усі</option>
            @for (s of statusOptions(); track s.value) {
              <option [value]="s.value">{{ s.label }}</option>
            }
          </select>
        </label>
      }
      @if (has('attachmentState')) {
        <label data-help-id="q.attachment-filter">
          Стан
          <select
            [value]="value().attachmentState ?? ''"
            (change)="emitField('attachmentState', $any($event.target).value)"
          >
            <option value="">Усі</option>
            <option value="new">Нова</option>
            <option value="attached">Прикріплено</option>
            <option value="detached">Відкріплено</option>
            <option value="closed">Закрито</option>
          </select>
        </label>
      }
      @if (has('departmentId')) {
        <label>
          Відділ
          <select
            [value]="value().departmentId ?? ''"
            (change)="emitField('departmentId', $any($event.target).value)"
          >
            <option value="">Усі</option>
            @for (d of departments(); track d.id) {
              <option [value]="d.id">{{ d.name }}</option>
            }
          </select>
        </label>
      }
      @if (has('positionId')) {
        <label>
          Посада
          <select
            [value]="value().positionId ?? ''"
            (change)="emitField('positionId', $any($event.target).value)"
          >
            <option value="">Усі</option>
            @for (p of positions(); track p.id) {
              <option [value]="p.id">{{ p.name }}</option>
            }
          </select>
        </label>
      }
      @if (has('createdFrom')) {
        <label>
          Від
          <input
            type="date"
            [value]="value().createdFrom ?? ''"
            (change)="emitField('createdFrom', $any($event.target).value)"
          />
        </label>
      }
      @if (has('createdTo')) {
        <label>
          До
          <input
            type="date"
            [value]="value().createdTo ?? ''"
            (change)="emitField('createdTo', $any($event.target).value)"
          />
        </label>
      }
    </div>
  `,
  styles: [
    `
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem 1rem;
        align-items: end;
      }
      label {
        display: grid;
        gap: 0.25rem;
        font-size: 0.75rem;
        color: var(--pw-muted);
      }
      input,
      select {
        border: 1px solid var(--pw-border);
        border-radius: 8px;
        padding: 0.35rem 0.5rem;
        background: var(--pw-bg, #fff);
        font-size: 0.9rem;
        min-width: 8rem;
      }
    `,
  ],
})
export class QuestionnaireFilterToolbarComponent {
  readonly value = input<QuestionnaireFilterToolbarValue>({});
  readonly availableFilters = input<QuestionnaireFilterField[]>([]);
  readonly typeOptions = input<Array<{ value: string; label: string }>>([]);
  readonly statusOptions = input<Array<{ value: string; label: string }>>([]);
  readonly departments = input<Array<{ id: string; name: string }>>([]);
  readonly positions = input<Array<{ id: string; name: string }>>([]);

  readonly filterChange = output<QuestionnaireFilterToolbarValue>();

  has(field: QuestionnaireFilterField): boolean {
    return this.availableFilters().includes(field);
  }

  emitField(key: keyof QuestionnaireFilterToolbarValue, raw: string): void {
    this.filterChange.emit({
      ...this.value(),
      [key]: raw || undefined,
    });
  }
}
