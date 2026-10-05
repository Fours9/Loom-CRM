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

function dialogFieldTour(
  id: string,
  title: string,
  intro: string,
  fields: readonly { suffix: string; title: string; body: string; anchor: string }[],
): HelpTourDefinition {
  // helpTour already adds a copy-only intro — do not append a second «Про форму» with the same body.
  return helpTour(
    id,
    title,
    intro,
    fields.map((f) => ({
      id: `${id}__${f.suffix}`,
      title: f.title,
      body: f.body,
      anchorId: f.anchor,
    })),
  );
}

/** Copy SoT for Positions help tours. */
export const POSITIONS_HELP_BUNDLE: HelpDomainBundle = {
  tours: [
    steps(
      'positions.management',
      'Керування посадами',
      'На екрані п’ять довідників організаційної структури. Деталі навичок, цілей і обовʼязків посади — на окремій сторінці каталогу.',
      [
        {
          id: 'positions.management__intro',
          title: 'П’ять довідників',
          body: 'На екрані п’ять довідників організаційної структури: напрямки, відділи, посади, групи навичок і навички.',
        },
        {
          id: 'positions.management__directions',
          title: 'Напрямки',
          body: 'Довідник напрямків організації — верхній рівень структури, до якого привʼязують відділи й посади.',
          anchorId: 'positions.panel.directions',
        },
        {
          id: 'positions.management__departments',
          title: 'Відділи',
          body: 'Відділи належать до напрямку. Список показує назву та привʼязку; вимкнені записи позначені окремо.',
          anchorId: 'positions.panel.departments',
        },
        {
          id: 'positions.management__positions',
          title: 'Посади',
          body: 'Посади організації з привʼязкою до напрямку й відділу. Іконка каталогу веде на окрему сторінку навичок, цілей і обовʼязків цієї посади.',
          anchorId: 'positions.panel.positions',
        },
        {
          id: 'positions.management__skill-groups',
          title: 'Групи навичок',
          body: 'Групи впорядковують оргкаталог навичок. Фільтри «Усі» / «Без групи» змінюють, які навички видно поруч.',
          anchorId: 'positions.panel.skill-groups',
        },
        {
          id: 'positions.management__org-skills',
          title: 'Навички організації',
          body: 'Довідник навичок організації, не вимоги конкретної посади. Вимоги посади живуть на сторінці її каталогу.',
          anchorId: 'positions.panel.org-skills',
        },
        {
          id: 'positions.management__tip',
          title: 'Формати',
          body: 'Вкладка «Формати» — окремі довідники форматів роботи й типів зайнятості для призначень працівників.',
        },
      ],
    ),
    steps(
      'positions.formats',
      'Формати',
      'Довідники форматів роботи та типів зайнятості — окремо від дерева посад.',
      [
        {
          id: 'positions.formats__work',
          title: 'Формати роботи',
          body: 'Довідник форматів роботи (на кшталт офіс / віддалено), які потім обирають у призначеннях.',
          anchorId: 'positions.formats.workFormats',
        },
        {
          id: 'positions.formats__employment',
          title: 'Типи зайнятості',
          body: 'Довідник типів зайнятості для призначень працівників — окремо від дерева посад.',
          anchorId: 'positions.formats.employmentTypes',
        },
      ],
    ),
    steps(
      'positions.position.skills',
      'Навички посади',
      'Очікувані навички обраної посади на сторінці каталогу.',
      [
        {
          id: 'positions.position.skills__body',
          title: 'Список навичок',
          body: 'Очікувані навички саме цієї посади: шкала й вимоги з каталогу організації.',
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
          body: 'Додавайте шаблон формою вище (якщо є права) або прибирайте зайві з кнопок у списку.',
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
    dialogFieldTour(
      'positions.dialog.position',
      'Форма посади',
      'Поля форми посади. У режимах очікування або непідтвердженого створення частина кнопок може бути недоступна — такі кроки пропускаються.',
      [
        {
          suffix: 'name',
          title: 'Назва',
          body: 'Тут задається назва посади в каталозі організації.',
          anchor: 'positions.dialog.position.name',
        },
        {
          suffix: 'direction',
          title: 'Напрямок',
          body: 'Це поле визначає напрямок, до якого належить посада. Відділи фільтруються за обраним напрямком.',
          anchor: 'positions.dialog.position.direction',
        },
        {
          suffix: 'department',
          title: 'Відділ',
          body: 'Тут обирається відділ у межах напрямку або «Без відділу».',
          anchor: 'positions.dialog.position.department',
        },
        {
          suffix: 'save',
          title: 'Збереження',
          body: 'Кнопка запису змін. Якщо вона недоступна в поточному режимі форми — крок пропускається.',
          anchor: 'positions.dialog.position.save',
        },
      ],
    ),
    dialogFieldTour(
      'positions.dialog.direction',
      'Форма напрямку',
      'Створення або редагування напрямку організації.',
      [
        {
          suffix: 'name',
          title: 'Назва',
          body: 'Тут задається назва напрямку.',
          anchor: 'positions.dialog.direction.name',
        },
        {
          suffix: 'save',
          title: 'Збереження',
          body: 'Записує напрямок у довідник.',
          anchor: 'positions.dialog.direction.save',
        },
      ],
    ),
    dialogFieldTour(
      'positions.dialog.department',
      'Форма відділу',
      'Створення або редагування відділу.',
      [
        {
          suffix: 'name',
          title: 'Назва',
          body: 'Тут задається назва відділу.',
          anchor: 'positions.dialog.department.name',
        },
        {
          suffix: 'direction',
          title: 'Напрямок',
          body: 'Це поле визначає напрямок, до якого належить відділ.',
          anchor: 'positions.dialog.department.direction',
        },
        {
          suffix: 'save',
          title: 'Збереження',
          body: 'Записує відділ у довідник.',
          anchor: 'positions.dialog.department.save',
        },
      ],
    ),
    dialogFieldTour(
      'positions.dialog.skill-group',
      'Форма групи навичок',
      'Створення або редагування групи навичок.',
      [
        {
          suffix: 'name',
          title: 'Назва',
          body: 'Тут задається назва групи навичок.',
          anchor: 'positions.dialog.skill-group.name',
        },
        {
          suffix: 'save',
          title: 'Збереження',
          body: 'Записує групу в оргкаталог.',
          anchor: 'positions.dialog.skill-group.save',
        },
      ],
    ),
    dialogFieldTour(
      'positions.dialog.skill',
      'Форма навички',
      'Створення або редагування навички організації.',
      [
        {
          suffix: 'name',
          title: 'Назва',
          body: 'Тут задається назва навички.',
          anchor: 'positions.dialog.skill.name',
        },
        {
          suffix: 'group',
          title: 'Група',
          body: 'Це поле визначає групу навички в оргкаталозі.',
          anchor: 'positions.dialog.skill.group',
        },
        {
          suffix: 'save',
          title: 'Збереження',
          body: 'Записує навичку в довідник.',
          anchor: 'positions.dialog.skill.save',
        },
      ],
    ),
    dialogFieldTour(
      'positions.dialog.work-format',
      'Форма формату роботи',
      'Створення або редагування формату роботи.',
      [
        {
          suffix: 'name',
          title: 'Назва',
          body: 'Тут задається назва формату роботи.',
          anchor: 'positions.dialog.work-format.name',
        },
        {
          suffix: 'save',
          title: 'Збереження',
          body: 'Записує формат у довідник.',
          anchor: 'positions.dialog.work-format.save',
        },
      ],
    ),
    dialogFieldTour(
      'positions.dialog.employment-type',
      'Форма типу зайнятості',
      'Створення або редагування типу зайнятості.',
      [
        {
          suffix: 'name',
          title: 'Назва',
          body: 'Тут задається назва типу зайнятості.',
          anchor: 'positions.dialog.employment-type.name',
        },
        {
          suffix: 'save',
          title: 'Збереження',
          body: 'Записує тип у довідник.',
          anchor: 'positions.dialog.employment-type.save',
        },
      ],
    ),
  ],
};
