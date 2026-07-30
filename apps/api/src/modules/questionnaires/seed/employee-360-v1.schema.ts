/**
 * employee-360 v1 typed seed — manually synced from
 * docs/product/questionnaire-360-field-catalog.md (in_mvp fields only).
 * Runtime SoT after publish: questionnaire_template_versions.schema_json.
 *
 * Pre-production: v1 schema may be refreshed in-place when assignments = 0.
 * After first production assignment, publish a new version instead.
 */

import type { QuestionnaireSchemaJson } from '@loom/contracts-questionnaires';
import { completionPercentVisible } from '@loom/questionnaire-schema';

export const EMPLOYEE_360_TEMPLATE_CODE = 'employee-360';
export const EMPLOYEE_360_TEMPLATE_TITLE = 'Анкета 360° співробітника';

export const EMPLOYEE_360_V1_SCHEMA = {
  code: 'employee-360',
  version: 1,
  title: EMPLOYEE_360_TEMPLATE_TITLE,
  steps: [
    {
      key: 'profile_mirror',
      label: 'Особисті дані',
      fields: [
        {
          key: 'personal.last_name',
          label: 'Прізвище',
          valueType: 'text',
          requiredPolicy: 'recommended',
          uiGroup: 'identity_name',
          uiLayout: 'row',
          createsProfileProposal: true,
          proposalMapping: { section: 'overview', field: 'lastName' },
        },
        {
          key: 'personal.first_name',
          label: "Ім'я",
          valueType: 'text',
          requiredPolicy: 'recommended',
          uiGroup: 'identity_name',
          uiLayout: 'row',
          createsProfileProposal: true,
          proposalMapping: { section: 'overview', field: 'firstName' },
        },
        {
          key: 'personal.middle_name',
          label: 'По батькові',
          valueType: 'text',
          requiredPolicy: 'voluntary',
          uiGroup: 'identity_name',
          uiLayout: 'row',
          createsProfileProposal: true,
          proposalMapping: { section: 'overview', field: 'middleName' },
        },
        {
          key: 'personal.preferred_name',
          label: "Ім'я для звернення",
          valueType: 'text',
          requiredPolicy: 'voluntary',
          uiGroup: 'identity_preferred',
          createsProfileProposal: true,
          proposalMapping: { section: 'header', field: 'preferredName' },
        },
        {
          key: 'personal.birth_date',
          label: 'Дата народження',
          valueType: 'date',
          requiredPolicy: 'recommended',
          createsProfileProposal: true,
          proposalMapping: { section: 'personal', field: 'birthDate' },
        },
        {
          key: 'personal.city',
          label: 'Місто проживання',
          valueType: 'text',
          requiredPolicy: 'recommended',
          createsProfileProposal: true,
          proposalMapping: { section: 'personal', field: 'city' },
        },
        {
          key: 'personal.phone_primary',
          label: 'Основний телефон',
          valueType: 'text',
          requiredPolicy: 'recommended',
          uiGroup: 'contacts',
          uiGroupLabel: 'Контакти',
          createsProfileProposal: true,
          proposalMapping: { section: 'contacts', field: 'personal_phone' },
        },
        {
          key: 'personal.phone_secondary',
          label: 'Додатковий телефон',
          valueType: 'text',
          requiredPolicy: 'voluntary',
          uiGroup: 'contacts',
          uiGroupLabel: 'Контакти',
          createsProfileProposal: true,
          proposalMapping: {
            section: 'contacts',
            field: 'personal_phone_secondary',
          },
        },
        {
          key: 'personal.email',
          label: 'Особиста email',
          valueType: 'text',
          requiredPolicy: 'recommended',
          uiGroup: 'contacts',
          uiGroupLabel: 'Контакти',
          createsProfileProposal: true,
          proposalMapping: { section: 'contacts', field: 'personal_email' },
        },
        {
          key: 'personal.telegram',
          label: 'Telegram',
          valueType: 'text',
          requiredPolicy: 'voluntary',
          uiGroup: 'contacts',
          uiGroupLabel: 'Контакти',
          createsProfileProposal: true,
          proposalMapping: { section: 'contacts', field: 'personal_telegram' },
        },
        {
          key: 'personal.preferred_language',
          label: 'Бажана мова',
          valueType: 'multi_choice',
          requiredPolicy: 'voluntary',
          options: [
            { value: 'uk', label: 'Українська' },
            { value: 'en', label: 'Англійська' },
            { value: 'other', label: 'Інша' },
          ],
          createsProfileProposal: true,
          proposalMapping: { section: 'personal', field: 'preferredLanguage' },
        },
        {
          key: 'personal.preferred_language_other',
          label: 'Інша мова',
          valueType: 'text',
          requiredPolicy: 'voluntary',
          visibleWhen: {
            answerKey: 'personal.preferred_language',
            includes: 'other',
          },
        },
      ],
    },
    {
      key: 'family',
      label: 'Сімейний стан',
      fields: [
        {
          key: 'family.marital_status',
          label: 'Сімейний стан',
          valueType: 'single_choice',
          requiredPolicy: 'voluntary',
          options: [
            { value: 'prefer_not_say', label: 'Не вказувати' },
            { value: 'single', label: 'Неодружений/а' },
            { value: 'married', label: 'Одружений/а' },
            { value: 'other', label: 'Інше' },
          ],
        },
        {
          key: 'family.has_children',
          label: 'Чи є діти',
          valueType: 'single_choice',
          requiredPolicy: 'voluntary',
          options: [
            { value: 'yes', label: 'Так' },
            { value: 'no', label: 'Ні' },
            { value: 'prefer_not_say', label: 'Не вказувати' },
          ],
        },
        {
          key: 'family.children',
          label: 'Діти',
          valueType: 'repeating_group',
          requiredPolicy: 'voluntary',
          visibleWhen: { answerKey: 'family.has_children', equals: 'yes' },
          children: [
            { key: 'name', label: "Ім'я", valueType: 'text', requiredPolicy: 'voluntary' },
            {
              key: 'birth_date',
              label: 'Дата народження',
              valueType: 'date',
              requiredPolicy: 'voluntary',
            },
            { key: 'note', label: 'Нотатка', valueType: 'text', requiredPolicy: 'voluntary' },
          ],
        },
        {
          key: 'family.pets',
          label: 'Домашні тварини',
          valueType: 'text',
          requiredPolicy: 'voluntary',
        },
      ],
    },
    {
      key: 'celebration_dates',
      label: 'Святкові дати',
      fields: [
        {
          key: 'celebration.birth_date',
          label: 'День народження',
          valueType: 'date',
          requiredPolicy: 'voluntary',
          defaultFromAnswerKey: 'personal.birth_date',
        },
        {
          key: 'hobbies.birthday_greeting',
          label: 'Вітати з Днем народження',
          valueType: 'single_choice',
          requiredPolicy: 'voluntary',
          options: [
            { value: 'public', label: 'Публічно' },
            { value: 'hr_only', label: 'Лише HR' },
            { value: 'none', label: 'Не вітати' },
          ],
        },
        {
          key: 'family.gifts_permission',
          label: 'Дозвіл для подарунків',
          valueType: 'single_choice',
          requiredPolicy: 'voluntary',
          options: [
            { value: 'yes', label: 'Так' },
            { value: 'no', label: 'Ні' },
          ],
        },
        {
          key: 'hobbies.gift_format',
          label: 'Формат подарунка',
          valueType: 'multi_choice',
          requiredPolicy: 'voluntary',
          options: [
            { value: 'merch', label: 'Мерч' },
            { value: 'certificate', label: 'Сертифікат' },
            { value: 'experience', label: 'Досвід' },
            { value: 'useful_item', label: 'Корисна річ' },
          ],
        },
        {
          key: 'family.other_dates_note',
          label: 'Інші важливі дати',
          valueType: 'text',
          requiredPolicy: 'voluntary',
        },
      ],
    },
    {
      key: 'experience',
      label: 'Професійний досвід',
      fields: [
        {
          key: 'experience.total_tenure',
          label: 'Загальний стаж',
          valueType: 'text',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'experience.managed_people',
          label: 'Керували людьми?',
          valueType: 'single_choice',
          requiredPolicy: 'voluntary',
          options: [
            { value: 'yes', label: 'Так' },
            { value: 'no', label: 'Ні' },
          ],
        },
        {
          key: 'experience.managed_count',
          label: 'Кількість підлеглих',
          valueType: 'number',
          requiredPolicy: 'voluntary',
          visibleWhen: { answerKey: 'experience.managed_people', equals: 'yes' },
        },
        {
          key: 'experience.prior_jobs',
          label: 'Попередні місця роботи',
          valueType: 'repeating_group',
          requiredPolicy: 'voluntary',
          children: [
            { key: 'company', label: 'Компанія', valueType: 'text', requiredPolicy: 'voluntary' },
            { key: 'position', label: 'Посада', valueType: 'text', requiredPolicy: 'voluntary' },
            { key: 'from', label: 'Від', valueType: 'date', requiredPolicy: 'voluntary' },
            { key: 'to', label: 'До', valueType: 'date', requiredPolicy: 'voluntary' },
            { key: 'results', label: 'Результати', valueType: 'text', requiredPolicy: 'voluntary' },
          ],
        },
        {
          key: 'experience.achievements',
          label: 'Досягнення якими пишаюся',
          valueType: 'textarea',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'experience.want_to_learn',
          label: 'Чого хочу навчитись',
          valueType: 'textarea',
          requiredPolicy: 'voluntary',
        },
      ],
    },
    {
      key: 'education',
      label: 'Освіта та навчання',
      fields: [
        {
          key: 'education.level',
          label: 'Рівень освіти',
          valueType: 'single_choice',
          requiredPolicy: 'voluntary',
          options: [
            { value: 'secondary', label: 'Середня' },
            { value: 'vocational', label: 'Професійна' },
            { value: 'incomplete_higher', label: 'Неповна вища' },
            { value: 'bachelor', label: 'Бакалавр' },
            { value: 'master', label: 'Магістр' },
            { value: 'phd', label: 'PhD' },
          ],
        },
        {
          key: 'education.institutions',
          label: 'Навчальні заклади',
          valueType: 'repeating_group',
          requiredPolicy: 'voluntary',
          children: [
            { key: 'name', label: 'Заклад', valueType: 'text', requiredPolicy: 'voluntary' },
            {
              key: 'specialty',
              label: 'Спеціальність',
              valueType: 'text',
              requiredPolicy: 'voluntary',
            },
            { key: 'from', label: 'Від', valueType: 'date', requiredPolicy: 'voluntary' },
            { key: 'to', label: 'До', valueType: 'date', requiredPolicy: 'voluntary' },
            { key: 'degree', label: 'Ступінь', valueType: 'text', requiredPolicy: 'voluntary' },
          ],
        },
        {
          key: 'education.languages',
          label: 'Мови',
          valueType: 'repeating_group',
          requiredPolicy: 'voluntary',
          children: [
            { key: 'language', label: 'Мова', valueType: 'text', requiredPolicy: 'voluntary' },
            {
              key: 'level',
              label: 'Рівень',
              valueType: 'single_choice',
              requiredPolicy: 'voluntary',
              options: [
                { value: 'native', label: 'Рідна' },
                { value: 'conversational', label: 'Розмовна' },
                { value: 'intermediate', label: 'Середня' },
                { value: 'advanced', label: 'Вільна' },
              ],
            },
          ],
        },
        {
          key: 'education.certificates',
          label: 'Сертифікати / курси',
          valueType: 'textarea',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'education.driver_license',
          label: 'Водійське посвідчення',
          valueType: 'multi_choice',
          requiredPolicy: 'voluntary',
          options: [
            { value: 'none', label: 'Немає' },
            { value: 'A', label: 'A' },
            { value: 'B', label: 'B' },
            { value: 'C', label: 'C' },
            { value: 'D', label: 'D' },
          ],
        },
        {
          key: 'education.desired_courses',
          label: 'Які курси хочу пройти',
          valueType: 'textarea',
          requiredPolicy: 'voluntary',
        },
      ],
    },
    {
      key: 'strengths',
      label: 'Сильні сторони та потенціал',
      fields: [
        {
          key: 'strengths.top_three',
          label: 'Три сильні сторони',
          valueType: 'textarea',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'strengths.best_tasks',
          label: 'Задачі виходять найкраще',
          valueType: 'textarea',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'strengths.energizers',
          label: 'Що дає енергію',
          valueType: 'textarea',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'strengths.dislike',
          label: 'Що не подобається',
          valueType: 'textarea',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'strengths.blockers',
          label: 'Що заважає',
          valueType: 'textarea',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'strengths.ask_me_about',
          label: 'За якими питаннями звертатись',
          valueType: 'textarea',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'strengths.in_two_years',
          label: 'Через 2 роки бачу себе',
          valueType: 'text',
          requiredPolicy: 'voluntary',
        },
      ],
    },
    {
      key: 'hobbies',
      label: 'Хобі, інтереси та корпоративне життя',
      fields: [
        {
          key: 'hobbies.interests',
          label: 'Хобі та інтереси',
          valueType: 'multi_choice',
          requiredPolicy: 'voluntary',
          options: [
            { value: 'sport', label: 'Спорт' },
            { value: 'running', label: 'Біг' },
            { value: 'cycling', label: 'Велосипед' },
            { value: 'swimming', label: 'Плавання' },
            { value: 'cooking', label: 'Кулінарія' },
            { value: 'travel', label: 'Подорожі' },
            { value: 'reading', label: 'Читання' },
            { value: 'music', label: 'Музика' },
            { value: 'crafts', label: 'Рукоділля' },
            { value: 'gardening', label: 'Садівництво' },
            { value: 'photography', label: 'Фотографія' },
            { value: 'games', label: 'Ігри' },
            { value: 'volunteering', label: 'Волонтерство' },
            { value: 'movies', label: 'Кіно' },
            { value: 'dance', label: 'Танці' },
            { value: 'yoga', label: 'Йога' },
          ],
        },
        {
          key: 'hobbies.other',
          label: 'Інші інтереси',
          valueType: 'text',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'hobbies.shirt_size',
          label: 'Розмір футболки',
          valueType: 'single_choice',
          requiredPolicy: 'voluntary',
          options: [
            { value: 'xs', label: 'XS' },
            { value: 's', label: 'S' },
            { value: 'm', label: 'M' },
            { value: 'l', label: 'L' },
            { value: 'xl', label: 'XL' },
            { value: 'xxl', label: 'XXL' },
          ],
        },
        {
          key: 'hobbies.outerwear_size',
          label: 'Розмір верхнього одягу',
          valueType: 'text',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'hobbies.food',
          label: 'Харчові особливості',
          valueType: 'single_choice',
          requiredPolicy: 'voluntary',
          options: [
            { value: 'none', label: 'Немає' },
            { value: 'has_notes', label: 'Є особливості' },
            { value: 'prefer_not_say', label: 'Не вказувати' },
          ],
        },
        {
          key: 'hobbies.food_notes',
          label: 'Опис харчових особливостей',
          valueType: 'text',
          requiredPolicy: 'voluntary',
          visibleWhen: { answerKey: 'hobbies.food', equals: 'has_notes' },
        },
        {
          key: 'hobbies.corporate_events',
          label: 'Готовий/а до корпоративів',
          valueType: 'single_choice',
          requiredPolicy: 'voluntary',
          options: [
            { value: 'active', label: 'Активно' },
            { value: 'sometimes', label: 'Інколи' },
            { value: 'not_really', label: 'Швидше ні' },
          ],
        },
      ],
    },
    {
      key: 'work_style',
      label: 'Стиль роботи та комунікація',
      fields: [
        {
          key: 'work_style.task_delivery',
          label: 'Зручно отримувати задачі',
          valueType: 'multi_choice',
          requiredPolicy: 'voluntary',
          options: [
            { value: 'verbal', label: 'Усно' },
            { value: 'messenger', label: 'Месенджер' },
            { value: 'system', label: 'Система' },
          ],
        },
        {
          key: 'work_style.feedback_frequency',
          label: 'Потреба у зворотному звʼязку',
          valueType: 'single_choice',
          requiredPolicy: 'voluntary',
          options: [
            { value: 'daily', label: 'Щодня' },
            { value: 'weekly', label: 'Щотижня' },
            { value: 'as_needed', label: 'За потреби' },
            { value: 'rarely', label: 'Рідко' },
          ],
        },
        {
          key: 'work_style.criticism',
          label: 'Критику краще давати',
          valueType: 'multi_choice',
          requiredPolicy: 'voluntary',
          options: [
            { value: 'one_on_one', label: '1:1' },
            { value: 'written', label: 'Письмово' },
            { value: 'direct', label: 'Прямо' },
            { value: 'soft_with_examples', label: 'Мʼяко з прикладами' },
          ],
        },
        {
          key: 'work_style.productivity_time',
          label: 'Продуктивніший/а',
          valueType: 'single_choice',
          requiredPolicy: 'voluntary',
          options: [
            { value: 'morning', label: 'Вранці' },
            { value: 'day', label: 'Вдень' },
            { value: 'evening', label: 'Ввечері' },
            { value: 'same', label: 'Однаково' },
          ],
        },
        {
          key: 'work_style.solo_or_team',
          label: 'Краще працюю',
          valueType: 'single_choice',
          requiredPolicy: 'voluntary',
          options: [
            { value: 'solo', label: 'Самостійно' },
            { value: 'team', label: 'В команді' },
            { value: 'mixed', label: 'Змішано' },
          ],
        },
        {
          key: 'work_style.motivators',
          label: 'Основні мотиватори',
          valueType: 'textarea',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'work_style.demotivators',
          label: 'Основні демотиватори',
          valueType: 'textarea',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'work_style.notes_for_manager',
          label: 'Що важливо знати керівнику',
          valueType: 'textarea',
          requiredPolicy: 'voluntary',
        },
      ],
    },
    {
      key: 'consents_review',
      label: 'Згода та підписи',
      fields: [
        {
          key: 'consents.info_accurate',
          label: 'Підтверджую актуальність інформації',
          valueType: 'boolean',
          uiControl: 'checkbox',
          requiredPolicy: 'recommended',
        },
        {
          key: 'consents.hr_processing',
          label: 'Згода на обробку для HR-процесів',
          valueType: 'boolean',
          uiControl: 'checkbox',
          requiredPolicy: 'recommended',
        },
        {
          key: 'consents.photo_internal',
          label: 'Згода на фото у внутрішньому профілі',
          valueType: 'boolean',
          uiControl: 'checkbox',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'consents.hr_notifications',
          label: 'Згода на HR-повідомлення',
          valueType: 'boolean',
          uiControl: 'checkbox',
          requiredPolicy: 'voluntary',
        },
      ],
    },
  ],
} as const satisfies QuestionnaireSchemaJson;

/** @deprecated use completionPercentVisible from @loom/questionnaire-schema */
export function completionPercent(
  answers: Record<string, unknown> | null | undefined,
  schema: unknown,
): number {
  const s = schema as QuestionnaireSchemaJson;
  const full: QuestionnaireSchemaJson = {
    code: s?.code ?? 'runtime',
    version: s?.version ?? 1,
    title: s?.title ?? '',
    steps: s?.steps ?? [],
  };
  return completionPercentVisible(full, answers ?? {});
}

export function listSchemaFieldKeys(
  schema: { steps: Array<{ fields: Array<{ key: string }> }> },
): string[] {
  const keys: string[] = [];
  for (const step of schema.steps) {
    for (const field of step.fields) {
      if (field.key) keys.push(field.key);
    }
  }
  return keys;
}
