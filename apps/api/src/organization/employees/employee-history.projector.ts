import { summarizeEmployeeHistoryAction } from './employee-history.labels';

export type HistoryActor = {
  userId: string;
  label: string;
};

export type HistoryItem = {
  id: string;
  action: string;
  summary: string;
  actor: HistoryActor | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

export type HistoryAuditLogInput = {
  id: string;
  action: string;
  actorUserId: string | null;
  createdAt: Date;
};

/**
 * Project audit row → API history item.
 * `redactedMetadata` must already be privacy-filtered; never interpolated into summary.
 */
export function projectEmployeeHistoryItem(input: {
  auditLog: HistoryAuditLogInput;
  actor: HistoryActor | null;
  redactedMetadata: Record<string, unknown> | null;
}): HistoryItem {
  return {
    id: input.auditLog.id,
    action: input.auditLog.action,
    summary: summarizeEmployeeHistoryAction(input.auditLog.action),
    actor: input.actor,
    createdAt: input.auditLog.createdAt.toISOString(),
    metadata: input.redactedMetadata,
  };
}

/** Resolve actor label from batch maps (current display names, not historical snapshot). */
export function resolveHistoryActorLabel(input: {
  actorUserId: string | null;
  usersById: Map<string, { email: string }>;
  employeesByUserId: Map<string, { fullName: string }>;
}): HistoryActor | null {
  const userId = input.actorUserId;
  if (!userId) return null;

  const user = input.usersById.get(userId);
  if (!user) {
    return { userId, label: 'Видалений користувач' };
  }

  const employee = input.employeesByUserId.get(userId);
  if (employee?.fullName) {
    return { userId, label: employee.fullName };
  }

  return { userId, label: user.email };
}
