/**
 * employee-docs v1 — onboarding + HR documents checklist (Track B).
 * Synced from docs/product/references/anketa_360.html §16–§17.
 */

import type { QuestionnaireSchemaJson } from '@loom/contracts-questionnaires';
import { buildProfileMirrorIdentityFields } from './shared/profile-mirror-identity.fields';

export const EMPLOYEE_DOCS_V1_SCHEMA_TITLE = 'Анкета Docs';

export const EMPLOYEE_DOCS_V1_SCHEMA = {
  code: 'employee-docs',
  version: 1,
  title: EMPLOYEE_DOCS_V1_SCHEMA_TITLE,
  steps: [
    {
      key: 'profile_mirror',
      label: 'Особисті дані',
      fields: buildProfileMirrorIdentityFields('docsManagingPersonal'),
    },
    {
      key: 'onboarding',
      label: 'Онбординг',
      fields: [
        {
          key: 'onboarding.items',
          label: 'Чекліст онбордингу',
          valueType: 'repeating_group',
          requiredPolicy: 'voluntary',
          children: [
            {
              key: 'item',
              label: 'Пункт',
              valueType: 'text',
              requiredPolicy: 'voluntary',
            },
            {
              key: 'responsible',
              label: 'Відповідальний',
              valueType: 'text',
              requiredPolicy: 'voluntary',
            },
            {
              key: 'completed',
              label: 'Виконано',
              valueType: 'boolean',
              uiControl: 'checkbox',
              requiredPolicy: 'voluntary',
            },
            {
              key: 'completedAt',
              label: 'Дата виконання',
              valueType: 'date',
              requiredPolicy: 'voluntary',
            },
          ],
        },
        {
          key: 'onboarding.equipment',
          label: 'Обладнання',
          valueType: 'repeating_group',
          requiredPolicy: 'voluntary',
          children: [
            {
              key: 'equipment',
              label: 'Обладнання',
              valueType: 'text',
              requiredPolicy: 'voluntary',
            },
            {
              key: 'modelNumber',
              label: 'Модель / номер',
              valueType: 'text',
              requiredPolicy: 'voluntary',
            },
            {
              key: 'issuedAt',
              label: 'Дата видачі',
              valueType: 'date',
              requiredPolicy: 'voluntary',
            },
            {
              key: 'condition',
              label: 'Стан',
              valueType: 'text',
              requiredPolicy: 'voluntary',
            },
            {
              key: 'returnedAt',
              label: 'Дата повернення',
              valueType: 'date',
              requiredPolicy: 'voluntary',
            },
          ],
        },
        {
          key: 'onboarding.systemAccess',
          label: 'Системи та доступи',
          valueType: 'repeating_group',
          requiredPolicy: 'voluntary',
          children: [
            {
              key: 'system',
              label: 'Система',
              valueType: 'text',
              requiredPolicy: 'voluntary',
            },
            {
              key: 'role',
              label: 'Роль доступу',
              valueType: 'text',
              requiredPolicy: 'voluntary',
            },
            {
              key: 'grantedBy',
              label: 'Надав',
              valueType: 'text',
              requiredPolicy: 'voluntary',
            },
            {
              key: 'grantedAt',
              label: 'Дата',
              valueType: 'date',
              requiredPolicy: 'voluntary',
            },
            {
              key: 'revoke',
              label: 'Відкликати',
              valueType: 'boolean',
              uiControl: 'checkbox',
              requiredPolicy: 'voluntary',
            },
          ],
        },
      ],
    },
    {
      key: 'hr_documents',
      label: 'Кадрові документи',
      fields: [
        {
          key: 'hr_documents.checklist',
          label: 'Наявні документи',
          valueType: 'multi_choice',
          requiredPolicy: 'voluntary',
          options: [
            { value: 'passport_id', label: 'Паспорт / ID' },
            { value: 'rnokpp', label: 'РНОКПП' },
            { value: 'education_doc', label: 'Документ про освіту' },
            { value: 'labor_docs', label: 'Трудові документи' },
            { value: 'military', label: 'Військово-облікові' },
            { value: 'bank_details', label: 'Банківські реквізити' },
            { value: 'contract_order', label: 'Договір / наказ' },
            { value: 'nda', label: 'NDA' },
            { value: 'job_description', label: 'Посадова інструкція' },
            {
              value: 'material_liability',
              label: 'Матеріальна відповідальність',
            },
            { value: 'safety_briefings', label: 'Інструктажі ОП' },
          ],
        },
        {
          key: 'hr_documents.other',
          label: 'Інше',
          valueType: 'text',
          requiredPolicy: 'voluntary',
        },
      ],
    },
  ],
} as const satisfies QuestionnaireSchemaJson;
