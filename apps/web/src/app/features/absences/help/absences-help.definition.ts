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
          id: 'absences.dashboard.schedule__anketa',
          title: 'Анкета',
          body: 'Основна колонка: кадрові дані, контакти й посада обраного на дашборді працівника. «Профіль Loom» відкриває повну картку в модулі People.',
          anchorId: 'absences.dashboard.anketa',
        },
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
          id: 'absences.dashboard.comment__anketa',
          title: 'Анкета',
          body: 'Ліва колонка — анкета працівника на дашборді. Бічна панель праворуч не змінює ці поля.',
          anchorId: 'absences.dashboard.anketa',
        },
        {
          id: 'absences.dashboard.comment__tab',
          title: 'Вкладка «Коментар»',
          body: 'Відкриває коментар до обраного працівника. Якщо вкладки немає — у вас немає доступу до цього блоку.',
          anchorId: 'absences.side.comment',
        },
        {
          id: 'absences.dashboard.comment__body',
          title: 'Текст коментаря',
          body: 'Переглядайте коментар для звернень до працівника або HR.',
          anchorId: 'absences.side.comment.body',
        },
        {
          id: 'absences.dashboard.comment__admin',
          title: 'Адмінський коментар',
          body: 'Розкрийте блок, якщо він є: внутрішні нотатки лише для адмінів, не потрапляють у PDF анкети.',
          anchorId: 'absences.side.comment.admin',
        },
      ],
    ),
    steps(
      'absences.dashboard.requests',
      'Заявки на головній',
      'Короткий список заявок обраного працівника прямо з дашборду робочого календаря.',
      [
        {
          id: 'absences.dashboard.requests__anketa',
          title: 'Анкета',
          body: 'Перевірте ПІБ, відділ і посаду в анкеті перед створенням заявки з бічної панелі.',
          anchorId: 'absences.dashboard.anketa',
        },
        {
          id: 'absences.dashboard.requests__tab',
          title: 'Вкладка «Заявки»',
          body: 'Перемикає бічну панель на заявки цього працівника.',
          anchorId: 'absences.side.requests',
        },
        {
          id: 'absences.dashboard.requests__new',
          title: 'Нова заявка',
          body: 'Створіть заявку з уже підставленим працівником — швидше, ніж з загального списку заявок.',
          anchorId: 'absences.side.requests.new',
        },
        {
          id: 'absences.dashboard.requests__list',
          title: 'Список заявок',
          body: 'Натисніть рядок, щоб відкрити картку заявки зі статусом і періодом.',
          anchorId: 'absences.side.requests.list',
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
          id: 'absences.employee-detail.schedule__anketa',
          title: 'Анкета',
          body: 'Редагуйте кадрові поля, колір календаря й контакти в основній колонці. Збереження — кнопками «Зберегти» / «Скасувати» в шапці.',
          anchorId: 'absences.employee-detail.anketa',
        },
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
          id: 'absences.employee-detail.comment__anketa',
          title: 'Анкета',
          body: 'Анкета ліворуч; коментарі праворуч не дублюють поля анкети.',
          anchorId: 'absences.employee-detail.anketa',
        },
        {
          id: 'absences.employee-detail.comment__tab',
          title: 'Вкладка «Коментар»',
          body: 'Відкриває коментар до працівника.',
          anchorId: 'absences.side.comment',
        },
        {
          id: 'absences.employee-detail.comment__body',
          title: 'Текст',
          body: 'У режимі редагування збережіть зміни разом з анкетою. Перегляд — лише для читання.',
          anchorId: 'absences.side.comment.body',
        },
        {
          id: 'absences.employee-detail.comment__admin',
          title: 'Адмінський коментар',
          body: 'Якщо блок видимий — розкрийте й заповніть внутрішню нотатку; вона не показується працівнику в PDF.',
          anchorId: 'absences.side.comment.admin',
        },
      ],
    ),
    steps(
      'absences.employee-detail.requests',
      'Заявки в картці календаря',
      'Заявки цього працівника в модулі робочого календаря.',
      [
        {
          id: 'absences.employee-detail.requests__anketa',
          title: 'Анкета',
          body: 'Переконайтеся, що обрано правильного працівника в анкеті перед подачею заявки.',
          anchorId: 'absences.employee-detail.anketa',
        },
        {
          id: 'absences.employee-detail.requests__tab',
          title: 'Вкладка «Заявки»',
          body: 'Перемикає бічну панель на список заявок.',
          anchorId: 'absences.side.requests',
        },
        {
          id: 'absences.employee-detail.requests__new',
          title: 'Нова заявка',
          body: 'Відкриває форму з цим працівником уже обраним.',
          anchorId: 'absences.side.requests.new',
        },
        {
          id: 'absences.employee-detail.requests__list',
          title: 'Список',
          body: 'Оберіть заявку в списку, щоб переглянути деталі та доступні дії.',
          anchorId: 'absences.side.requests.list',
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
          id: 'absences.request-create__dates',
          title: 'Дати',
          body: 'Оберіть початок і (за типом) кінець періоду. Міні-календарі показують обраний діапазон.',
          anchorId: 'absences.request-create.dates',
        },
        {
          id: 'absences.request-create__time',
          title: 'Час',
          body: 'Для типів з годинами оберіть інтервал у зміні або в межах дня. Якщо блоку немає — тип не потребує часу.',
          anchorId: 'absences.request-create.time',
        },
        {
          id: 'absences.request-create__reason',
          title: 'Причина й коментар',
          body: 'Коротко опишіть причину (за бажанням) і додайте коментар для погоджуючого.',
          anchorId: 'absences.request-create.reason',
        },
        {
          id: 'absences.request-create__attachments',
          title: 'Вкладення',
          body: 'Додайте PDF або зображення (до ліміту на файл і кількість). Файли можна прибрати до подання.',
          anchorId: 'absences.request-create.attachments',
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
          id: 'absences.request-detail__employee',
          title: 'Працівник',
          body: 'ПІБ, номер, колір календаря та організаційні дані на момент подання.',
          anchorId: 'absences.request-detail.employee',
        },
        {
          id: 'absences.request-detail__details',
          title: 'Деталі заявки',
          body: 'Тип, дати, міні-календар, причина та коментарі. У режимі редагування змініть поля й збережіть з бічної панелі «Дії».',
          anchorId: 'absences.request-detail.details',
        },
        {
          id: 'absences.request-detail__attachments',
          title: 'Вкладення',
          body: 'Перегляньте або завантажте файли. З правами керування — додайте або видаліть вкладення.',
          anchorId: 'absences.request-detail.attachments',
        },
        {
          id: 'absences.request-detail__history',
          title: 'Історія',
          body: 'Хронологія змін статусу та системних записів — корисно при погодженні й аудиті.',
          anchorId: 'absences.request-detail.history',
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
          title: 'Період',
          body: 'Стрілками змінюйте місяць, тиждень або день; «Сьогодні» повертає до поточної дати.',
          anchorId: 'absences.calendar.nav',
        },
        {
          id: 'absences.calendar__modes',
          title: 'Режим перегляду',
          body: 'Перемкніть місяць, тиждень, день або список — сітка та фільтри підлаштуються під обраний режим.',
          anchorId: 'absences.calendar.modes',
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
          id: 'absences.admin__privacy-profile',
          title: 'Видимість анкет',
          body: 'Оберіть, хто бачить чужі анкети в модулі календаря. Прапорець «глобальний пріоритет» вище перекриває індивідуальні права в картках.',
          anchorId: 'absences.admin.privacy.profile',
        },
        {
          id: 'absences.admin__privacy-absences',
          title: 'Видимість відсутностей',
          body: 'Налаштуйте, як колеги бачать чужі відсутності в календарі й списках, і чи показувати тип / причину.',
          anchorId: 'absences.admin.privacy.absences',
        },
        {
          id: 'absences.admin__tip',
          title: 'Збереження',
          body: 'Після змін натисніть «Зберегти» в картці. Довідники відділів і посад — у «Керуванні посадами».',
        },
      ],
    ),
  ],
};
