import type { QuestionnaireSchemaField } from '@loom/contracts-questionnaires';

const NAME_CORE_FIELDS: QuestionnaireSchemaField[] = [
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
];

const PREFERRED_NAME_FIELD: QuestionnaireSchemaField = {
  key: 'personal.preferred_name',
  label: "Ім'я для звернення",
  valueType: 'text',
  requiredPolicy: 'voluntary',
  uiGroup: 'identity_preferred',
  createsProfileProposal: true,
  proposalMapping: { section: 'header', field: 'preferredName' },
};

const BIRTH_CITY_FIELDS: QuestionnaireSchemaField[] = [
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
];

const LANGUAGE_FIELDS: QuestionnaireSchemaField[] = [
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
];

/** Shared profile_mirror identity fields for full / managing / docs seeds. */
export function buildProfileMirrorIdentityFields(
  mode: 'full' | 'namesOnly' | 'docsManagingPersonal',
): QuestionnaireSchemaField[] {
  if (mode === 'docsManagingPersonal') {
    return [...NAME_CORE_FIELDS, ...BIRTH_CITY_FIELDS];
  }
  if (mode === 'namesOnly') {
    return [...NAME_CORE_FIELDS, PREFERRED_NAME_FIELD];
  }
  return [
    ...NAME_CORE_FIELDS,
    PREFERRED_NAME_FIELD,
    ...BIRTH_CITY_FIELDS,
    ...LANGUAGE_FIELDS,
  ];
}
