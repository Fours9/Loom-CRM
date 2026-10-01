export type PositionPageTabId = 'management' | 'settings';

export type PositionCatalogTabId = 'skills' | 'goals' | 'duties';

export const POSITION_PAGE_TAB_LABELS: Record<PositionPageTabId, string> = {
  management: 'Керування посадами',
  settings: 'Формати',
};

export const POSITION_CATALOG_TAB_LABELS: Record<PositionCatalogTabId, string> = {
  skills: 'Навички',
  goals: 'Цілі',
  duties: 'Обовʼязки',
};

export function positionPageTabLabel(id: PositionPageTabId): string {
  return POSITION_PAGE_TAB_LABELS[id] ?? id;
}

export function positionCatalogTabLabel(id: PositionCatalogTabId): string {
  return POSITION_CATALOG_TAB_LABELS[id] ?? id;
}
