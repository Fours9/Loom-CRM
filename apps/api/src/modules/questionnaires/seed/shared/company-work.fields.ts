import type { QuestionnaireSchemaField } from '@loom/contracts-questionnaires';

const FULL_COMPANY_WORK_FIELDS: QuestionnaireSchemaField[] = [
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

const MANAGING_ORG_REF_FIELDS: QuestionnaireSchemaField[] = [
  {
    key: 'company_work.direction_id',
    label: 'Напрямок',
    valueType: 'organization_ref',
    organizationEntity: 'direction',
    profileMirrorKey: 'directionId',
    requiredPolicy: 'voluntary',
  },
  {
    key: 'company_work.department_id',
    label: 'Підрозділ',
    valueType: 'organization_ref',
    organizationEntity: 'department',
    cascadeParentKey: 'company_work.direction_id',
    profileMirrorKey: 'departmentId',
    requiredPolicy: 'voluntary',
  },
  {
    key: 'company_work.position_id',
    label: 'Посада',
    valueType: 'organization_ref',
    organizationEntity: 'position',
    cascadeParentKey: 'company_work.department_id',
    profileMirrorKey: 'positionId',
    requiredPolicy: 'voluntary',
  },
  {
    key: 'company_work.work_format',
    label: 'Формат роботи',
    valueType: 'organization_ref',
    organizationEntity: 'work_format',
    profileMirrorKey: 'workFormat',
    requiredPolicy: 'voluntary',
  },
  {
    key: 'company_work.employment_type',
    label: 'Тип зайнятості',
    valueType: 'organization_ref',
    organizationEntity: 'employment_type',
    profileMirrorKey: 'employmentType',
    requiredPolicy: 'voluntary',
  },
];

const MANAGING_SNAPSHOT_TAIL: QuestionnaireSchemaField[] = [
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
    profileMirrorKey: 'startDate',
    requiredPolicy: 'voluntary',
  },
  {
    key: 'company_work.probation_end',
    label: 'Кінець випроб. терміну',
    valueType: 'date',
    profileMirrorKey: 'probationEndDate',
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

/**
 * Freestanding position picker (no direction/department cascade).
 * Used by compact templates (e.g. employee-named) that only collect position.
 */
export function buildCompanyWorkPositionOnlyFields(): QuestionnaireSchemaField[] {
  return [
    {
      key: 'company_work.position_id',
      label: 'Посада',
      valueType: 'organization_ref',
      organizationEntity: 'position',
      profileMirrorKey: 'positionId',
      requiredPolicy: 'voluntary',
    },
  ];
}

/**
 * Shared company_work step fields.
 * `full` must stay structurally identical to the historical Full 360 snapshot.
 * `managing` uses organization_ref catalogs + profileMirrorKey autofill.
 */
export function buildCompanyWorkFields(
  mode: 'full' | 'managing' = 'full',
): QuestionnaireSchemaField[] {
  if (mode === 'managing') {
    return [...MANAGING_ORG_REF_FIELDS, ...MANAGING_SNAPSHOT_TAIL];
  }
  return FULL_COMPANY_WORK_FIELDS.map((f) => ({ ...f }));
}
