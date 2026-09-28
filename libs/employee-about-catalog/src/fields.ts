import type { AboutFieldDef, AboutSubtabId } from './types';

const TEXT = 500;
const TEXTAREA = 4000;

/** Canonical About field registry — single vocabulary for sync, GET, PATCH, seeds. */
export const ABOUT_FIELD_DEFS: readonly AboutFieldDef[] = [
  // —— family_home ——
  {
    key: 'family.marital_status',
    subtab: 'family_home',
    labelUa: 'Сімейний стан',
    valueType: 'single_choice',
    options: [
      { value: 'prefer_not_say', labelUa: 'Не вказувати' },
      { value: 'single', labelUa: 'Неодружений/а' },
      { value: 'married', labelUa: 'Одружений/а' },
      { value: 'other', labelUa: 'Інше' },
    ],
  },
  {
    key: 'family.has_children',
    subtab: 'family_home',
    labelUa: 'Чи є діти',
    valueType: 'single_choice',
    options: [
      { value: 'yes', labelUa: 'Так' },
      { value: 'no', labelUa: 'Ні' },
      { value: 'prefer_not_say', labelUa: 'Не вказувати' },
    ],
  },
  {
    key: 'family.children',
    subtab: 'family_home',
    labelUa: 'Діти',
    valueType: 'repeating_group',
    visibleWhen: { key: 'family.has_children', equals: 'yes' },
    maxItems: 20,
    children: [
      { key: 'name', labelUa: "Ім'я", valueType: 'text', maxLength: TEXT },
      { key: 'birth_date', labelUa: 'Дата народження', valueType: 'date' },
      { key: 'note', labelUa: 'Нотатка', valueType: 'text', maxLength: TEXT },
    ],
  },
  {
    key: 'family.pets',
    subtab: 'family_home',
    labelUa: 'Домашні тварини',
    valueType: 'text',
    maxLength: TEXT,
  },

  // —— celebrations ——
  {
    key: 'celebration.birth_date',
    subtab: 'celebrations',
    labelUa: 'День народження',
    valueType: 'date',
  },
  {
    key: 'hobbies.birthday_greeting',
    subtab: 'celebrations',
    labelUa: 'Вітати з Днем народження',
    valueType: 'single_choice',
    options: [
      { value: 'public', labelUa: 'Публічно' },
      { value: 'hr_only', labelUa: 'Лише HR' },
      { value: 'none', labelUa: 'Не вітати' },
    ],
  },
  {
    key: 'family.gifts_permission',
    subtab: 'celebrations',
    labelUa: 'Дозвіл для подарунків',
    valueType: 'single_choice',
    options: [
      { value: 'yes', labelUa: 'Так' },
      { value: 'no', labelUa: 'Ні' },
    ],
  },
  {
    key: 'hobbies.gift_format',
    subtab: 'celebrations',
    labelUa: 'Формат подарунка',
    valueType: 'multi_choice',
    options: [
      { value: 'merch', labelUa: 'Мерч' },
      { value: 'certificate', labelUa: 'Сертифікат' },
      { value: 'experience', labelUa: 'Досвід' },
      { value: 'useful_item', labelUa: 'Корисна річ' },
    ],
  },
  {
    key: 'family.other_dates',
    subtab: 'celebrations',
    labelUa: 'Інші важливі дати',
    valueType: 'repeating_group',
    maxItems: 20,
    children: [
      { key: 'title', labelUa: 'Назва', valueType: 'text', maxLength: TEXT },
      { key: 'from', labelUa: 'З', valueType: 'date' },
      { key: 'to', labelUa: 'По', valueType: 'date' },
    ],
  },

  // —— hobbies (gift keys live under celebrations) ——
  {
    key: 'hobbies.interests',
    subtab: 'hobbies',
    labelUa: 'Хобі та інтереси',
    valueType: 'multi_choice',
    options: [
      { value: 'sport', labelUa: 'Спорт' },
      { value: 'running', labelUa: 'Біг' },
      { value: 'cycling', labelUa: 'Велосипед' },
      { value: 'swimming', labelUa: 'Плавання' },
      { value: 'cooking', labelUa: 'Кулінарія' },
      { value: 'travel', labelUa: 'Подорожі' },
      { value: 'reading', labelUa: 'Читання' },
      { value: 'music', labelUa: 'Музика' },
      { value: 'crafts', labelUa: 'Рукоділля' },
      { value: 'gardening', labelUa: 'Садівництво' },
      { value: 'photography', labelUa: 'Фотографія' },
      { value: 'games', labelUa: 'Ігри' },
      { value: 'volunteering', labelUa: 'Волонтерство' },
      { value: 'movies', labelUa: 'Кіно' },
      { value: 'dance', labelUa: 'Танці' },
      { value: 'yoga', labelUa: 'Йога' },
    ],
  },
  {
    key: 'hobbies.other',
    subtab: 'hobbies',
    labelUa: 'Інші інтереси',
    valueType: 'text',
    maxLength: TEXT,
  },
  {
    key: 'hobbies.shirt_size',
    subtab: 'hobbies',
    labelUa: 'Розмір футболки',
    valueType: 'single_choice',
    options: [
      { value: 'xs', labelUa: 'XS' },
      { value: 's', labelUa: 'S' },
      { value: 'm', labelUa: 'M' },
      { value: 'l', labelUa: 'L' },
      { value: 'xl', labelUa: 'XL' },
      { value: 'xxl', labelUa: 'XXL' },
    ],
  },
  {
    key: 'hobbies.outerwear_size',
    subtab: 'hobbies',
    labelUa: 'Розмір верхнього одягу',
    valueType: 'text',
    maxLength: TEXT,
  },
  {
    key: 'hobbies.food',
    subtab: 'hobbies',
    labelUa: 'Харчові особливості',
    valueType: 'single_choice',
    options: [
      { value: 'none', labelUa: 'Немає' },
      { value: 'has_notes', labelUa: 'Є особливості' },
      { value: 'prefer_not_say', labelUa: 'Не вказувати' },
    ],
  },
  {
    key: 'hobbies.food_notes',
    subtab: 'hobbies',
    labelUa: 'Опис харчових особливостей',
    valueType: 'text',
    maxLength: TEXT,
    visibleWhen: { key: 'hobbies.food', equals: 'has_notes' },
  },
  {
    key: 'hobbies.corporate_events',
    subtab: 'hobbies',
    labelUa: 'Готовий/а до корпоративів',
    valueType: 'single_choice',
    options: [
      { value: 'active', labelUa: 'Активно' },
      { value: 'sometimes', labelUa: 'Інколи' },
      { value: 'not_really', labelUa: 'Швидше ні' },
    ],
  },

  // —— strengths ——
  {
    key: 'strengths.top_three',
    subtab: 'strengths',
    labelUa: 'Три сильні сторони',
    valueType: 'textarea',
    maxLength: TEXTAREA,
  },
  {
    key: 'strengths.best_tasks',
    subtab: 'strengths',
    labelUa: 'Задачі виходять найкраще',
    valueType: 'textarea',
    maxLength: TEXTAREA,
  },
  {
    key: 'strengths.energizers',
    subtab: 'strengths',
    labelUa: 'Що дає енергію',
    valueType: 'textarea',
    maxLength: TEXTAREA,
  },
  {
    key: 'strengths.dislike',
    subtab: 'strengths',
    labelUa: 'Що не подобається',
    valueType: 'textarea',
    maxLength: TEXTAREA,
  },
  {
    key: 'strengths.blockers',
    subtab: 'strengths',
    labelUa: 'Що заважає',
    valueType: 'textarea',
    maxLength: TEXTAREA,
  },
  {
    key: 'strengths.ready_responsibility',
    subtab: 'strengths',
    labelUa: 'Яку відповідальність готові взяти',
    valueType: 'textarea',
    maxLength: TEXTAREA,
  },

  // —— work_style ——
  {
    key: 'work_style.task_delivery',
    subtab: 'work_style',
    labelUa: 'Зручно отримувати задачі',
    valueType: 'multi_choice',
    options: [
      { value: 'verbal', labelUa: 'Усно' },
      { value: 'messenger', labelUa: 'Месенджер' },
      { value: 'system', labelUa: 'Система' },
    ],
  },
  {
    key: 'work_style.feedback_frequency',
    subtab: 'work_style',
    labelUa: 'Потреба у зворотному звʼязку',
    valueType: 'single_choice',
    options: [
      { value: 'daily', labelUa: 'Щодня' },
      { value: 'weekly', labelUa: 'Щотижня' },
      { value: 'as_needed', labelUa: 'За потреби' },
      { value: 'rarely', labelUa: 'Рідко' },
    ],
  },
  {
    key: 'work_style.criticism',
    subtab: 'work_style',
    labelUa: 'Критику краще давати',
    valueType: 'multi_choice',
    options: [
      { value: 'one_on_one', labelUa: '1:1' },
      { value: 'written', labelUa: 'Письмово' },
      { value: 'direct', labelUa: 'Прямо' },
      { value: 'soft_with_examples', labelUa: 'Мʼяко з прикладами' },
    ],
  },
  {
    key: 'work_style.productivity_time',
    subtab: 'work_style',
    labelUa: 'Продуктивніший/а',
    valueType: 'single_choice',
    options: [
      { value: 'morning', labelUa: 'Вранці' },
      { value: 'day', labelUa: 'Вдень' },
      { value: 'evening', labelUa: 'Ввечері' },
      { value: 'same', labelUa: 'Однаково' },
    ],
  },
  {
    key: 'work_style.solo_or_team',
    subtab: 'work_style',
    labelUa: 'Краще працюю',
    valueType: 'single_choice',
    options: [
      { value: 'solo', labelUa: 'Самостійно' },
      { value: 'team', labelUa: 'В команді' },
      { value: 'mixed', labelUa: 'Змішано' },
    ],
  },
  {
    key: 'work_style.motivators',
    subtab: 'work_style',
    labelUa: 'Основні мотиватори',
    valueType: 'textarea',
    maxLength: TEXTAREA,
  },
  {
    key: 'work_style.demotivators',
    subtab: 'work_style',
    labelUa: 'Основні демотиватори',
    valueType: 'textarea',
    maxLength: TEXTAREA,
  },
  {
    key: 'work_style.notes_for_manager',
    subtab: 'work_style',
    labelUa: 'Що важливо знати керівнику',
    valueType: 'textarea',
    maxLength: TEXTAREA,
  },

  // —— life_goals ——
  {
    key: 'strengths.in_one_year',
    subtab: 'life_goals',
    labelUa: 'Ким ви бачите себе через 1 рік',
    valueType: 'textarea',
    maxLength: TEXTAREA,
  },
  {
    key: 'strengths.in_two_to_three_years',
    subtab: 'life_goals',
    labelUa: 'Ким ви бачите себе через 2–3 роки',
    valueType: 'textarea',
    maxLength: TEXTAREA,
  },
  {
    key: 'career_goals.plan',
    subtab: 'life_goals',
    labelUa: "Кар'єрні цілі та розвиток",
    valueType: 'repeating_group',
    maxItems: 50,
    children: [
      { key: 'title', labelUa: 'Ціль', valueType: 'text', maxLength: TEXT },
      {
        key: 'description',
        labelUa: 'Опис',
        valueType: 'textarea',
        maxLength: TEXTAREA,
      },
      { key: 'targetDate', labelUa: 'Дедлайн', valueType: 'date' },
    ],
  },
  {
    key: 'probation_goals.items',
    subtab: 'life_goals',
    labelUa: 'Цілі на випробувальний термін',
    valueType: 'repeating_group',
    maxItems: 50,
    children: [
      { key: 'title', labelUa: 'Ціль', valueType: 'text', maxLength: TEXT },
      {
        key: 'description',
        labelUa: 'Опис',
        valueType: 'textarea',
        maxLength: TEXTAREA,
      },
      { key: 'dueDate', labelUa: 'Термін', valueType: 'date' },
      {
        key: 'status',
        labelUa: 'Статус',
        valueType: 'single_choice',
        options: [
          { value: 'planned', labelUa: 'Заплановано' },
          { value: 'active', labelUa: 'В процесі' },
          { value: 'done', labelUa: 'Виконано' },
        ],
      },
    ],
  },
] as const;

const FIELD_BY_KEY = new Map(
  ABOUT_FIELD_DEFS.map((f) => [f.key, f] as const),
);

export function allAboutFieldKeys(): readonly string[] {
  return ABOUT_FIELD_DEFS.map((f) => f.key);
}

export function aboutFieldByKey(key: string): AboutFieldDef | undefined {
  return FIELD_BY_KEY.get(key);
}

export function fieldsForSubtab(subtab: AboutSubtabId): readonly AboutFieldDef[] {
  return ABOUT_FIELD_DEFS.filter((f) => f.subtab === subtab);
}

export function isAboutFieldKey(key: string): boolean {
  return FIELD_BY_KEY.has(key);
}
