import type {
  OrganizationEntityKind,
  QuestionnaireContext,
  QuestionnaireSchemaField,
} from '@loom/contracts-questionnaires';
import type { OrganizationCatalogSnapshot } from '../../../../core/api/organization-catalog-api.service';

export type OrganizationReviewLabelMode = 'draft' | 'historical';

/**
 * Draft Review may use live catalog; historical Review uses frozen
 * submission.context_json names only (ADR 0010).
 */
export function resolveOrganizationReviewLabel(input: {
  field: QuestionnaireSchemaField;
  value: unknown;
  historicalContext: QuestionnaireContext | null;
  liveCatalog: OrganizationCatalogSnapshot | null;
  mode: OrganizationReviewLabelMode;
}): string {
  const { value } = input;
  if (value === null || value === undefined || value === '') return '—';
  const entity = input.field.organizationEntity as
    | OrganizationEntityKind
    | undefined;
  if (!entity) return String(value);

  if (entity === 'work_format' || entity === 'employment_type') {
    return typeof value === 'string' ? value : String(value);
  }

  if (typeof value !== 'string') return String(value);

  if (input.mode === 'historical') {
    const catalog = input.historicalContext?.positionCatalog;
    if (!catalog) return value;
    if (entity === 'direction' && catalog.directionId === value) {
      return catalog.directionName ?? value;
    }
    if (entity === 'department' && catalog.departmentId === value) {
      return catalog.departmentName ?? value;
    }
    if (entity === 'position' && catalog.positionId === value) {
      return catalog.positionName ?? value;
    }
    return value;
  }

  const live = input.liveCatalog;
  if (!live) return value;
  if (entity === 'direction') {
    return live.directions.find((d) => d.id === value)?.name ?? value;
  }
  if (entity === 'department') {
    return live.departments.find((d) => d.id === value)?.name ?? value;
  }
  if (entity === 'position') {
    return live.positions.find((p) => p.id === value)?.name ?? value;
  }
  return value;
}
