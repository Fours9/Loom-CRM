import type { HelpDomainBundle, HelpStep, HelpTourDefinition } from '../../../core/help/help-tour.models';
import { helpTour } from '../../../layouts/help/help-tour.factory';

function steps(
  id: string,
  title: string,
  intro: string,
  extra: readonly HelpStep[],
): HelpTourDefinition {
  return helpTour(id, title, intro, extra);
}

/** Copy SoT for Positions help tours. */
export const POSITIONS_HELP_BUNDLE: HelpDomainBundle = {
  tours: [
    steps(
      'positions.management',
      'Керування посадами',
      'Каталог організаційної структури: напрямки, відділи, посади. Оберіть посаду, щоб редагувати навички, цілі й обовʼязки.',
      [
        {
          id: 'positions.management__tree',
          title: 'Дерево структури',
          body: 'Розгортайте напрямки й відділи, обирайте посаду. Додавання й редагування довідників — кнопками в панелях (діалоги відкриваються з видимих дій).',
          anchorId: 'positions.tree',
        },
        {
          id: 'positions.management__page',
          title: 'Вкладки екрана',
          body: '«Керування посадами» — структура й каталог посади. «Формати» — окремі довідники форматів роботи й типів зайнятості.',
          anchorId: 'positions.management',
        },
        {
          id: 'positions.management__tip',
          title: 'Без вибору',
          body: 'Поки посаду не обрано, деталі навичок/цілей/обовʼязків не показуються. Після вибору підказка «?» перемикається на активну підвкладку каталогу.',
        },
      ],
    ),
    steps(
      'positions.formats',
      'Формати',
      'Довідники форматів роботи та типів зайнятості — окремо від дерева посад. Навіть якщо посада лишилась обраною в «Керуванні», цей режим показує формати.',
      [
        {
          id: 'positions.formats__list',
          title: 'Списки довідників',
          body: 'Керуйте форматами роботи й типами зайнятості: додавайте й редагуйте записи з видимих кнопок у панелях.',
          anchorId: 'positions.formats.list',
        },
        {
          id: 'positions.formats__region',
          title: 'Режим «Формати»',
          body: 'Ця вкладка не змінює навички обраної посади — лише довідники, які потім обирають у призначеннях працівників.',
          anchorId: 'positions.formats',
        },
      ],
    ),
    steps(
      'positions.position.skills',
      'Навички посади',
      'Очікувані навички обраної посади. Зміни в діалозі редагування посади, не окремим «туром діалогу».',
      [
        {
          id: 'positions.position.skills__body',
          title: 'Список навичок',
          body: 'Переглядайте вимоги посади. Додати чи змінити набір — через «Редагувати» посаду (видима кнопка в панелі деталей).',
          anchorId: 'positions.catalog.skills',
        },
        {
          id: 'positions.position.skills__tip',
          title: 'Підвкладки',
          body: 'Поруч — «Цілі» та «Обовʼязки» тієї ж посади. У меню «?» підказка відповідає активній підвкладці.',
        },
      ],
    ),
    steps(
      'positions.position.goals',
      'Цілі посади',
      'Шаблони цілей для обраної посади (карʼєра, випробувальний, квартальні тощо).',
      [
        {
          id: 'positions.position.goals__body',
          title: 'Шаблони цілей',
          body: 'Додавайте шаблон формою вище (якщо є права) або прибирайте зайві з кнопок у списку. Діалоги довідників відкриваються лише з видимих дій.',
          anchorId: 'positions.catalog.goals',
        },
      ],
    ),
    steps(
      'positions.position.duties',
      'Обовʼязки посади',
      'Обовʼязки обраної посади — опис робіт для профілю й онбордингу.',
      [
        {
          id: 'positions.position.duties__body',
          title: 'Список обовʼязків',
          body: 'Додавайте обовʼязок формою (за наявності прав) або видаляйте з списку. Це шаблон посади, не персональні завдання працівника.',
          anchorId: 'positions.catalog.duties',
        },
      ],
    ),
  ],
};
