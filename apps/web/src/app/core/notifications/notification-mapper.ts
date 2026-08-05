import { AppNotification } from './notification.models';

/** Raw notification shape from GET /notifications (entity + payload). */
export type RawNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string | Date;
  payload?: Record<string, unknown> | null;
  relatedRequestId?: string | null;
  relatedAssignmentId?: string | null;
};

function asId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function mapRawNotification(raw: RawNotification): AppNotification {
  const payload = raw.payload ?? null;
  const relatedRequestId =
    asId(raw.relatedRequestId) ?? asId(payload?.['requestId']);
  const relatedAssignmentId =
    asId(raw.relatedAssignmentId) ?? asId(payload?.['assignmentId']);

  return {
    id: raw.id,
    type: raw.type,
    title: raw.title,
    body: raw.body,
    relatedRequestId,
    relatedAssignmentId,
    isRead: !!raw.isRead,
    createdAt:
      typeof raw.createdAt === 'string'
        ? raw.createdAt
        : new Date(raw.createdAt).toISOString(),
  };
}
