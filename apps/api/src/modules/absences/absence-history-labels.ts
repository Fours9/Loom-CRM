/** Ukrainian history copy for absence request audit actions (PW parity). */
const HISTORY_ACTION_LABELS_UK: Record<string, string> = {
  created: 'Створено заявку',
  updated: 'Оновлено заявку',
  cancelled: 'Заявку скасовано',
  approved: 'Заявку затверджено',
  rejected: 'Заявку відхилено',
  adjusted: 'Скориговано заявку',
  deletion_requested: 'Подано запит на видалення',
  deletion_rejected: 'Запит на видалення відхилено',
};

export function absenceHistoryActionLabel(action: string): string {
  return HISTORY_ACTION_LABELS_UK[action] ?? action;
}
