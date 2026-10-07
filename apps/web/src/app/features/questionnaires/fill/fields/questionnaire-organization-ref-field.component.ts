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
  PwSelectComponent,
  type PwSelectOption,
} from '../../../../shared/ui/pw-select.component';
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

type SelectOption = PwSelectOption;

/**
 * Managing company_work organization_ref select.
 * Emits UUID | null for direction/department/position; catalog name | null for
 * work_format / employment_type. Cascade clears sibling org ids via answersPatch.
 */
@Component({
  selector: 'loom-questionnaire-organization-ref-field',
  standalone: true,
  imports: [PwSelectComponent],
  template: `
    <div class="field" [attr.data-field-key]="field.key">
      <label>{{ field.label }}</label>
      @if (field.helpText) {
        <p class="help">{{ field.helpText }}</p>
      }
      @if (loadError) {
        <p class="field-error" role="alert">{{ loadError }}</p>
      }
      <loom-pw-select
        [value]="selectModel"
        [options]="selectOptions"
        [disabled]="disabled || !catalog"
        placeholder="—"
        (valueChange)="onSelect($event)"
      />
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
  /** Empty→null row first, then orphan (if any), then catalog options. */
  selectOptions: SelectOption[] = [{ value: '', label: '—' }];

  private sub: Subscription | null = null;

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
      this.syncSelectOptions();
      return;
    }

    if (entity === 'work_format') {
      this.options = namedOptions(this.catalog.workFormats);
      this.orphanOption = orphanNamed(current, this.options);
      this.syncSelectOptions();
      return;
    }
    if (entity === 'employment_type') {
      this.options = namedOptions(this.catalog.employmentTypes);
      this.orphanOption = orphanNamed(current, this.options);
      this.syncSelectOptions();
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
    this.syncSelectOptions();
  }

  /** Empty→null row first, then orphan (if present), then catalog options. */
  private syncSelectOptions(): void {
    this.selectOptions = [
      { value: '', label: '—' },
      ...(this.orphanOption ? [this.orphanOption] : []),
      ...this.options,
    ];
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
