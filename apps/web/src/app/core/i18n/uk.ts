import { MODULE_NAME, PLATFORM_NAME } from '../brand/platform';

export const uk = {
  brandName: PLATFORM_NAME,
  brandModule: MODULE_NAME,
  appName: PLATFORM_NAME,
  nav: {
    home: 'Головна',
    employees: 'Працівники',
    requests: 'Заявки',
    calendar: 'Календар',
    admin: 'Адмін',
    logout: 'Вийти',
  },
  calendar: {
    today: 'Сьогодні',
    prev: 'Попередній період',
    next: 'Наступний період',
    modes: {
      month: 'Місяць',
      week: 'Тиждень',
      day: 'День',
      list: 'Список',
    },
    filters: {
      department: 'Відділ',
      employee: 'Працівник',
      type: 'Тип',
      status: 'Статус',
      all: 'Усі',
      allVisible: 'Усі видимі',
    },
    loading: 'Завантаження календаря…',
    error: 'Не вдалося завантажити календар',
    empty: {
      day: 'Порожній день',
      range: 'Немає подій за період.',
      drawerDay: 'Немає видимих відсутностей.',
    },
    overflowAria: 'Додаткові події',
    drawer: {
      close: 'Закрити',
      closeAria: 'Закрити панель дня',
      loading: 'Завантаження…',
      error: 'Не вдалося завантажити день',
      axisTitle: 'Час (08:00–20:00)',
    },
  },
} as const;

export type UkDictionary = typeof uk;
