import { ABSENCE_STATUS_LABELS, ABSENCE_TYPE_LABELS } from './labels';
import {
  AbsenceRequestHistoryItem,
  AbsenceRequestListItem,
  AbsenceRequestStatus,
  AbsenceType,
} from './models';

/** Display-only short code from UUID. Never use for API/router lookup. */
export function shortRequestId(id: string | null | undefined): string {
  if (!id) {
    return '—';
  }
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function requestTypeLabel(type: AbsenceType | string | null | undefined): string {
  if (!type) {
    return 'Відсутність';
  }
  return ABSENCE_TYPE_LABELS[type] ?? type;
}

export function requestStatusLabel(status: string): string {
  return ABSENCE_STATUS_LABELS[status] ?? status;
}

/** Fully formatted absence period for UI (uk-UA dates). */
export function requestPeriod(
  request: Pick<
    AbsenceRequestListItem,
    'startDate' | 'endDate' | 'absenceStartTime' | 'absenceEndTime'
  >,
): string {
  const start = formatYmd(request.startDate);
  const endRaw = request.endDate ?? request.startDate;
  const end = formatYmd(endRaw);
  const hasTime = Boolean(request.absenceStartTime || request.absenceEndTime);

  if (hasTime) {
    const from = request.absenceStartTime ?? '…';
    const to = request.absenceEndTime ?? '…';
    return `${start}, ${from}–${to}`;
  }

  if (request.startDate === endRaw) {
    return start;
  }
  return `${start}–${end}`;
}

export function requestEventAt(
  request: Pick<
    AbsenceRequestListItem,
    'statusGroup' | 'createdAt' | 'decidedAt' | 'deletionRequestedAt'
  >,
): string | null {
  if (request.statusGroup === 'deletion_requested') {
    return request.deletionRequestedAt || request.createdAt || null;
  }
  if (
    request.statusGroup === 'approved' ||
    request.statusGroup === 'completed' ||
    request.statusGroup === 'rejected'
  ) {
    return request.decidedAt || request.createdAt || null;
  }
  return request.createdAt || null;
}

export function requestEventLabel(
  request: Pick<
    AbsenceRequestListItem,
    'statusGroup' | 'createdAt' | 'decidedAt' | 'deletionRequestedAt'
  >,
): string {
  const whenIso = requestEventAt(request);
  const when = whenIso ? formatDateTime(whenIso) : '—';
  switch (request.statusGroup) {
    case 'deletion_requested':
      return `Запит на видалення · ${when}`;
    case 'completed':
      return `Завершено · ${when}`;
    case 'approved':
      return `Затверджено · ${when}`;
    case 'rejected':
      return `Відхилено · ${when}`;
    default:
      return `Подано · ${when}`;
  }
}

export type HistoryTone = 'neutral' | 'success' | 'warning' | 'danger';

/**
 * Presentation tone for history rows.
 * Prefer status fields; description text is a temporary fallback.
 * TODO: replace when history.eventType exists.
 */
export function historyTone(history: AbsenceRequestHistoryItem): HistoryTone {
  const byStatus = toneFromStatus(history.toStatus) ?? toneFromStatus(history.fromStatus);
  if (byStatus) {
    return byStatus;
  }

  // TODO: replace when history.eventType exists — temporary presentation fallback
  const text = (history.changeDescription || '').toLowerCase();
  if (text.includes('затверджено')) return 'success';
  if (text.includes('відхилено')) return 'danger';
  if (text.includes('запит на видалення') || text.includes('видален')) return 'warning';
  return 'neutral';
}

function toneFromStatus(status: AbsenceRequestStatus | null | undefined): HistoryTone | null {
  if (!status) return null;
  switch (status) {
    case 'approved':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'cancelled':
      // Soft-withdrawn — muted/neutral (same family as completed badge), not danger.
      return 'neutral';
    case 'deletion_requested':
      return 'warning';
    case 'pending':
      return 'neutral';
    default:
      return null;
  }
}

function formatYmd(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) {
    return ymd;
  }
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy}, ${hh}:${min}`;
}
