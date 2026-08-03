import type {
  QuestionnaireAssignmentStatus,
  QuestionnaireAttachmentState,
  QuestionnaireType,
} from '@loom/contracts-questionnaires';

export const QUESTIONNAIRE_TYPE_LABELS = {
  general: 'Загальна',
  hr: 'HR',
  manager: 'Менеджер',
  full: 'Повна',
} satisfies Record<QuestionnaireType, string>;

export const QUESTIONNAIRE_STATUS_LABELS = {
  new: 'Нова',
  assigned: 'Призначено',
  in_progress: 'В процесі',
  submitted: 'Надіслано',
  changes_requested: 'Потрібні зміни',
  reviewed: 'Переглянуто',
  cancelled: 'Відкріплено',
  closed: 'Закрито',
} satisfies Record<QuestionnaireAssignmentStatus, string>;

export const QUESTIONNAIRE_ATTACHMENT_LABELS = {
  new: 'Нова',
  attached: 'Прикріплено',
  detached: 'Відкріплено',
  closed: 'Закрито',
} satisfies Record<QuestionnaireAttachmentState, string>;

export function questionnaireTypeLabel(type: string): string {
  return (
    QUESTIONNAIRE_TYPE_LABELS[type as QuestionnaireType] ?? type
  );
}

export function questionnaireStatusLabel(status: string): string {
  return (
    QUESTIONNAIRE_STATUS_LABELS[status as QuestionnaireAssignmentStatus] ??
    status
  );
}

export function questionnaireAttachmentLabel(state: string): string {
  return (
    QUESTIONNAIRE_ATTACHMENT_LABELS[
      state as QuestionnaireAttachmentState
    ] ?? state
  );
}
