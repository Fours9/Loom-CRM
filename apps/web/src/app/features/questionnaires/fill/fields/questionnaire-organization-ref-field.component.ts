import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  OrganizationEntityKind,
  QuestionnaireSchemaField,
} from '@loom/contracts-questionnaires';
import {
  OrganizationCatalogApiService,
  type OrganizationCatalogNamedItem,
  type OrganizationCatalogSnapshot,
} from '../../../../core/api/organization-catalog-api.service';
import {
  filterDepartmentsForSelection,
  filterPositionsForSelection,
  reduceEmploymentOrgFilter,
  type EmploymentOrgFilterState,
} from '../../../../shared/organization/employment-org-filter.policy';
import { Subscription } from 'rxjs';

const DIRECTION_KEY = 'company_work.direction_id';
const DEPARTMENT_KEY = 'company_work.department_id';
const POSITION_KEY = 'company_work.position_id';

type SelectOption = { value: string; label: string };

/**
 * Managing company_work organization_ref select.
 * Emits UUID | null for direction/department/position; catalog name | null for
 * work_format / employment_type. Cascade clears sibling org ids via answersPatch.
 */
@Component({
  selector: 'loom-questionnaire-organization-ref-field',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="field" [attr.data-field-key]="field.key">
      <label [attr.for]="inputId">{{ field.label }}</label>
      @if (field.helpText) {
        <p class="help">{{ field.helpText }}</p>
      }
      @if (loadError) {
        <p class="field-error" role="alert">{{ loadError }}</p>
      }
      <select
        [id]="inputId"
        [disabled]="disabled || !catalog"
        [ngModel]="selectModel"
        (ngModelChange)="onSelect($event)"
      >
        <option value="">—</option>
        @if (orphanOption; as orphan) {
          <option [value]="orphan.value">{{ orphan.label }}</option>
        }
        @for (opt of options; track opt.value) {
          <option [value]="opt.value">{{ opt.label }}</option>
        }
      </select>
    </div>
  `,
  styles: [
    `
      .field {
        display: grid;
        gap: 0.35rem;
      }
      label {
        font-weight: 600;
      }
      .help {
        margin: 0;
        color: var(--pw-muted);
        font-size: 0.85rem;
        font-weight: 400;
      }
      select {
        width: 100%;
        box-sizing: border-box;
        padding: 0.55rem 0.65rem;
        border-radius: 8px;
        border: var(--q-input-border, 1px solid var(--pw-border));
        background: var(--q-input-bg, var(--pw-surface));
        color: inherit;
        min-height: 44px;
      }
      .field-error {
        margin: 0;
        color: #b42318;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class QuestionnaireOrganizationRefFieldComponent
  implements OnInit, OnChanges, OnDestroy
{
  private readonly orgCatalogApi = inject(OrganizationCatalogApiService);

  @Input({ required: true }) field!: QuestionnaireSchemaField;
  @Input() value: unknown;
  @Input() answers: Record<string, unknown> = {};
  @Input() profileMirror: Record<string, unknown> = {};
  @Input() disabled = false;
  @Output() readonly valueChange = new EventEmitter<string | null>();
  /** Sibling org-id clears / fills from reduceEmploymentOrgFilter. */
  @Output() readonly answersPatch = new EventEmitter<
    Record<string, string | null>
  >();

  catalog: OrganizationCatalogSnapshot | null = null;
  loadError: string | null = null;
  options: SelectOption[] = [];
  orphanOption: SelectOption | null = null;
  selectModel = '';

  private sub: Subscription | null = null;

  get inputId(): string {
    return `q-org-ref-${this.field.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }

  ngOnInit(): void {
    this.sub = this.orgCatalogApi.getSnapshot().subscribe({
      next: (snap) => {
        this.catalog = snap;
        this.loadError = null;
        this.rebuildOptions();
      },
      error: () => {
        this.loadError = 'Не вдалося завантажити довідники організації';
      },
    });
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.rebuildOptions();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onSelect(raw: string): void {
    if (this.disabled) return;
    const entity = this.field.organizationEntity;
    if (!entity) return;

    if (entity === 'work_format' || entity === 'employment_type') {
      const next = raw.trim() ? raw : null;
      this.valueChange.emit(next);
      return;
    }

    if (!this.catalog) return;
    const state = this.readOrgFilterState();
    const catalogs = {
      directions: this.catalog.directions,
      departments: this.catalog.departments,
      positions: this.catalog.positions,
    };

    let nextState: EmploymentOrgFilterState;
    if (entity === 'direction') {
      nextState = reduceEmploymentOrgFilter(
        state,
        { type: 'selectDirection', directionId: raw || null },
        catalogs,
      );
    } else if (entity === 'department') {
      nextState = reduceEmploymentOrgFilter(
        state,
        { type: 'selectDepartment', departmentId: raw || null },
        catalogs,
      );
    } else if (entity === 'position') {
      nextState = reduceEmploymentOrgFilter(
        state,
        { type: 'selectPosition', positionId: raw || null },
        catalogs,
      );
    } else {
      return;
    }

    const patch: Record<string, string | null> = {};
    if (nextState.directionId !== state.directionId) {
      patch[DIRECTION_KEY] = nextState.directionId;
    }
    if (nextState.departmentId !== state.departmentId) {
      patch[DEPARTMENT_KEY] = nextState.departmentId;
    }
    if (nextState.positionId !== state.positionId) {
      patch[POSITION_KEY] = nextState.positionId;
    }
    // Always include the edited field so parent can apply one atomic patch.
    if (!(this.field.key in patch)) {
      const own =
        entity === 'direction'
          ? nextState.directionId
          : entity === 'department'
            ? nextState.departmentId
            : nextState.positionId;
      patch[this.field.key] = own;
    }
    this.answersPatch.emit(patch);
  }

  private rebuildOptions(): void {
    const entity = this.field.organizationEntity;
    const current = this.asNullableString(this.value);
    this.selectModel = current ?? '';

    if (!entity || !this.catalog) {
      this.options = [];
      this.orphanOption = null;
      return;
    }

    if (entity === 'work_format') {
      this.options = namedOptions(this.catalog.workFormats);
      this.orphanOption = orphanNamed(current, this.options);
      return;
    }
    if (entity === 'employment_type') {
      this.options = namedOptions(this.catalog.employmentTypes);
      this.orphanOption = orphanNamed(current, this.options);
      return;
    }

    const state = this.readOrgFilterState();
    if (entity === 'direction') {
      this.options = this.catalog.directions.map((d) => ({
        value: d.id,
        label: d.name,
      }));
    } else if (entity === 'department') {
      this.options = filterDepartmentsForSelection(
        state,
        this.catalog.departments,
      ).map((d) => ({ value: d.id, label: d.name }));
    } else if (entity === 'position') {
      this.options = filterPositionsForSelection(
        state,
        this.catalog.positions,
      ).map((p) => ({ value: p.id, label: p.name }));
    } else {
      this.options = [];
    }
    this.orphanOption = orphanId(current, this.options, this.catalog, entity);
  }

  private readOrgFilterState(): EmploymentOrgFilterState {
    return {
      directionId: this.readOrgAnswer(DIRECTION_KEY, 'directionId'),
      departmentId: this.readOrgAnswer(DEPARTMENT_KEY, 'departmentId'),
      positionId: this.readOrgAnswer(POSITION_KEY, 'positionId'),
    };
  }

  private readOrgAnswer(
    answerKey: string,
    mirrorKey: string,
  ): string | null {
    if (Object.prototype.hasOwnProperty.call(this.answers, answerKey)) {
      return this.asNullableString(this.answers[answerKey]);
    }
    if (answerKey === this.field.key) {
      return this.asNullableString(this.value);
    }
    if (Object.prototype.hasOwnProperty.call(this.profileMirror, mirrorKey)) {
      return this.asNullableString(this.profileMirror[mirrorKey]);
    }
    return null;
  }

  private asNullableString(value: unknown): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
  }
}

function namedOptions(items: OrganizationCatalogNamedItem[]): SelectOption[] {
  return items.map((item) => ({ value: item.name, label: item.name }));
}

function orphanNamed(
  current: string | null,
  options: SelectOption[],
): SelectOption | null {
  if (!current) return null;
  if (options.some((o) => o.value === current)) return null;
  return { value: current, label: `${current} (архівне)` };
}

function orphanId(
  current: string | null,
  options: SelectOption[],
  catalog: OrganizationCatalogSnapshot,
  entity: OrganizationEntityKind,
): SelectOption | null {
  if (!current) return null;
  if (options.some((o) => o.value === current)) return null;
  let label = current;
  if (entity === 'direction') {
    label = catalog.directions.find((d) => d.id === current)?.name ?? current;
  } else if (entity === 'department') {
    label = catalog.departments.find((d) => d.id === current)?.name ?? current;
  } else if (entity === 'position') {
    label = catalog.positions.find((p) => p.id === current)?.name ?? current;
  }
  return { value: current, label: `${label} (поза фільтром)` };
}
