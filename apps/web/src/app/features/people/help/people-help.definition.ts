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

/** Copy SoT for People help tours (actionable steps; no region boilerplate). */
export const PEOPLE_HELP_BUNDLE: HelpDomainBundle = {
  tours: [
    steps(
      'people.directory',
      'Каталог працівників',
      'Тут зібрані люди з вашого доступу. Відкрийте рядок, щоб перейти в картку профілю.',
      [
        {
          id: 'people.directory__add',
          title: 'Додати',
          body: 'Відкриває форму створення нового працівника. Кнопка видима лише якщо ваша роль дозволяє створювати кадрові картки.',
          anchorId: 'people.directory.add',
        },
        {
          id: 'people.directory__filters',
          title: 'Фільтри',
          body: 'Обмежте список за відділом, посадою, статусом і пошуком. Сортування змінює порядок у таблиці.',
          anchorId: 'people.directory.filters',
        },
        {
          id: 'people.directory__table',
          title: 'Список',
          body: 'Натисніть на працівника, щоб відкрити профіль із вкладками «Дані», «Робота», «Документи», «Анкети» тощо.',
          anchorId: 'people.directory.table',
        },
      ],
    ),
    steps(
      'people.create',
      'Новий працівник',
      'Створення картки — джерело істини для профілю в LoomCRM. Після збереження відкриється картка працівника.',
      [
        {
          id: 'people.create__general',
          title: 'Загальна інформація',
          body: 'Заповніть ПІБ і колір календаря — вони одразу потраплять у профіль і робочий календар після створення.',
          anchorId: 'people.create.general',
        },
        {
          id: 'people.create__account',
          title: 'Обліковий запис',
          body: 'Увімкніть створення акаунта, якщо працівнику потрібен вхід. Без галочки збережеться лише кадрова картка — логін можна додати пізніше в «Адмініструванні».',
          anchorId: 'people.create.account',
        },
        {
          id: 'people.create__personal',
          title: 'Особисті контакти',
          body: 'Додайте особисті email і телефони, якщо маєте право на персональні дані. Блок зʼявляється лише за відповідного доступу.',
          anchorId: 'people.create.personal',
        },
        {
          id: 'people.create__assignment',
          title: 'Посада',
          body: 'Привʼяжіть напрямок, відділ і посаду з довідників. Порожнє призначення можна задати пізніше у вкладці «Робота» → «Посада».',
          anchorId: 'people.create.assignment',
        },
        {
          id: 'people.create__schedule',
          title: 'Робочий графік',
          body: 'Задайте типові зміни по днях — графік вплине на доступні години в заявках на відсутність.',
          anchorId: 'people.create.schedule',
        },
        {
          id: 'people.create__submit',
          title: 'Створити',
          body: 'Натисніть, щоб зберегти картку. Після успіху відкриється профіль працівника — перевірте дані й доповніть контакти за потреби.',
          anchorId: 'people.create.submit',
        },
      ],
    ),
    steps(
      'people.data.basics',
      'Основні дані',
      'Кадрове ядро картки: статус, керівник, імʼя для звернення та базова персональна інформація.',
      [
        {
          id: 'people.data.basics__core',
          title: 'Кадрове ядро',
          body: 'Тут статус, керівник і імʼя для звернення — те, що бачить команда в списках і календарі.',
          anchorId: 'people.data.basics.core',
        },
        {
          id: 'people.data.basics__personal',
          title: 'Персональні дані',
          body: 'Місто й мова зʼявляються лише за доступу до персональних даних. Редагування — через «Редагувати» зверху.',
          anchorId: 'people.data.basics.personal',
        },
        {
          id: 'people.data.basics__edit',
          title: 'Редагувати',
          body: 'Увімкніть режим правок, змініть поля й натисніть «Зберегти» — інакше зміни не потраплять у картку.',
          anchorId: 'people.data.basics.edit',
        },
      ],
    ),
    steps(
      'people.data.contacts',
      'Контакти',
      'Робочі, особисті та аварійні контакти зберігаються в картці окремо від відповідей анкет.',
      [
        {
          id: 'people.data.contacts__work',
          title: 'Робочі контакти',
          body: 'Email, телефон і Telegram для роботи. Зміни тут одразу оновлюють картку — не плутайте з пропозиціями з анкет.',
          anchorId: 'people.data.contacts.work',
        },
        {
          id: 'people.data.contacts__personal',
          title: 'Особисті контакти',
          body: 'Окремі канали поза робочими. Секція видима лише за доступу до персональних даних.',
          anchorId: 'people.data.contacts.personal',
        },
        {
          id: 'people.data.contacts__emergency',
          title: 'Екстрені контакти',
          body: 'Контакти на випадок надзвичайної ситуації. Додавайте або прибирайте рядки в режимі редагування.',
          anchorId: 'people.data.contacts.emergency',
        },
        {
          id: 'people.data.contacts__edit',
          title: 'Редагувати',
          body: 'Натисніть, щоб змінити контакти, потім «Зберегти» — «Скасувати» поверне останній збережений стан.',
          anchorId: 'people.data.contacts.edit',
        },
      ],
    ),
    steps(
      'people.data.dates',
      'Дати',
      'Календарні дати працівника (прийом, важливі дати), які впливають на облік і профіль.',
      [
        {
          id: 'people.data.dates__core',
          title: 'Основні дати',
          body: 'Дата народження, реєстрації акаунта й початку роботи впливають на профіль і облік. Частина полів залежить від прав.',
          anchorId: 'people.data.dates.core',
        },
        {
          id: 'people.data.dates__important',
          title: 'Важливі дати',
          body: 'Додавайте довільні періоди (наприклад, навчання). Порожній список означає, що записів ще немає.',
          anchorId: 'people.data.dates.important',
        },
        {
          id: 'people.data.dates__edit',
          title: 'Редагувати',
          body: 'Увімкніть редагування, змініть дати й збережіть — некоректний діапазон «з–по» заблокує запис.',
          anchorId: 'people.data.dates.edit',
        },
      ],
    ),
    steps(
      'people.work.position',
      'Посада',
      'Поточне організаційне призначення: напрямок, відділ, посада, формат роботи та історія призначень.',
      [
        {
          id: 'people.work.position__current',
          title: 'Поточне призначення',
          body: 'Активне або заплановане призначення задає посаду в профілі й календарі. Якщо блок порожній — створіть призначення.',
          anchorId: 'people.work.position.current',
        },
        {
          id: 'people.work.position__history',
          title: 'Історія',
          body: 'Минулi записи можна редагувати або видалити (крім активного). Зміни впливають на аудит і подальші призначення.',
          anchorId: 'people.work.position.history',
        },
        {
          id: 'people.work.position__new',
          title: 'Нове призначення',
          body: 'Створює нове організаційне призначення. Довідники посад і структури — у «Керуванні посадами».',
          anchorId: 'people.work.position.new',
        },
      ],
    ),
    steps(
      'people.work.schedule',
      'Графік роботи',
      'Тижневий робочий графік працівника з модуля робочого календаря.',
      [
        {
          id: 'people.work.schedule__region',
          title: 'Редактор графіка',
          body: 'Переглядайте або змінюйте зміни по днях тижня. Режим редагування доступний лише за відповідних прав у календарі.',
          anchorId: 'people.work.schedule',
        },
        {
          id: 'people.work.schedule__tip',
          title: 'Заявки',
          body: 'Графік впливає на доступні години в заявках на відсутність. Поруч у «Роботі» — вкладки заявок і календаря цього працівника.',
        },
      ],
    ),
    steps(
      'people.work.requests',
      'Заявки працівника',
      'Заявки на відсутність саме цього працівника — швидкий зріз без повного списку модуля.',
      [
        {
          id: 'people.work.requests__region',
          title: 'Список заявок',
          body: 'Відкрийте заявку для деталей і дій. Повний каталог заявок команди — у розділі «Робочий календар» → «Заявки».',
          anchorId: 'people.work.requests',
        },
      ],
    ),
    steps(
      'people.work.calendar',
      'Календар у картці',
      'Вбудований календар відсутностей з фокусом на цього працівника.',
      [
        {
          id: 'people.work.calendar__region',
          title: 'Календар',
          body: 'Перемикайте період і переглядайте події. Повний командний календар із фільтрами — у навігації робочого календаря.',
          anchorId: 'people.work.calendar',
        },
      ],
    ),
    steps(
      'people.documents',
      'Документи',
      'Файли працівника: кадрові документи та вкладення заявок, з урахуванням доступу й конфіденційності.',
      [
        {
          id: 'people.documents__filters',
          title: 'Фільтри',
          body: 'Обмежте список за типом, датами чи пошуком. Це не завантажує файли — лише звужує видимі рядки.',
          anchorId: 'people.documents.filters',
        },
        {
          id: 'people.documents__list',
          title: 'Список документів',
          body: 'Переглядайте й відкривайте файли працівника. Конфіденційні типи видно лише за відповідного доступу.',
          anchorId: 'people.documents.list',
        },
        {
          id: 'people.documents__upload',
          title: 'Додати документи',
          body: 'Додає файли до картки працівника (кадрові типи з урахуванням доступу й конфіденційності).',
          anchorId: 'people.documents.upload',
        },
      ],
    ),
    steps(
      'people.about.family-home',
      'Сімʼя і дім',
      'Мʼякий контекст про сімʼю й побут — окремо від кадрових «Даних». Не замінює анкети.',
      [
        {
          id: 'people.about.family-home__tabs',
          title: 'Підрозділи «Про себе»',
          body: 'Перемикайте підрозділи (сімʼя, свята, хобі тощо). Поточна підказка відповідає обраному розділу.',
          anchorId: 'people.about.subtabs',
        },
        {
          id: 'people.about.family-home__fields',
          title: 'Поля',
          body: 'Заповнюйте або переглядайте відповіді цього розділу. Зміни зберігаються кнопкою «Зберегти» внизу, якщо є право редагувати.',
          anchorId: 'people.about.region',
        },
        {
          id: 'people.about.family-home__save',
          title: 'Зберегти',
          body: 'Записує зміни лише цього підрозділу. Кнопка зʼявляється, коли вам дозволено редагувати «Про себе».',
          anchorId: 'people.about.save',
        },
      ],
    ),
    steps(
      'people.about.celebrations',
      'Свята і подарунки',
      'Вітання, подарунки та особливі дати для команди й HR.',
      [
        {
          id: 'people.about.celebrations__tabs',
          title: 'Підрозділи',
          body: 'Оберіть потрібний розділ «Про себе». Підказка в меню «?» відповідає активному підрозділу.',
          anchorId: 'people.about.subtabs',
        },
        {
          id: 'people.about.celebrations__fields',
          title: 'Поля розділу',
          body: 'Переглядайте або редагуйте відповіді. Після змін натисніть «Зберегти», якщо кнопка доступна.',
          anchorId: 'people.about.region',
        },
        {
          id: 'people.about.celebrations__save',
          title: 'Зберегти',
          body: 'Фіксує зміни цього розділу в картці працівника.',
          anchorId: 'people.about.save',
        },
      ],
    ),
    steps(
      'people.about.hobbies',
      'Хобі та інтереси',
      'Інтереси й уподобання для знайомства в команді.',
      [
        {
          id: 'people.about.hobbies__tabs',
          title: 'Підрозділи',
          body: 'Перемикайте розділи «Про себе» без виходу з картки.',
          anchorId: 'people.about.subtabs',
        },
        {
          id: 'people.about.hobbies__fields',
          title: 'Поля розділу',
          body: 'Заповнюйте інтереси тут. Це не впливає на кадрові «Дані» й не підміняє відповіді в анкетах.',
          anchorId: 'people.about.region',
        },
        {
          id: 'people.about.hobbies__save',
          title: 'Зберегти',
          body: 'Записує зміни розділу, якщо вам дозволено редагувати.',
          anchorId: 'people.about.save',
        },
      ],
    ),
    steps(
      'people.about.strengths',
      'Сильні сторони',
      'Що виходить найкраще та що дає енергію — для розвитку й команди.',
      [
        {
          id: 'people.about.strengths__tabs',
          title: 'Підрозділи',
          body: 'Оберіть розділ на панелі підвкладок.',
          anchorId: 'people.about.subtabs',
        },
        {
          id: 'people.about.strengths__fields',
          title: 'Поля розділу',
          body: 'Опишіть сильні сторони в полях цього розділу.',
          anchorId: 'people.about.region',
        },
        {
          id: 'people.about.strengths__save',
          title: 'Зберегти',
          body: 'Зберігає зміни розділу в картці.',
          anchorId: 'people.about.save',
        },
      ],
    ),
    steps(
      'people.about.work-style',
      'Стиль роботи',
      'Зручна комунікація, фідбек і мотиватори в роботі.',
      [
        {
          id: 'people.about.work-style__tabs',
          title: 'Підрозділи',
          body: 'Перемикайте розділи «Про себе» кнопками зверху.',
          anchorId: 'people.about.subtabs',
        },
        {
          id: 'people.about.work-style__fields',
          title: 'Поля розділу',
          body: 'Зафіксуйте вподобання щодо комунікації та стилю роботи.',
          anchorId: 'people.about.region',
        },
        {
          id: 'people.about.work-style__save',
          title: 'Зберегти',
          body: 'Записує зміни, якщо редагування дозволене.',
          anchorId: 'people.about.save',
        },
      ],
    ),
    steps(
      'people.about.life-goals',
      'Цілі',
      'Життєві та карʼєрні орієнтири працівника.',
      [
        {
          id: 'people.about.life-goals__tabs',
          title: 'Підрозділи',
          body: 'Оберіть розділ «Цілі» або сусідні підрозділи «Про себе».',
          anchorId: 'people.about.subtabs',
        },
        {
          id: 'people.about.life-goals__fields',
          title: 'Поля розділу',
          body: 'Записуйте орієнтири тут. Це мʼякий контекст, а не офіційні цілі посади з каталогу.',
          anchorId: 'people.about.region',
        },
        {
          id: 'people.about.life-goals__save',
          title: 'Зберегти',
          body: 'Зберігає відповіді цього розділу.',
          anchorId: 'people.about.save',
        },
      ],
    ),
    steps(
      'people.metrics.skills',
      'Матриця навичок',
      'Оцінки навичок за посадою та додаткові навички працівника.',
      [
        {
          id: 'people.metrics.skills__matrix',
          title: 'Матриця',
          body: 'Оцінюйте навички з шаблону посади та додаткові навички. Зміни рівня зберігаються одразу, якщо редагування дозволене.',
          anchorId: 'people.metrics.skills.matrix',
        },
        {
          id: 'people.metrics.skills__add',
          title: 'Додати навичку',
          body: 'Натисніть, щоб додати навичку поза шаблоном посади — вона зʼявиться в матриці після збереження.',
          anchorId: 'people.metrics.skills.add',
        },
      ],
    ),
    steps(
      'people.admin.history',
      'Історія',
      'Хронологія змін профілю та призначень — для аудиту й розбору «хто що змінив».',
      [
        {
          id: 'people.admin.history__region',
          title: 'Стрічка подій',
          body: 'Події показують час, автора й короткий опис зміни. Порожній список означає, що аудиту ще немає або немає доступу до історії.',
          anchorId: 'people.admin.history',
        },
      ],
    ),
    steps(
      'people.admin.account',
      'Акаунт',
      'Логін, пароль і стан облікового запису працівника. Доступні дії залежать від вашої ролі.',
      [
        {
          id: 'people.admin.account__actions',
          title: 'Стан і email',
          body: 'Переглядайте або змінюйте email, скидайте пароль, активуйте чи деактивуйте вхід. Кадрова картка лишається навіть без акаунта.',
          anchorId: 'people.admin.account.actions',
        },
        {
          id: 'people.admin.account__create',
          title: 'Створити акаунт',
          body: 'Розгорніть блок, задайте логін і тимчасовий пароль — після збереження працівник зможе увійти в LoomCRM.',
          anchorId: 'people.admin.account.create',
        },
      ],
    ),
    steps(
      'people.admin.roleAccess',
      'Роль та допуски',
      'Роль облікового запису й перевизначення видимості для цієї картки.',
      [
        {
          id: 'people.admin.roleAccess__role',
          title: 'Роль акаунта',
          body: 'Оберіть роль — від неї залежать права API та пункти меню. Керівництво в структурі задається посадою, не цією роллю.',
          anchorId: 'people.admin.roleAccess.role',
        },
        {
          id: 'people.admin.roleAccess__overrides',
          title: 'Індивідуальні права',
          body: 'Перевизначте peer-видимість чужих анкет і відсутностей — не замінює глобальні ролі в «Налаштування» → «Доступи».',
          anchorId: 'people.admin.roleAccess.overrides',
        },
        {
          id: 'people.admin.roleAccess__save',
          title: 'Зберегти',
          body: 'Натисніть, щоб записати роль і перевизначення — без збереження зміни не застосуються.',
          anchorId: 'people.admin.roleAccess.save',
        },
      ],
    ),
    steps(
      'people.dialog.assignment',
      'Призначення',
      'Форма організаційного призначення: напрямок, відділ, посада та повʼязані поля.',
      [
        {
          id: 'people.dialog.assignment__direction',
          title: 'Напрямок',
          body: 'Тут обирається напрямок призначення. Відділи й посади залежать від цього вибору.',
          anchorId: 'people.dialog.assignment.direction',
        },
        {
          id: 'people.dialog.assignment__department',
          title: 'Відділ',
          body: 'Це поле визначає відділ у межах напрямку.',
          anchorId: 'people.dialog.assignment.department',
        },
        {
          id: 'people.dialog.assignment__position',
          title: 'Посада',
          body: 'Оберіть посаду — від неї залежать очікувані навички в матриці та відображення в профілі.',
          anchorId: 'people.dialog.assignment.position',
        },
        {
          id: 'people.dialog.assignment__dates',
          title: 'Дати',
          body: 'Задайте дату початку (і кінця при редагуванні) — період потрапить в історію призначень.',
          anchorId: 'people.dialog.assignment.dates',
        },
        {
          id: 'people.dialog.assignment__save',
          title: 'Зберегти',
          body: 'Натисніть, щоб записати призначення в картку — закриття без збереження відкине зміни.',
          anchorId: 'people.dialog.assignment.save',
        },
      ],
    ),
    steps(
      'people.dialog.document-upload',
      'Завантаження документів',
      'Нове подання файлів до картки працівника.',
      [
        {
          id: 'people.dialog.document-upload__title',
          title: 'Заголовок',
          body: 'Задайте назву подання — її побачите в списку документів і фільтрах.',
          anchorId: 'people.dialog.document-upload.title',
        },
        {
          id: 'people.dialog.document-upload__type',
          title: 'Тип',
          body: 'Оберіть тип — він впливає на класифікацію й політику конфіденційності.',
          anchorId: 'people.dialog.document-upload.type',
        },
        {
          id: 'people.dialog.document-upload__files',
          title: 'Файли',
          body: 'Додайте PDF або зображення — після завантаження вони зʼявляться в списку документів картки.',
          anchorId: 'people.dialog.document-upload.files',
        },
        {
          id: 'people.dialog.document-upload__submit',
          title: 'Завантажити',
          body: 'Натисніть, щоб надіслати файли на сервер. Без заголовка та файлів кнопка лишається неактивною.',
          anchorId: 'people.dialog.document-upload.submit',
        },
      ],
    ),
  ],
};
