export type AbsenceSidePanelId = 'schedule' | 'comment' | 'requests';

export const ABSENCE_SIDE_PANEL_LABELS: Record<AbsenceSidePanelId, string> = {
  schedule: 'Графік',
  comment: 'Коментар',
  requests: 'Заявки',
};

export function absenceSidePanelLabel(id: AbsenceSidePanelId): string {
  return ABSENCE_SIDE_PANEL_LABELS[id] ?? id;
}

/**
 * Deterministic side-panel resolution.
 * comment + !canViewComment → schedule.
 */
export function resolveAbsenceSidePanel(
  requested: AbsenceSidePanelId,
  canViewComment: boolean,
): AbsenceSidePanelId {
  if (requested === 'comment' && !canViewComment) return 'schedule';
  return requested;
}
