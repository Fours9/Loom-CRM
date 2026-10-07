import { Component, computed, input, output } from '@angular/core';
import { PwDateInputComponent } from '../../../shared/ui/pw-date-input.component';
import {
  MultiSelectItem,
  MultiSelectListComponent,
} from '../../../shared/multi-select-list.component';

export type QuestionnaireFilterField =
  | 'code'
  | 'templateTypes'
  | 'statuses'
  | 'attachmentStates'
  | 'createdFrom'
  | 'createdTo'
  | 'departmentIds'
  | 'positionIds';

export type QuestionnaireFilterToolbarValue = {
  code?: string;
  templateTypes?: string[];
  statuses?: string[];
  attachmentStates?: string[];
  createdFrom?: string;
  createdTo?: string;
  departmentIds?: string[];
  positionIds?: string[];
};

@Component({
  selector: 'loom-questionnaire-filter-toolbar',
  standalone: true,
  imports: [PwDateInputComponent, MultiSelectListComponent],
  template: `
    <div class="filters pw-filters">
      <div class="filters-row">
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
        @if (has('templateTypes')) {
          <label class="multi">
            Тип
            <app-multi-select-list
              [items]="typeItems()"
              [selectedIds]="value().templateTypes ?? []"
              placeholder="Усі типи"
              (selectedIdsChange)="emitIds('templateTypes', $event)"
            />
          </label>
        }
        @if (has('statuses')) {
          <label class="multi">
            Статус
            <app-multi-select-list
              [items]="statusItems()"
              [selectedIds]="value().statuses ?? []"
              placeholder="Усі статуси"
              (selectedIdsChange)="emitIds('statuses', $event)"
            />
          </label>
        }
        @if (has('attachmentStates')) {
          <label class="multi" data-help-id="q.attachment-filter">
            Стан
            <app-multi-select-list
              [items]="attachmentItems"
              [selectedIds]="value().attachmentStates ?? []"
              placeholder="Усі стани"
              (selectedIdsChange)="emitIds('attachmentStates', $event)"
            />
          </label>
        }
      </div>

      @if (showSecondRow()) {
        <div class="filters-row">
          @if (has('departmentIds')) {
            <label class="multi">
              Відділ
              <app-multi-select-list
                [items]="departmentItems()"
                [selectedIds]="value().departmentIds ?? []"
                placeholder="Усі відділи"
                (selectedIdsChange)="emitIds('departmentIds', $event)"
              />
            </label>
          }
          @if (has('positionIds')) {
            <label class="multi">
              Посада
              <app-multi-select-list
                [items]="positionItems()"
                [selectedIds]="value().positionIds ?? []"
                placeholder="Усі посади"
                (selectedIdsChange)="emitIds('positionIds', $event)"
              />
            </label>
          }
          @if (has('createdFrom')) {
            <label>
              Від
              <loom-pw-date-input
                [value]="value().createdFrom ?? ''"
                (valueChange)="emitField('createdFrom', $event)"
              />
            </label>
          }
          @if (has('createdTo')) {
            <label>
              До
              <loom-pw-date-input
                [value]="value().createdTo ?? ''"
                (valueChange)="emitField('createdTo', $event)"
              />
            </label>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .filters {
        display: grid;
        gap: 0.75rem;
        position: relative;
        z-index: 6;
        isolation: isolate;
        overflow: visible;
      }
      .filters-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem 1rem;
        align-items: end;
        overflow: visible;
      }
      label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        color: var(--pw-muted);
        min-width: 8rem;
        position: relative;
        overflow: visible;
      }
      label.multi {
        min-width: 12rem;
        flex: 1 1 12rem;
        max-width: 18rem;
      }
      input[type='text'] {
        border: 1px solid var(--pw-border-strong, var(--pw-border));
        border-radius: 12px;
        padding: 0.45rem 0.7rem;
        min-height: var(--pw-control-h, 2.6rem);
        background: var(--pw-input-bg, var(--pw-surface));
        color: var(--pw-text);
        font: inherit;
        font-weight: 600;
        transition:
          border-color 0.16s ease,
          box-shadow 0.16s ease;
      }
      input[type='text']:focus-visible {
        outline: none;
        border-color: var(--pw-accent);
        box-shadow: var(
          --pw-focus-ring,
          0 0 0 3px color-mix(in srgb, var(--pw-accent) 28%, transparent)
        );
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

  readonly attachmentItems: MultiSelectItem[] = [
    { id: 'new', label: 'Нова' },
    { id: 'attached', label: 'Прикріплено' },
    { id: 'detached', label: 'Відкріплено' },
    { id: 'closed', label: 'Закрито' },
  ];

  readonly typeItems = computed<MultiSelectItem[]>(() =>
    this.typeOptions().map((t) => ({ id: t.value, label: t.label })),
  );

  readonly statusItems = computed<MultiSelectItem[]>(() =>
    this.statusOptions().map((s) => ({ id: s.value, label: s.label })),
  );

  readonly departmentItems = computed<MultiSelectItem[]>(() =>
    this.departments().map((d) => ({ id: d.id, label: d.name })),
  );

  readonly positionItems = computed<MultiSelectItem[]>(() =>
    this.positions().map((p) => ({ id: p.id, label: p.name })),
  );

  has(field: QuestionnaireFilterField): boolean {
    return this.availableFilters().includes(field);
  }

  showSecondRow(): boolean {
    return (
      this.has('departmentIds') ||
      this.has('positionIds') ||
      this.has('createdFrom') ||
      this.has('createdTo')
    );
  }

  emitField(key: keyof QuestionnaireFilterToolbarValue, raw: string): void {
    this.filterChange.emit({
      ...this.value(),
      [key]: raw || undefined,
    });
  }

  emitIds(
    key:
      | 'departmentIds'
      | 'positionIds'
      | 'templateTypes'
      | 'attachmentStates'
      | 'statuses',
    ids: string[],
  ): void {
    this.filterChange.emit({
      ...this.value(),
      [key]: ids.length ? ids : undefined,
    });
  }
}
