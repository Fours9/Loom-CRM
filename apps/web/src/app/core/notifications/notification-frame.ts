/** Visual frame tone for inbox notification rows (presentation only). */
export type NotificationFrameTone =
  | 'pending'
  | 'approved'
  | 'completed'
  | 'rejected'
  | 'neutral';

/**
 * Loom absences historically emit `absence.request.*`; PW uses `request.*`.
 * Normalize so frame tones match either source (including rows already in DB).
 */
export function normalizeNotificationType(
  notificationType: string | null | undefined,
): string {
  if (!notificationType) return '';
  return notificationType.startsWith('absence.')
    ? notificationType.slice('absence.'.length)
    : notificationType;
}

/**
 * Maps notification.type → frame tones used by the shell inbox.
 */
export function notificationFrameTone(
  notificationType: string | null | undefined,
): NotificationFrameTone {
  switch (normalizeNotificationType(notificationType)) {
    case 'request.approved':
      return 'approved';
    case 'request.rejected':
    case 'request.deletion_requested':
    case 'request.deletion_approved':
      return 'rejected';
    case 'request.deletion_rejected':
      return 'approved';
    case 'request.updated':
    case 'request.adjusted':
    case 'request.created':
    case 'request.submitted':
      return 'pending';
    case 'questionnaire.changes_requested':
      return 'pending';
    case 'questionnaire.changes_completed':
      return 'completed';
    case 'questionnaire.changes_declined':
      return 'rejected';
    default:
      return 'neutral';
  }
}
