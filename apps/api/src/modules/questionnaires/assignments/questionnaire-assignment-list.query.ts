import { SelectQueryBuilder } from 'typeorm';
import {
  type QuestionnaireAssignmentStatus,
  type QuestionnaireAttachmentState,
  type QuestionnaireDirectorySortBy,
  type QuestionnaireType,
} from '@loom/contracts-questionnaires';
import { QuestionnaireAssignment } from '../questionnaire-assignment.entity';
import { ATTACHED_STATUSES } from './questionnaire-assignment-attachment-state';
import { escapeIlikePattern } from './questionnaire-assignment-code';

export type QuestionnaireDirectoryScope =
  | { kind: 'all' }
  | {
      kind: 'self';
      userId: string;
    }
  | {
      kind: 'departments_and_self';
      departmentIds: string[];
      userId: string;
      /** Include status=new with both employee ids null (Assign∨Lifecycle∨Delete pool). */
      includeNewUnattached: boolean;
    };

/** Filters shared by directory and employee-scoped lists. */
export type QuestionnaireAssignmentCommonFilters = {
  code?: string;
  templateType?: QuestionnaireType;
  templateTypes?: QuestionnaireType[];
  status?: QuestionnaireAssignmentStatus;
  statuses?: QuestionnaireAssignmentStatus[];
  attachmentState?: QuestionnaireAttachmentState;
  attachmentStates?: QuestionnaireAttachmentState[];
  createdFrom?: string;
  createdTo?: string;
};

export type QuestionnaireDirectoryFilters = QuestionnaireAssignmentCommonFilters & {
  departmentId?: string;
  positionId?: string;
  departmentIds?: string[];
  positionIds?: string[];
  sortBy?: QuestionnaireDirectorySortBy;
  sortDir?: 'asc' | 'desc';
  limit: number;
  offset: number;
};

/** Inclusive calendar date → [start, nextDay) in UTC date parts. */
export function createdAtRangeBounds(input: {
  createdFrom?: string;
  createdTo?: string;
}): { fromStart?: Date; toExclusive?: Date } {
  const out: { fromStart?: Date; toExclusive?: Date } = {};
  if (input.createdFrom) {
    const d = input.createdFrom.slice(0, 10);
    out.fromStart = new Date(`${d}T00:00:00.000Z`);
  }
  if (input.createdTo) {
    const d = input.createdTo.slice(0, 10);
    const start = new Date(`${d}T00:00:00.000Z`);
    out.toExclusive = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  }
  return out;
}

export function applyDirectoryScope(
  qb: SelectQueryBuilder<QuestionnaireAssignment>,
  scope: QuestionnaireDirectoryScope,
): void {
  if (scope.kind === 'all') return;

  if (scope.kind === 'self') {
    qb.andWhere('a.employee_id IS NOT NULL');
    qb.andWhere('emp.user_id = :scopeUserId', { scopeUserId: scope.userId });
    return;
  }

  // departments_and_self (+ optional new pool + cancelled via detached employee)
  const deptClause =
    scope.departmentIds.length > 0
      ? '(detached_emp.department_id IN (:...scopeDeptIds) OR detached_emp.user_id = :scopeUserId)'
      : 'detached_emp.user_id = :scopeUserId';
  const empClause =
    scope.departmentIds.length > 0
      ? '(emp.department_id IN (:...scopeDeptIds) OR emp.user_id = :scopeUserId)'
      : 'emp.user_id = :scopeUserId';

  const params: Record<string, unknown> = { scopeUserId: scope.userId };
  if (scope.departmentIds.length) {
    params.scopeDeptIds = scope.departmentIds;
  }

  const parts = [
    `(a.employee_id IS NOT NULL AND ${empClause})`,
    `(a.status = 'cancelled' AND a.employee_id IS NULL AND a.detached_from_employee_id IS NOT NULL AND ${deptClause})`,
  ];
  if (scope.includeNewUnattached) {
    parts.push(
      `(a.status = 'new' AND a.employee_id IS NULL AND a.detached_from_employee_id IS NULL)`,
    );
  }

  qb.andWhere(`(${parts.join(' OR ')})`, params);
}

export function applyEmployeeScope(
  qb: SelectQueryBuilder<QuestionnaireAssignment>,
  employeeId: string,
): void {
  qb.andWhere('a.employee_id = :employeeId', { employeeId });
  qb.andWhere('a.status != :cancelledStatus', { cancelledStatus: 'cancelled' });
}

