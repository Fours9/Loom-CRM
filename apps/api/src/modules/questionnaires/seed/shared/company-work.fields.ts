import type { QuestionnaireSchemaField } from '@loom/contracts-questionnaires';

/** Shared company_work step fields for full + managing seeds. */
export function buildCompanyWorkFields(): QuestionnaireSchemaField[] {
  return [
    {
      key: 'company_work.company_direction',
      label: 'Компанія / напрямок',
      valueType: 'text',
      requiredPolicy: 'voluntary',
    },
    {
      key: 'company_work.department',
      label: 'Підрозділ',
      valueType: 'text',
      requiredPolicy: 'voluntary',
    },
    {
      key: 'company_work.position',
      label: 'Посада',
      valueType: 'text',
      requiredPolicy: 'voluntary',
    },
    {
      key: 'company_work.functional_role',
      label: 'Функціональна роль',
      valueType: 'text',
      requiredPolicy: 'voluntary',
    },
    {
      key: 'company_work.manager',
      label: 'Безпосередній керівник',
      valueType: 'text',
      requiredPolicy: 'voluntary',
    },
    {
      key: 'company_work.mentor',
      label: 'Наставник',
      valueType: 'text',
      requiredPolicy: 'voluntary',
    },
    {
      key: 'company_work.hr_responsible',
      label: 'HR-відповідальний',
      valueType: 'text',
      requiredPolicy: 'voluntary',
    },
    {
      key: 'company_work.start_date',
      label: 'Дата виходу на роботу',
      valueType: 'date',
      requiredPolicy: 'voluntary',
    },
    {
      key: 'company_work.probation_end',
      label: 'Кінець випроб. терміну',
      valueType: 'date',
      requiredPolicy: 'voluntary',
    },
    {
      key: 'company_work.status',
      label: 'Статус',
      valueType: 'multi_choice',
      requiredPolicy: 'voluntary',
      options: [
        { value: 'internship', label: 'Стажування' },
        { value: 'probation', label: 'Випробувальний' },
        { value: 'active', label: 'Активний' },
        { value: 'leave', label: 'Відпустка' },
      ],
    },
    {
      key: 'company_work.work_format',
      label: 'Формат роботи',
      valueType: 'multi_choice',
      requiredPolicy: 'voluntary',
      options: [
        { value: 'office', label: 'Офіс' },
        { value: 'production', label: 'Виробництво' },
        { value: 'hybrid', label: 'Гібрид' },
        { value: 'remote', label: 'Дистанційно' },
      ],
    },
    {
      key: 'company_work.schedule',
      label: 'Графік',
      valueType: 'multi_choice',
      requiredPolicy: 'voluntary',
      options: [
        { value: 'nine_to_six', label: '09:00–18:00' },
        { value: 'shifts', label: 'Позмінний' },
        { value: 'flexible', label: 'Гнучкий' },
        { value: 'other', label: 'Інший' },
      ],
    },
    {
      key: 'company_work.schedule_other',
      label: 'Інший графік',
      valueType: 'text',
      requiredPolicy: 'voluntary',
      visibleWhen: {
        answerKey: 'company_work.schedule',
        includes: 'other',
      },
    },
    {
      key: 'company_work.employment_type',
      label: 'Тип зайнятості',
      valueType: 'multi_choice',
      requiredPolicy: 'voluntary',
      options: [
        { value: 'full_time', label: 'Повна' },
        { value: 'part_time', label: 'Часткова' },
        { value: 'project', label: 'Проєктна' },
        { value: 'hourly', label: 'Погодинна' },
      ],
    },
    {
      key: 'company_work.contract_type',
      label: 'Тип оформлення',
      valueType: 'multi_choice',
      requiredPolicy: 'voluntary',
      options: [
        { value: 'staff', label: 'Штат' },
        { value: 'fop', label: 'ФОП' },
        { value: 'gph', label: 'ЦПХ' },
      ],
    },
    {
      key: 'company_work.location',
      label: 'Локація роботи',
      valueType: 'text',
      requiredPolicy: 'voluntary',
    },
  ];
}
