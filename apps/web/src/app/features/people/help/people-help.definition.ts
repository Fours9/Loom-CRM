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
          id: 'people.create__form',
          title: 'Форма',
          body: 'Заповніть обовʼязкові кадрові поля (ПІБ, організаційне призначення). Особисті поля й акаунт зʼявляються залежно від ваших прав.',
          anchorId: 'people.create',
        },
        {
          id: 'people.create__submit',
          title: 'Створити',
          body: 'Зберігає нового працівника. Якщо кнопка неактивна — перевірте обовʼязкові поля або дочекайтесь завершення запиту.',
          anchorId: 'people.create.submit',
        },
        {
          id: 'people.create__tip',
          title: 'Після створення',
          body: 'Далі можна доповнити контакти, дати, посаду й акаунт у вкладках картки — не обовʼязково все на цьому екрані.',
        },
      ],
    ),
    steps(
      'people.data.basics',
      'Основні дані',
      'Кадрове ядро картки: статус, керівник, імʼя для звернення та базова персональна інформація.',
      [
        {
          id: 'people.data.basics__region',
          title: 'Поля',
          body: 'Переглядайте основні атрибути працівника. Персональний блок (місто, мова) видно лише за відповідного доступу.',
          anchorId: 'people.data.basics',
        },
        {
          id: 'people.data.basics__edit',
          title: 'Редагувати',
          body: 'Відкриває поля для змін. Після правок натисніть «Зберегти» — скасування відкидає чернетку без запису в картку.',
          anchorId: 'people.data.basics.edit',
        },
        {
          id: 'people.data.basics__tip',
          title: 'Підвкладки',
          body: '«Контакти» і «Дати» поруч у тій самій вкладці «Дані» — окремі підказки для кожного розділу.',
        },
      ],
    ),
    steps(
      'people.data.contacts',
      'Контакти',
      'Робочі, особисті та аварійні контакти зберігаються в картці окремо від відповідей анкет.',
      [
        {
          id: 'people.data.contacts__region',
          title: 'Блок контактів',
          body: 'Тут зібрані телефони, email і аварійні контакти. Видимість секцій залежить від прав на картку.',
          anchorId: 'people.data.contacts',
        },
        {
          id: 'people.data.contacts__edit',
          title: 'Редагувати',
          body: 'Увімкніть редагування, щоб змінити контакти. «Зберегти» фіксує зміни; «Скасувати» повертає збережений стан.',
          anchorId: 'people.data.contacts.edit',
        },
        {
          id: 'people.data.contacts__tip',
          title: 'Анкети',
          body: 'Пропозиції з анкет потрапляють у «Запропоновані зміни» і застосовуються лише після прийняття — не плутайте з прямим редагуванням тут.',
        },
      ],
    ),
    steps(
      'people.data.dates',
      'Дати',
      'Календарні дати працівника (прийом, важливі дати), які впливають на облік і профіль.',
      [
        {
          id: 'people.data.dates__region',
          title: 'Список дат',
          body: 'Переглядайте й керуйте важливими датами. Порожній список означає, що дат ще не додано.',
          anchorId: 'people.data.dates',
        },
        {
          id: 'people.data.dates__edit',
          title: 'Редагувати',
          body: 'Додавайте або змінюйте дати в режимі редагування, потім збережіть. Некоректний діапазон дат блокує збереження.',
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
          id: 'people.work.position__region',
          title: 'Поточне призначення',
          body: 'Показує активне або заплановане призначення. Якщо призначення ще немає — спочатку створіть його.',
          anchorId: 'people.work.position',
        },
        {
          id: 'people.work.position__new',
          title: 'Нове призначення',
          body: 'Відкриває діалог створення призначення. Історію існуючих записів можна редагувати або видаляти з кнопок у списку нижче.',
          anchorId: 'people.work.position.new',
        },
        {
          id: 'people.work.position__tip',
          title: 'Довідники',
          body: 'Напрямки, відділи й посади ведуться в «Керуванні посадами». Тут ви лише привʼязуєте працівника до вже існуючих записів.',
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
          id: 'people.documents__region',
          title: 'Список документів',
          body: 'Фільтруйте за типом і шукайте за назвою. Завантажити або відкрити файл можна з рядка документа.',
          anchorId: 'people.documents',
        },
        {
          id: 'people.documents__upload',
          title: 'Додати документи',
          body: 'Відкриває діалог завантаження. Кнопка зʼявляється лише якщо вам дозволено додавати файли до цієї картки.',
          anchorId: 'people.documents.upload',
        },
        {
          id: 'people.documents__tip',
          title: 'Конфіденційність',
          body: 'Окремі типи можуть бути конфіденційними — їх видно лише за відповідного доступу в ролі.',
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
          id: 'people.metrics.skills__region',
          title: 'Матриця',
          body: 'Переглядайте оцінки за очікуваними навичками посади. Зміни зберігаються за правилами панелі.',
          anchorId: 'people.metrics.skills',
        },
        {
          id: 'people.metrics.skills__add',
          title: 'Додати навичку',
          body: 'Відкриває вибір додаткової навички поза шаблоном посади. Кнопка зʼявляється, коли додавання дозволене.',
          anchorId: 'people.metrics.skills.add',
        },
        {
          id: 'people.metrics.skills__tip',
          title: 'Посада',
          body: 'Набір очікуваних навичок задається в «Керуванні посадами». Тут ви оцінюєте конкретного працівника.',
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
          id: 'people.admin.account__region',
          title: 'Дії з акаунтом',
          body: 'Тут можна змінити email, створити акаунт, скинути пароль, активувати або деактивувати вхід. Видалення акаунта не видаляє кадрову картку.',
          anchorId: 'people.admin.account.actions',
        },
        {
          id: 'people.admin.account__tip',
          title: 'Без акаунта',
          body: 'Картка працівника може існувати без логіну. Створення акаунта зʼявляється лише за відповідних прав.',
        },
      ],
    ),
    steps(
      'people.admin.roleAccess',
      'Роль та допуски',
      'Роль облікового запису й перевизначення видимості для цієї картки.',
      [
        {
          id: 'people.admin.roleAccess__region',
          title: 'Налаштування доступу',
          body: 'Призначте роль акаунта та за потреби перевизначте видимість окремих блоків. Керівництво в оргструктурі задається посадою, не роллю.',
          anchorId: 'people.admin.roleAccess',
        },
        {
          id: 'people.admin.roleAccess__save',
          title: 'Зберегти',
          body: 'Записує зміни ролі й перевизначень. Кнопка зʼявляється, коли вам дозволено керувати доступом цієї картки.',
          anchorId: 'people.admin.roleAccess.save',
        },
        {
          id: 'people.admin.roleAccess__tip',
          title: 'Глобальні ролі',
          body: 'Каталог ролей і поверхонь меню редагується в «Налаштування» → «Доступи».',
        },
      ],
    ),
  ],
};