export function applyAssignmentFilters(
  qb: SelectQueryBuilder<QuestionnaireAssignment>,
  filters: QuestionnaireAssignmentCommonFilters,
  options?: { includeAttachmentState?: boolean },
): void {
  const includeAttachmentState = options?.includeAttachmentState !== false;

  const code = filters.code?.trim();
  if (code) {
    qb.andWhere(`a.code ILIKE :codePattern ESCAPE '\\'`, {
      codePattern: `${escapeIlikePattern(code)}%`,
    });
  }

  const templateTypes = [
    ...new Set(
      [
        ...(filters.templateTypes ?? []),
        ...(filters.templateType ? [filters.templateType] : []),
      ].filter(Boolean),
    ),
  ] as QuestionnaireType[];
  if (templateTypes.length === 1) {
    qb.andWhere('tmpl.type = :templateType', {
      templateType: templateTypes[0],
    });
  } else if (templateTypes.length > 1) {
    qb.andWhere('tmpl.type IN (:...templateTypes)', { templateTypes });
  }

  const statuses = [
    ...new Set(
      [
        ...(filters.statuses ?? []),
        ...(filters.status ? [filters.status] : []),
      ].filter(Boolean),
    ),
  ] as QuestionnaireAssignmentStatus[];
  if (statuses.length === 1) {
    qb.andWhere('a.status = :filterStatus', { filterStatus: statuses[0] });
  } else if (statuses.length > 1) {
    qb.andWhere('a.status IN (:...filterStatuses)', {
      filterStatuses: statuses,
    });
  }

  const range = createdAtRangeBounds(filters);
  if (range.fromStart) {
    qb.andWhere('a.created_at >= :createdFrom', {
      createdFrom: range.fromStart,
    });
  }
  if (range.toExclusive) {
    qb.andWhere('a.created_at < :createdToExclusive', {
      createdToExclusive: range.toExclusive,
    });
  }

  if (!includeAttachmentState) return;

  const attachmentStates = [
    ...new Set(
      [
        ...(filters.attachmentStates ?? []),
        ...(filters.attachmentState ? [filters.attachmentState] : []),
      ].filter(Boolean),
    ),
  ] as QuestionnaireAttachmentState[];
  if (!attachmentStates.length) return;

  const parts: string[] = [];
  const params: Record<string, unknown> = {};
  if (attachmentStates.includes('closed')) {
    parts.push(`a.status = :attClosed`);
    params.attClosed = 'closed';
  }
  if (attachmentStates.includes('detached')) {
    parts.push(`a.status = :attDetached`);
    params.attDetached = 'cancelled';
  }
  if (attachmentStates.includes('new')) {
    parts.push(`a.status = :attNew`);
    params.attNew = 'new';
  }
  if (attachmentStates.includes('attached')) {
    parts.push(`a.status IN (:...attAttached)`);
    params.attAttached = [...ATTACHED_STATUSES];
  }
  if (parts.length === 1) {
    qb.andWhere(parts[0], params);
  } else if (parts.length > 1) {
    qb.andWhere(`(${parts.join(' OR ')})`, params);
  }
}

/** @deprecated Prefer applyAssignmentFilters + directory-only dept/pos. */
export function applyDirectoryFilters(
  qb: SelectQueryBuilder<QuestionnaireAssignment>,
  filters: QuestionnaireDirectoryFilters,
): void {
  const departmentIds = [
    ...new Set(
      [
        ...(filters.departmentIds ?? []),
        ...(filters.departmentId ? [filters.departmentId] : []),
      ].filter(Boolean),
    ),
  ];
  const positionIds = [
    ...new Set(
      [
        ...(filters.positionIds ?? []),
        ...(filters.positionId ? [filters.positionId] : []),
      ].filter(Boolean),
    ),
  ];

  if (departmentIds.length === 1) {
    qb.andWhere('emp.department_id = :departmentId', {
      departmentId: departmentIds[0],
    });
  } else if (departmentIds.length > 1) {
    qb.andWhere('emp.department_id IN (:...departmentIds)', { departmentIds });
  }

  if (positionIds.length === 1) {
    qb.andWhere('emp.position_id = :positionId', {
      positionId: positionIds[0],
    });
  } else if (positionIds.length > 1) {
    qb.andWhere('emp.position_id IN (:...positionIds)', { positionIds });
  }

  applyAssignmentFilters(qb, filters, { includeAttachmentState: true });
}

export function applyDirectorySort(
  qb: SelectQueryBuilder<QuestionnaireAssignment>,
  sortBy: QuestionnaireDirectorySortBy = 'createdAt',
  sortDir: 'asc' | 'desc' = 'desc',
): void {
  const dir = sortDir.toUpperCase() as 'ASC' | 'DESC';
  switch (sortBy) {
    case 'employeeName':
      qb.orderBy('emp.last_name', dir, 'NULLS LAST').addOrderBy(
        'emp.first_name',
        dir,
        'NULLS LAST',
      );
      break;
    case 'departmentName':
      qb.orderBy('dept.name', dir, 'NULLS LAST');
      break;
    case 'positionName':
      qb.orderBy('pos.name', dir, 'NULLS LAST');
      break;
    case 'templateCode':
      qb.orderBy('tmpl.code', dir);
      break;
    case 'status':
      qb.orderBy('a.status', dir);
      break;
    case 'updatedAt':
      qb.orderBy(
        'GREATEST(a.updated_at, COALESCE(resp.updated_at, a.created_at))',
        dir,
      );
      break;
    case 'createdAt':
    default:
      qb.orderBy('a.created_at', dir);
      break;
  }
  qb.addOrderBy('a.id', 'ASC');
}
