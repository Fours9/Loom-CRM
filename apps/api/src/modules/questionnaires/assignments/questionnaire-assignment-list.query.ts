import { SelectQueryBuilder } from 'typeorm';
import type {
  QuestionnaireAssignmentStatus,
  QuestionnaireAttachmentState,
  QuestionnaireDirectorySortBy,
  QuestionnaireType,
} from '@loom/contracts-questionnaires';
import { QuestionnaireAssignment } from '../questionnaire-assignment.entity';
import { ATTACHED_STATUSES } from './questionnaire-assignment-attachment-state';
import { escapeIlikePattern } from './questionnaire-assignment-code';

export type QuestionnaireDirectoryScope =
  | { kind: 'all'; includeUnattached: true }
  | { kind: 'self'; userId: string; includeUnattached: false }
  | {
      kind: 'departments_and_self';
      departmentIds: string[];
      userId: string;
      includeUnattached: false;
    };

/** Filters shared by directory and employee-scoped lists. */
export type QuestionnaireAssignmentCommonFilters = {
  code?: string;
  templateType?: QuestionnaireType;
  status?: QuestionnaireAssignmentStatus;
  attachmentState?: QuestionnaireAttachmentState;
  createdFrom?: string;
  createdTo?: string;
};

export type QuestionnaireDirectoryFilters = QuestionnaireAssignmentCommonFilters & {
  departmentId?: string;
  positionId?: string;
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

  qb.andWhere('a.employee_id IS NOT NULL');

  if (scope.kind === 'self') {
    qb.andWhere('emp.user_id = :scopeUserId', { scopeUserId: scope.userId });
    return;
  }
  if (scope.departmentIds.length) {
    qb.andWhere(
      '(emp.department_id IN (:...scopeDeptIds) OR emp.user_id = :scopeUserId)',
      {
        scopeDeptIds: scope.departmentIds,
        scopeUserId: scope.userId,
      },
    );
  } else {
    qb.andWhere('emp.user_id = :scopeUserId', { scopeUserId: scope.userId });
  }
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
  if (filters.templateType) {
    qb.andWhere('tmpl.type = :templateType', {
      templateType: filters.templateType,
    });
  }
  if (filters.status) {
    qb.andWhere('a.status = :filterStatus', { filterStatus: filters.status });
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

  if (!includeAttachmentState || !filters.attachmentState) return;

  if (filters.attachmentState === 'closed') {
    qb.andWhere('a.status = :closedStatus', { closedStatus: 'closed' });
  } else if (filters.attachmentState === 'detached') {
    qb.andWhere('a.status = :cancelledStatus', { cancelledStatus: 'cancelled' });
  } else if (filters.attachmentState === 'new') {
    qb.andWhere('a.status = :newStatus', { newStatus: 'new' });
  } else if (filters.attachmentState === 'attached') {
    qb.andWhere('a.status IN (:...attachedStatuses)', {
      attachedStatuses: [...ATTACHED_STATUSES],
    });
  }
}

/** @deprecated Prefer applyAssignmentFilters + directory-only dept/pos. */
export function applyDirectoryFilters(
  qb: SelectQueryBuilder<QuestionnaireAssignment>,
  filters: QuestionnaireDirectoryFilters,
): void {
  if (filters.departmentId) {
    qb.andWhere('emp.department_id = :departmentId', {
      departmentId: filters.departmentId,
    });
  }
  if (filters.positionId) {
    qb.andWhere('emp.position_id = :positionId', {
      positionId: filters.positionId,
    });
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
