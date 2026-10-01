import type { HelpCalloutDefinition, HelpDomainBundle } from '../../../core/help/help-tour.models';

/** Single SoT for questionnaire lifecycle help (callout + tours). */
export const QUESTIONNAIRE_LIFECYCLE_BLURB =
  'Відкріплення не видаляє анкету. Відкріплену анкету можна знову закріпити за доступним працівником, у тому числі за іншим. Заповнені відповіді зберігаються; після наступного надсилання пропозиції змін формуються для поточного працівника.';

export const QUESTIONNAIRE_LIFECYCLE_CALLOUT: HelpCalloutDefinition = {
  id: 'questionnaire.lifecycle',
  version: 2,
  body: QUESTIONNAIRE_LIFECYCLE_BLURB,
};

export const QUESTIONNAIRE_PROPOSALS_HINT =
  'Після надсилання або закриття зміни потрапляють у «Запропоновані зміни» і застосовуються до профілю лише після прийняття.';

export const QUESTIONNAIRE_HELP_BUNDLE: HelpDomainBundle = {
  tours: [
    {
      id: 'questionnaires.directory',
      steps: [
        {
          id: 'dir-create',
          title: 'Створити анкету',
          body: 'Створює нове призначення. Працівника можна вказати одразу або закріпити пізніше.',
          anchorId: 'q.create',
        },
        {
          id: 'dir-attach',
          title: 'Закріпити',
          body: 'Прив’язує незакріплену або відкріплену анкету до працівника з вашого доступу.',
          anchorId: 'q.attach',
        },
        {
          id: 'dir-attachment-filter',
          title: 'Фільтр стану',
          body: 'Фільтрує список за станом закріплення: нова, прикріплена, відкріплена, закрита.',
          anchorId: 'q.attachment-filter',
        },
        {
          id: 'dir-lifecycle',
          title: 'Життєвий цикл',
          body: QUESTIONNAIRE_LIFECYCLE_BLURB,
        },
      ],
    },
    {
      id: 'questionnaires.employee',
      steps: [
        {
          id: 'emp-open',
          title: 'Відкрити анкету',
          body: 'Відкриває заповнення або перегляд відповідей.',
          anchorId: 'q.open',
        },
        {
          id: 'emp-more',
          title: 'Додаткові дії',
          body: 'У меню «⋮» знаходяться додаткові дії:\nдрук, а залежно від стану анкети та ваших прав — відкріплення, закриття або видалення.',
          anchorId: 'q.more',
        },
        {
          id: 'emp-lifecycle',
          title: 'Відкріплення',
          body: QUESTIONNAIRE_LIFECYCLE_BLURB,
        },
      ],
    },
    {
      id: 'questionnaires.fill',
      steps: [
        {
          id: 'fill-edit',
          title: 'Редагувати',
          body: 'Відкриває анкету для змін (якщо є права й стан дозволяє).',
          anchorId: 'q.edit',
        },
        {
          id: 'fill-request',
          title: 'Запросити зміни',
          body: 'Надсилає власнику запит на доопрацювання з коментарем.',
          anchorId: 'q.request-changes',
        },
        {
          id: 'fill-more',
          title: 'Додаткові дії',
          body: 'У меню «⋮» — роздрукувати PDF і, за потреби, видалити анкету.',
          anchorId: 'q.more',
        },
        {
          id: 'fill-proposals',
          title: 'Пропозиції змін',
          body: QUESTIONNAIRE_PROPOSALS_HINT,
        },
      ],
    },
  ],
  callouts: [QUESTIONNAIRE_LIFECYCLE_CALLOUT],
};
