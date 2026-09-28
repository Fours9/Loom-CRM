/**
 * employee-managing v1 — grade, skills matrix, career + probation goal steps.
 * Progress rail groups both under section «Цілі»; PDF coalesces to one print section.
 * Synced from docs/product/references/anketa_360.html (no net_salary / manager_review).
 */

import type { QuestionnaireSchemaJson } from '@loom/contracts-questionnaires';
import { buildCompanyWorkFields } from './shared/company-work.fields';
import { buildProfileMirrorIdentityFields } from './shared/profile-mirror-identity.fields';

export const EMPLOYEE_MANAGING_V1_SCHEMA_TITLE = 'Анкета Managing';

const GRADE_CURRENT_OPTIONS = [
  { value: 'g0', label: 'G0' },
  { value: 'g1', label: 'G1' },
  { value: 'g2', label: 'G2' },
  { value: 'g3', label: 'G3' },
  { value: 'g4', label: 'G4' },
  { value: 'g5', label: 'G5' },
] as const;

const GRADE_NEXT_OPTIONS = [
  { value: 'g1', label: 'G1' },
  { value: 'g2', label: 'G2' },
  { value: 'g3', label: 'G3' },
  { value: 'g4', label: 'G4' },
  { value: 'g5', label: 'G5' },
] as const;

export const EMPLOYEE_MANAGING_V1_SCHEMA = {
  code: 'employee-managing',
  version: 1,
  title: EMPLOYEE_MANAGING_V1_SCHEMA_TITLE,
  steps: [
    {
      key: 'profile_mirror',
      label: 'Особисті дані',
      fields: buildProfileMirrorIdentityFields('docsManagingPersonal'),
    },
    {
      key: 'company_work',
      label: 'Робота в компанії',
      fields: buildCompanyWorkFields('managing'),
    },
    {
      key: 'grade',
      label: 'Грейд і рівень посади',
      fields: [
        {
          key: 'grade.current',
          label: 'Поточний грейд',
          valueType: 'single_choice',
          requiredPolicy: 'voluntary',
          options: [...GRADE_CURRENT_OPTIONS],
        },
        {
          key: 'grade.assigned_at',
          label: 'Дата присвоєння',
          valueType: 'date',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'grade.assigned_by',
          label: 'Хто присвоїв',
          valueType: 'text',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'grade.next',
          label: 'Наступний грейд',
          valueType: 'single_choice',
          requiredPolicy: 'voluntary',
          options: [...GRADE_NEXT_OPTIONS],
        },
        {
          key: 'grade.criteria',
          label: 'Критерії переходу',
          valueType: 'textarea',
          requiredPolicy: 'voluntary',
        },
        {
          key: 'grade.review_at',
          label: 'Дата перегляду',
          valueType: 'date',
          requiredPolicy: 'voluntary',
        },
      ],
    },
    {
      key: 'skills',
      label: 'Матриця навичок',
      fields: [
        {
          key: 'skills.matrix',
          label: 'Матриця навичок',
          valueType: 'position_skills_matrix',
          requiredPolicy: 'voluntary',
        },
      ],
    },
    {
      /** Rail substep under progress section «Цілі»; answer key career_goals.* */
      key: 'career_goals',
      label: "Кар'єрні цілі та розвиток",
      fields: [
        {
          key: 'career_goals.plan',
          label: "Кар'єрні цілі та розвиток",
          valueType: 'repeating_group',
          requiredPolicy: 'voluntary',
          children: [
            {
              key: 'title',
              label: 'Ціль',
              valueType: 'text',
              requiredPolicy: 'voluntary',
            },
            {
              key: 'description',
              label: 'Опис',
              valueType: 'textarea',
              requiredPolicy: 'voluntary',
            },
            {
              key: 'targetDate',
              label: 'Дедлайн',
              valueType: 'date',
              requiredPolicy: 'voluntary',
            },
          ],
        },
      ],
    },
    {
      /** Rail substep under progress section «Цілі»; answer key probation_goals.* */
      key: 'probation_goals',
      label: 'Цілі на випробувальний термін',
      fields: [
        {
          key: 'probation_goals.items',
          label: 'Цілі на випробувальний термін',
          valueType: 'repeating_group',
          requiredPolicy: 'voluntary',
          children: [
            {
              key: 'title',
              label: 'Ціль',
              valueType: 'text',
              requiredPolicy: 'voluntary',
            },
            {
              key: 'description',
              label: 'Опис',
              valueType: 'textarea',
              requiredPolicy: 'voluntary',
            },
            {
              key: 'dueDate',
              label: 'Термін',
              valueType: 'date',
              requiredPolicy: 'voluntary',
            },
            {
              key: 'status',
              label: 'Статус',
              valueType: 'single_choice',
              requiredPolicy: 'voluntary',
              options: [
                { value: 'planned', label: 'Заплановано' },
                { value: 'active', label: 'В процесі' },
                { value: 'done', label: 'Виконано' },
              ],
            },
          ],
        },
      ],
    },
  ],
} as const satisfies QuestionnaireSchemaJson;
