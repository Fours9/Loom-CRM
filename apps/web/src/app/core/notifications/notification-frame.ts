/** Visual frame tone for inbox notification rows (presentation only). */
export type NotificationFrameTone =
  | 'pending'
  | 'approved'
  | 'completed'
  | 'rejected'
  | 'neutral';

/**
 * Maps notification.type → frame tones used by the shell inbox.
 */
export function notificationFrameTone(
  notificationType: string | null | undefined,
): NotificationFrameTone {
  switch (notificationType) {
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
    default:
      return 'neutral';
  }
}
