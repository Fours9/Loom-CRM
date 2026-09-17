import {
  EMPLOYEE_OWNER_VISIBLE_QUESTIONNAIRE_TYPES,
  QUESTIONNAIRE_TYPE_CATALOG,
  type QuestionnaireAssignmentStatus,
  type QuestionnaireAttachmentState,
  type QuestionnaireType,
} from '@loom/contracts-questionnaires';

export const QUESTIONNAIRE_TYPE_LABELS = {
  full: QUESTIONNAIRE_TYPE_CATALOG.full.labelUa,
  managing: QUESTIONNAIRE_TYPE_CATALOG.managing.labelUa,
  docs: QUESTIONNAIRE_TYPE_CATALOG.docs.labelUa,
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

export function questionnaireTypeDescription(type: string): string {
  const entry = QUESTIONNAIRE_TYPE_CATALOG[type as QuestionnaireType];
  return entry?.descriptionUa ?? '';
}

/** @deprecated Prefer template-code grants from /auth/me / role Settings. */
export function isEmployeeOwnerVisibleType(type: string): boolean {
  return (EMPLOYEE_OWNER_VISIBLE_QUESTIONNAIRE_TYPES as readonly string[]).includes(
    type,
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
