import { AbsenceRequestStatusGroup } from '../core/api/models';

export {
  notificationFrameTone,
} from '../../../core/notifications/notification-frame';

/** Visual frame tone for request cards/rows/notifications (presentation only). */
export type RequestFrameTone =
  | 'pending'
  | 'approved'
  | 'completed'
  | 'rejected'
  | 'neutral';

/**
 * Maps domain status → frame tone.
 * Single entry for list/card framing: keep rules here, not in templates.
 *
 * Default: deletion_requested keeps the green approved frame (still agreed),
 * while the badge stays red via data-status.
 * `completed` (approved period already ended) uses a muted completed tone.
 */
export function requestFrameTone(
  statusGroup: AbsenceRequestStatusGroup | string | null | undefined,
  options?: {
    /** Calendar days flag on an otherwise approved segment. */
    deletionRequested?: boolean;
    /**
     * Frame for deletion cases.
     * Lists default to `approved`; calendar day cards use `rejected`.
     */
    deletionFrame?: 'approved' | 'rejected';
    /**
     * Calendar: approved absence whose periodEnd is already before today.
     * Maps to completed frame (unless deletion takes priority).
     */
    periodEnded?: boolean;
  },
): RequestFrameTone {
  const deletionFrame = options?.deletionFrame ?? 'approved';
  if (options?.deletionRequested || statusGroup === 'deletion_requested') {
    return deletionFrame;
  }
  if (options?.periodEnded || statusGroup === 'completed') {
    return 'completed';
  }
  switch (statusGroup) {
    case 'pending':
      return 'pending';
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    default:
      return 'neutral';
  }
}
