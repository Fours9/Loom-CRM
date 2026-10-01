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

/** Copy SoT for Absences help tours. */
export const ABSENCES_HELP_BUNDLE: HelpDomainBundle = {
  tours: [
    steps(
      'absences.dashboard.schedule',
      'Графік на головній',
      'Бічна панель на дашборді робочого календаря. Зараз активна вкладка «Графік».',
      [
        {
          id: 'absences.dashboard.schedule__tab',
          title: 'Вкладка «Графік»',
          body: 'Перемикає бічну панель на тижневий розклад обраного працівника.',
          anchorId: 'absences.side.schedule',
        },
        {
          id: 'absences.dashboard.schedule__body',
          title: 'Розклад',
          body: 'Показує зміни по днях. Редагування з дашборду зазвичай лише для перегляду; повне редагування — у картці працівника або відповідній панелі.',
          anchorId: 'absences.side.schedule.body',
        },
        {
          id: 'absences.dashboard.schedule__tip',
          title: 'Інші вкладки',
          body: '«Коментар» зʼявляється лише за доступу. «Заявки» показує короткий список заявок цього працівника.',
        },
      ],
    ),
    steps(
      'absences.dashboard.comment',
      'Коментар на головній',
      'Бічна панель «Коментар» — текст до працівника на дашборді. Вкладка видима лише за відповідного доступу.',
      [
        {
          id: 'absences.dashboard.comment__tab',
          title: 'Вкладка «Коментар»',
          body: 'Відкриває коментар до обраного працівника. Якщо вкладки немає — у вас немає доступу до цього блоку.',
          anchorId: 'absences.side.comment',
        },
        {
          id: 'absences.dashboard.comment__body',
          title: 'Текст коментаря',
          body: 'Переглядайте коментар. Адмінський коментар (якщо є) розкривається окремим блоком нижче.',
          anchorId: 'absences.side.comment.body',
        },
      ],
    ),
    steps(
      'absences.dashboard.requests',
      'Заявки на головній',
      'Короткий список заявок обраного працівника прямо з дашборду робочого календаря.',
      [
        {
          id: 'absences.dashboard.requests__tab',
          title: 'Вкладка «Заявки»',
          body: 'Перемикає бічну панель на заявки цього працівника.',
          anchorId: 'absences.side.requests',
        },
        {
          id: 'absences.dashboard.requests__body',
          title: 'Список і нова заявка',
          body: 'Відкрийте рядок для деталей. Кнопка «Нова заявка» веде до форми створення з підстановкою працівника, якщо доступна.',
          anchorId: 'absences.side.requests.body',
        },
        {
          id: 'absences.dashboard.requests__tip',
          title: 'Повний список',
          body: 'Усі заявки команди — у пункті меню «Заявки» модуля робочого календаря.',
        },
      ],
    ),
    steps(
      'absences.employee-detail.schedule',
      'Графік у картці календаря',
      'Сторінка працівника в модулі робочого календаря. Активна бічна вкладка — «Графік».',
      [
        {
          id: 'absences.employee-detail.schedule__tab',
          title: 'Вкладка «Графік»',
          body: 'Показує тижневий розклад на цій сторінці.',
          anchorId: 'absences.side.schedule',
        },
        {
          id: 'absences.employee-detail.schedule__body',
          title: 'Редактор графіка',
          body: 'Переглядайте або змінюйте графік, якщо маєте право редагувати розклад цього працівника.',
          anchorId: 'absences.side.schedule.body',
        },
      ],
    ),
    steps(
      'absences.employee-detail.comment',
      'Коментар у картці календаря',
      'Коментар на сторінці працівника в модулі календаря. Вкладка видима лише за доступу.',
      [
        {
          id: 'absences.employee-detail.comment__tab',
          title: 'Вкладка «Коментар»',
          body: 'Відкриває коментар до працівника.',
          anchorId: 'absences.side.comment',
        },
        {
          id: 'absences.employee-detail.comment__body',
          title: 'Текст',
          body: 'Переглядайте або редагуйте коментар згідно з правами на картці.',
          anchorId: 'absences.side.comment.body',
        },
      ],
    ),
    steps(
      'absences.employee-detail.requests',
      'Заявки в картці календаря',
      'Заявки цього працівника в модулі робочого календаря.',
      [
        {
          id: 'absences.employee-detail.requests__tab',
          title: 'Вкладка «Заявки»',
          body: 'Перемикає бічну панель на список заявок.',
          anchorId: 'absences.side.requests',
        },
        {
          id: 'absences.employee-detail.requests__body',
          title: 'Список',
          body: 'Відкрийте заявку або створіть нову з кнопки в панелі, якщо вона доступна.',
          anchorId: 'absences.side.requests.body',
        },
      ],
    ),
    steps(
      'absences.employees',
      'Працівники календаря',
      'Список людей у скоупі робочого календаря з пошуком і фільтрами.',
      [
        {
          id: 'absences.employees__filters',
          title: 'Пошук і фільтри',
          body: 'Шукайте за ПІБ, номером чи email; обмежуйте за відділом і посадою; змінюйте сортування.',
          anchorId: 'absences.employees.filters',
        },
        {
          id: 'absences.employees__add',
          title: 'Додати працівника',
          body: 'Перехід до створення кадрової картки (якщо дозволено). Після створення людина зʼявиться в скоупі календаря за правилами доступу.',
          anchorId: 'absences.employees.add',
        },
        {
          id: 'absences.employees__list',
          title: 'Список',
          body: 'Відкрийте рядок, щоб перейти в картку працівника модуля календаря (графік, коментар, заявки).',
          anchorId: 'absences.employees',
        },
      ],
    ),
    steps(
      'absences.requests',
      'Заявки',
      'Усі заявки на відсутність у вашому доступі — зі статусами, типами й фільтрами.',
      [
        {
          id: 'absences.requests__new',
          title: 'Нова заявка',
          body: 'Відкриває форму створення заявки. Працівника можна вибрати на формі, якщо вам дозволено подавати за інших.',
          anchorId: 'absences.requests.new',
        },
        {
          id: 'absences.requests__filters',
          title: 'Фільтри',
          body: 'Обмежте список за статусом, типом, відділом тощо — щоб швидко знайти потрібну заявку.',
          anchorId: 'absences.requests.filters',
        },
        {
          id: 'absences.requests__list',
          title: 'Список',
          body: 'Натисніть рядок або картку, щоб відкрити деталі, історію та доступні дії (затвердження, відхилення, редагування).',
          anchorId: 'absences.requests',
        },
      ],
    ),
    steps(
      'absences.request-create',
      'Нова заявка',
      'Створення заявки на відсутність: тип, період і (за потреби) працівник.',
      [
        {
          id: 'absences.request-create__target',
          title: 'За кого подати',
          body: 'Оберіть себе або іншого працівника з доступу. Блок зʼявляється, якщо вам дозволено подавати не лише за себе.',
          anchorId: 'absences.request-create.target',
        },
        {
          id: 'absences.request-create__type',
          title: 'Тип',
          body: 'Тип визначає, які дати й години потрібні (діапазон, один день, час у зміні). Після зміни типу форма підлаштовує поля.',
          anchorId: 'absences.request-create.type',
        },
        {
          id: 'absences.request-create__submit',
          title: 'Подати',
          body: 'Надсилає заявку. Якщо кнопка неактивна — зачекайте збереження або заповніть обовʼязкові поля.',
          anchorId: 'absences.request-create.submit',
        },
      ],
    ),
    steps(
      'absences.request-detail',
      'Картка заявки',
      'Деталі заявки, статус, історія та дії залежно від стану й ваших прав.',
      [
        {
          id: 'absences.request-detail__region',
          title: 'Деталі',
          body: 'Переглядайте тип, період, працівника, вкладення та історію змін статусу.',
          anchorId: 'absences.request-detail',
        },
        {
          id: 'absences.request-detail__actions',
          title: 'Дії',
          body: 'Залежно від статусу тут зʼявляються редагування, затвердження, відхилення, скасування або видалення. Недоступні дії просто відсутні в панелі.',
          anchorId: 'absences.request-detail.actions',
        },
        {
          id: 'absences.request-detail__tip',
          title: 'Рішення',
          body: 'Після затвердження або відхилення статус оновлюється в списку заявок і на календарі команди.',
        },
      ],
    ),
    steps(
      'absences.calendar',
      'Робочий календар',
      'Вісь часу відсутностей команди: місяць, тиждень, день або список.',
      [
        {
          id: 'absences.calendar__nav',
          title: 'Період і режим',
          body: 'Гортайте період стрілками та оберіть режим перегляду (місяць / тиждень / день / список).',
          anchorId: 'absences.calendar.nav',
        },
        {
          id: 'absences.calendar__filters',
          title: 'Фільтри',
          body: 'Обмежте події за відділом, працівником, типом і статусом. У режимі «лише цей працівник» частина фільтрів може бути прихована.',
          anchorId: 'absences.calendar.filters',
        },
        {
          id: 'absences.calendar__grid',
          title: 'Сітка подій',
          body: 'Натисніть день або подію, щоб відкрити деталі. Порожні дні означають відсутність видимих подій у фільтрі.',
          anchorId: 'absences.calendar',
        },
      ],
    ),
    steps(
      'absences.admin',
      'Адмін календаря',
      'Адміністративні налаштування конфіденційності робочого календаря.',
      [
        {
          id: 'absences.admin__privacy',
          title: 'Конфіденційність',
          body: 'Керуйте режимами видимості профілю й деталей відсутностей. Зміни доступні лише адміністратору модуля.',
          anchorId: 'absences.admin.privacy',
        },
        {
          id: 'absences.admin__tip',
          title: 'Довідники',
          body: 'Відділи й посади редагуються в «Керуванні посадами», не на цій сторінці.',
        },
      ],
    ),
  ],
};
