import type {
  QuestionnairePrintControl,
  QuestionnairePrintField,
  QuestionnairePrintMeta,
  QuestionnairePrintModel,
  QuestionnairePrintPersonalContactType,
  QuestionnairePrintSkillRating,
  QuestionnairePrintSkillRow,
  QuestionnairePrintStep,
  QuestionnaireSchemaField,
  QuestionnaireSchemaJson,
} from '@loom/contracts-questionnaires';
import {
  BLANK_CONTACTS_EMERGENCY_ROWS,
  BLANK_CONTACTS_PERSONAL_ROWS,
  BLANK_SKILLS_MATRIX_ROWS,
  PAPER_FORM_MIN_ROWS,
  REPEATING_TEXTAREA_LINES,
  TEXTAREA_PAPER_LINES,
} from '@loom/contracts-questionnaires';
import {
  emptyEmployeeContactsBundle,
  normalizeEmployeeContactsBundle,
  type EmployeeContactsEmergencyItem,
  type EmployeeContactsPersonalItem,
  type PersonalContactType,
} from '@loom/employee-contacts';
import { SKILL_DEFINITIONS } from '@loom/position-skill-catalog';
import { isQuestionnaireFieldVisible } from './field-visibility';
import type { QuestionnaireFieldFormatContext } from './field-display-format';
import { resolveQuestionnaireFieldValue } from './field-value-resolve';
import {
  emptyPositionSkillsMatrix,
  parsePositionSkillsMatrixStrict,
  resolveMatrixRatingPolicy,
  type MatrixRatingPolicy,
  type PositionSkillsMatrixAnswer,
} from './position-skills-matrix';
import { fieldsByKey } from './schema-validation';

export type BuildQuestionnairePrintModelInput = {
  schema: QuestionnaireSchemaJson;
  answers: Record<string, unknown>;
  /** Draft only — omit/empty for submitted snapshot PDF. */
  profileMirror?: Record<string, unknown> | null;
  mode: 'blank' | 'filled';
  meta: QuestionnairePrintMeta;
  formatContext: QuestionnaireFieldFormatContext;
};

const YES_NO_OPTIONS = [
  { value: 'true', label: 'Так' },
  { value: 'false', label: 'Ні' },
] as const;

/** Top-level multi/single choice fields that use horizontal paper options (caption above ☐). */
const HORIZONTAL_CHOICE_FIELD_KEYS = new Set([
  'company_work.status',
  'company_work.schedule',
  'company_work.contract_type',
]);

/** Schema fields present in Fill but omitted from paper PDF. */
export const QUESTIONNAIRE_PRINT_OMIT_FIELD_KEYS = new Set([
  'company_work.mentor',
  'company_work.hr_responsible',
]);

function choiceLayoutForField(
  fieldKey: string,
): 'vertical' | 'horizontal' {
  return HORIZONTAL_CHOICE_FIELD_KEYS.has(fieldKey)
    ? 'horizontal'
    : 'vertical';
}

const PERSONAL_TYPE_LABELS: Record<PersonalContactType, string> = {
  personal_phone: 'Особистий телефон',
  personal_email: 'Особистий email',
  personal_telegram: 'Особистий Telegram',
};

const PERSONAL_TYPE_BY_BLANK_KEY: Record<
  keyof typeof BLANK_CONTACTS_PERSONAL_ROWS,
  PersonalContactType
> = {
  phone: 'personal_phone',
  email: 'personal_email',
  telegram: 'personal_telegram',
};

/** Max inclusive span for choice_scale; wider → number control. */
const CHOICE_SCALE_MAX_SPAN = 10;

function stringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const t = value.trim();
    return t === '' ? null : t;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'Так' : 'Ні';
  }
  return String(value);
}

function isCheckedMulti(value: unknown, optionValue: string): boolean {
  return Array.isArray(value) && value.map(String).includes(optionValue);
}

/**
 * Single schema-field → atomic paper control mapper (top-level and repeating cells).
 */
export function mapFieldToPrintControl(
  field: QuestionnaireSchemaField,
  value: unknown,
  mode: 'blank' | 'filled',
  formatContext: QuestionnaireFieldFormatContext,
  options?: { nested?: boolean },
): QuestionnairePrintControl {
  const nested = options?.nested === true;
  const blank = mode === 'blank';
  const vt = field.valueType;

  if (vt === 'textarea') {
    return {
      kind: 'text_box',
      key: field.key,
      label: field.label,
      lines: nested ? REPEATING_TEXTAREA_LINES : TEXTAREA_PAPER_LINES,
      value: blank ? null : stringOrNull(value),
    };
  }

  if (vt === 'single_choice') {
    const optionsList = field.options ?? [];
    return {
      kind: 'choice_list',
      key: field.key,
      label: field.label,
      exclusive: true,
      layout: nested ? 'horizontal' : choiceLayoutForField(field.key),
      options: optionsList.map((o) => ({
        value: o.value,
        label: o.label,
        checked: blank ? false : value != null && String(value) === o.value,
      })),
    };
  }

  if (vt === 'multi_choice') {
    const optionsList = field.options ?? [];
    return {
      kind: 'choice_list',
      key: field.key,
      label: field.label,
      exclusive: false,
      layout: nested ? 'horizontal' : choiceLayoutForField(field.key),
      options: optionsList.map((o) => ({
        value: o.value,
        label: o.label,
        checked: blank ? false : isCheckedMulti(value, o.value),
      })),
    };
  }

  if (vt === 'boolean') {
    if (field.uiControl === 'checkbox') {
      return {
        kind: 'checkbox_item',
        key: field.key,
        label: field.label,
        checked: blank ? false : value === true,
      };
    }
    return {
      kind: 'choice_list',
      key: field.key,
      label: field.label,
      exclusive: true,
      options: YES_NO_OPTIONS.map((o) => ({
        value: o.value,
        label: o.label,
        checked: blank
          ? false
          : value === true
            ? o.value === 'true'
            : value === false
              ? o.value === 'false'
              : false,
      })),
    };
  }

  // text | date | number | organization_ref | (fallback)
  let display: string | null = null;
  if (!blank) {
    if (vt === 'organization_ref') {
      const label = formatContext.resolveOrgLabel(field, value);
      display = label === '—' || label === '' ? null : label;
    } else {
      display = stringOrNull(value);
    }
  }

  return {
    kind: 'text_line',
    key: field.key,
    label: field.label,
    value: display,
  };
}

function minimumPaperRows(field: QuestionnaireSchemaField): number {
  return Math.min(
    PAPER_FORM_MIN_ROWS,
    field.maxItems ?? PAPER_FORM_MIN_ROWS,
  );
}

function emptyControlForChild(
  child: QuestionnaireSchemaField,
  formatContext: QuestionnaireFieldFormatContext,
): QuestionnairePrintControl {
  return mapFieldToPrintControl(child, null, 'blank', formatContext, {
    nested: true,
  });
}

function buildRepeatingTable(
  field: QuestionnaireSchemaField,
  value: unknown,
  mode: 'blank' | 'filled',
  formatContext: QuestionnaireFieldFormatContext,
): QuestionnairePrintField {
  const children = field.children ?? [];
  const columns = children.map((c) => ({ key: c.key, label: c.label }));
  const minRows = minimumPaperRows(field);

  const makeEmptyRow = () => ({
    cells: children.map((child) => emptyControlForChild(child, formatContext)),
  });

  if (mode === 'blank') {
    return {
      kind: 'repeating_table',
      key: field.key,
      label: field.label,
      columns,
      rows: Array.from({ length: minRows }, makeEmptyRow),
    };
  }

  const dataRows = Array.isArray(value) ? value : [];
  const rows = dataRows.map((row) => {
    const rowObj =
      row && typeof row === 'object' && !Array.isArray(row)
        ? (row as Record<string, unknown>)
        : {};
    return {
      cells: children.map((child) =>
        mapFieldToPrintControl(
          child,
          rowObj[child.key],
          'filled',
          formatContext,
          { nested: true },
        ),
      ),
    };
  });

  while (rows.length < minRows) {
    rows.push(makeEmptyRow());
  }

  return {
    kind: 'repeating_table',
    key: field.key,
    label: field.label,
    columns,
    rows,
  };
}

function textLineControl(
  key: string,
  label: string,
  value: string | null,
): QuestionnairePrintControl {
  return { kind: 'text_line', key, label, value };
}

function emptyEmergencyControls(
  rowIndex: number,
): [
  QuestionnairePrintControl,
  QuestionnairePrintControl,
  QuestionnairePrintControl,
  QuestionnairePrintControl,
] {
  const p = `emergency.${rowIndex}`;
  return [
    textLineControl(`${p}.fullName`, 'ПІБ', null),
    textLineControl(`${p}.relationship`, 'Ким доводиться', null),
    textLineControl(`${p}.primaryPhone`, 'Основний телефон', null),
    textLineControl(`${p}.secondaryPhone`, 'Додатковий телефон', null),
  ];
}

function filledEmergencyControls(
  row: EmployeeContactsEmergencyItem,
  rowIndex: number,
): [
  QuestionnairePrintControl,
  QuestionnairePrintControl,
  QuestionnairePrintControl,
  QuestionnairePrintControl,
] {
  const p = `emergency.${rowIndex}`;
  return [
    textLineControl(
      `${p}.fullName`,
      'ПІБ',
      stringOrNull(row.fullName),
    ),
    textLineControl(
      `${p}.relationship`,
      'Ким доводиться',
      stringOrNull(row.relationship),
    ),
    textLineControl(
      `${p}.primaryPhone`,
      'Основний телефон',
      stringOrNull(row.primaryPhone),
    ),
    textLineControl(
      `${p}.secondaryPhone`,
      'Додатковий телефон',
      stringOrNull(row.secondaryPhone),
    ),
  ];
}

function buildContactsForm(
  field: QuestionnaireSchemaField,
  value: unknown,
  mode: 'blank' | 'filled',
): QuestionnairePrintField {
  const blankWork = (): QuestionnairePrintControl[] => [
    textLineControl(`${field.key}.work.email`, 'Робочий email', null),
    textLineControl(`${field.key}.work.phone`, 'Робочий телефон', null),
    textLineControl(`${field.key}.work.telegram`, 'Робочий Telegram', null),
  ];

  const blankPersonal = (): Array<{
    contactType: QuestionnairePrintPersonalContactType;
    primary: boolean;
    control: QuestionnairePrintControl;
  }> =>
    (
      Object.keys(BLANK_CONTACTS_PERSONAL_ROWS) as Array<
        keyof typeof BLANK_CONTACTS_PERSONAL_ROWS
      >
    ).flatMap((short) => {
      const contactType = PERSONAL_TYPE_BY_BLANK_KEY[short];
      const count = BLANK_CONTACTS_PERSONAL_ROWS[short];
      return Array.from({ length: count }, (_, i) => ({
        contactType,
        primary: false,
        control: textLineControl(
          `${field.key}.personal.${contactType}.${i}`,
          PERSONAL_TYPE_LABELS[contactType],
          null,
        ),
      }));
    });

  if (mode === 'blank') {
    return {
      kind: 'contacts_form',
      key: field.key,
      label: field.label,
      work: blankWork(),
      personal: blankPersonal(),
      emergency: Array.from({ length: BLANK_CONTACTS_EMERGENCY_ROWS }, (_, i) => ({
        controls: emptyEmergencyControls(i),
      })),
    };
  }

  const bundle = normalizeEmployeeContactsBundle(
    value ?? emptyEmployeeContactsBundle(),
  );

  const work: QuestionnairePrintControl[] = [
    textLineControl(
      `${field.key}.work.email`,
      'Робочий email',
      stringOrNull(bundle.work.email),
    ),
    textLineControl(
      `${field.key}.work.phone`,
      'Робочий телефон',
      stringOrNull(bundle.work.phone),
    ),
    textLineControl(
      `${field.key}.work.telegram`,
      'Робочий Telegram',
      stringOrNull(bundle.work.telegram),
    ),
  ];

  const personal: Array<{
    contactType: QuestionnairePrintPersonalContactType;
    primary: boolean;
    control: QuestionnairePrintControl;
  }> = bundle.personal.map((item: EmployeeContactsPersonalItem, i) => ({
    contactType: item.type,
    primary: item.isPrimary,
    control: textLineControl(
      `${field.key}.personal.${item.type}.${i}`,
      PERSONAL_TYPE_LABELS[item.type],
      stringOrNull(item.value),
    ),
  }));

  // Pad per contactType
  for (const short of Object.keys(
    BLANK_CONTACTS_PERSONAL_ROWS,
  ) as Array<keyof typeof BLANK_CONTACTS_PERSONAL_ROWS>) {
    const contactType = PERSONAL_TYPE_BY_BLANK_KEY[short];
    const min = BLANK_CONTACTS_PERSONAL_ROWS[short];
    let count = personal.filter((p) => p.contactType === contactType).length;
    while (count < min) {
      personal.push({
        contactType,
        primary: false,
        control: textLineControl(
          `${field.key}.personal.${contactType}.pad.${count}`,
          PERSONAL_TYPE_LABELS[contactType],
          null,
        ),
      });
      count += 1;
    }
  }

  const emergency = bundle.emergency.map((row, i) => ({
    controls: filledEmergencyControls(row, i),
  }));
  while (emergency.length < BLANK_CONTACTS_EMERGENCY_ROWS) {
    emergency.push({
      controls: emptyEmergencyControls(emergency.length),
    });
  }

  return {
    kind: 'contacts_form',
    key: field.key,
    label: field.label,
    work,
    personal,
    emergency,
  };
}

function ratingFromPolicy(
  policy: MatrixRatingPolicy,
  level: number | null,
): QuestionnairePrintSkillRating {
  const span = policy.max - policy.min;
  if (policy.kind === 'percent' || span > CHOICE_SCALE_MAX_SPAN) {
    return {
      kind: 'number',
      value: level,
      min: policy.min,
      max: policy.max,
      unit: policy.unit,
    };
  }
  const options: Array<{ value: number; label: string; checked: boolean }> =
    [];
  for (let v = policy.min; v <= policy.max; v += 1) {
    options.push({
      value: v,
      label: String(v),
      checked: level === v,
    });
  }
  return { kind: 'choice_scale', options };
}

function blankSkillRow(): QuestionnairePrintSkillRow {
  return {
    identity: { kind: 'blank' },
    label: null,
    rating: { kind: 'freehand', value: null },
    comment: null,
  };
}

function buildSkillsMatrix(
  field: QuestionnaireSchemaField,
  value: unknown,
  mode: 'blank' | 'filled',
  formatContext: QuestionnaireFieldFormatContext,
): QuestionnairePrintField {
  if (mode === 'blank') {
    return {
      kind: 'skills_matrix',
      key: field.key,
      label: field.label,
      rows: Array.from({ length: BLANK_SKILLS_MATRIX_ROWS }, blankSkillRow),
    };
  }

  let matrix: PositionSkillsMatrixAnswer = emptyPositionSkillsMatrix();
  try {
    matrix = parsePositionSkillsMatrixStrict(value ?? emptyPositionSkillsMatrix());
  } catch {
    matrix = emptyPositionSkillsMatrix();
  }

  const ratingsByCode = new Map(
    matrix.ratings.map((r) => [r.skillCode, r] as const),
  );

  const catalog = formatContext.matrixCatalogSkills;
  const contextVersion = formatContext.matrixContextVersion ?? null;
  const rows: QuestionnairePrintSkillRow[] = [];

  if (catalog != null) {
    // Frozen context
    for (const skill of catalog) {
      const rating = ratingsByCode.get(skill.code);
      const policy = resolveMatrixRatingPolicy(contextVersion, skill);
      rows.push({
        identity: { kind: 'catalog', code: skill.code },
        label: skill.labelUa,
        rating: ratingFromPolicy(policy, rating?.level ?? null),
        comment: rating?.comment ?? null,
      });
    }
  } else {
    // Legacy registry mode (context == null)
    const legacyPolicy = resolveMatrixRatingPolicy(null, null);
    for (const skill of SKILL_DEFINITIONS) {
      const rating = ratingsByCode.get(skill.code);
      rows.push({
        identity: { kind: 'catalog', code: skill.code },
        label: skill.labelUa,
        rating: ratingFromPolicy(legacyPolicy, rating?.level ?? null),
        comment: rating?.comment ?? null,
      });
    }
  }

  for (const custom of matrix.custom) {
    const policy = resolveMatrixRatingPolicy(contextVersion, null);
    rows.push({
      identity: { kind: 'custom', name: custom.name },
      label: custom.name,
      rating: ratingFromPolicy(policy, custom.level),
      comment: custom.comment,
    });
  }

  while (rows.length < BLANK_SKILLS_MATRIX_ROWS) {
    rows.push(blankSkillRow());
  }

  return {
    kind: 'skills_matrix',
    key: field.key,
    label: field.label,
    rows,
  };
}

function buildPrintField(
  field: QuestionnaireSchemaField,
  value: unknown,
  mode: 'blank' | 'filled',
  formatContext: QuestionnaireFieldFormatContext,
): QuestionnairePrintField {
  if (field.valueType === 'repeating_group') {
    return buildRepeatingTable(field, value, mode, formatContext);
  }
  if (field.valueType === 'contacts_bundle') {
    return buildContactsForm(field, value, mode);
  }
  if (field.valueType === 'position_skills_matrix') {
    return buildSkillsMatrix(field, value, mode, formatContext);
  }
  return mapFieldToPrintControl(field, value, mode, formatContext);
}

/**
 * Schema-driven paper-form print model (layout 2.0).
 * Blank ignores visibleWhen; filled applies it.
 * Blank is a visibility-superset of filled (field counts need not match).
 * Managing career_goals + probation_goals (and legacy single `goals`) coalesce to
 * one print section «Цілі» — field labels stay as nested paper controls.
 */
export function buildQuestionnairePrintModel(
  input: BuildQuestionnairePrintModelInput,
): QuestionnairePrintModel {
  const { schema, answers, mode, meta, formatContext } = input;
  const profileMirror = input.profileMirror ?? {};
  const byKey = fieldsByKey(schema);

  const mapped = (schema.steps ?? []).map((step) => {
    const fields: QuestionnairePrintField[] = [];
    for (const field of step.fields ?? []) {
      if (QUESTIONNAIRE_PRINT_OMIT_FIELD_KEYS.has(field.key)) {
        continue;
      }
      if (mode === 'filled' && !isQuestionnaireFieldVisible(field, answers)) {
        continue;
      }

      const resolved = resolveQuestionnaireFieldValue(field, {
        answers,
        profileMirror,
        fieldsByKey: byKey,
      });

      fields.push(
        buildPrintField(field, resolved.value, mode, formatContext),
      );
    }
    return {
      key: step.key,
      label: step.label,
      fields,
    };
  });

  return {
    mode,
    meta,
    steps: coalesceGoalsPrintSteps(mapped.filter((s) => s.fields.length > 0)),
  };
}

/** Schema step keys that project to a single PDF section «Цілі». */
const GOALS_PRINT_STEP_KEYS = new Set([
  'career_goals',
  'probation_goals',
  'goals',
]);

/**
 * Merge Managing goal steps into one print section so PDF page breaks match
 * the product parent «Цілі» (wizard keeps career/probation as rail substeps).
 */
export function coalesceGoalsPrintSteps(
  steps: QuestionnairePrintStep[],
): QuestionnairePrintStep[] {
  const out: QuestionnairePrintStep[] = [];
  let goalsFields: QuestionnairePrintField[] | null = null;

  const flushGoals = () => {
    if (!goalsFields) return;
    out.push({ key: 'goals', label: 'Цілі', fields: goalsFields });
    goalsFields = null;
  };

  for (const step of steps) {
    if (GOALS_PRINT_STEP_KEYS.has(step.key)) {
      if (!goalsFields) goalsFields = [];
      goalsFields.push(...step.fields);
      continue;
    }
    flushGoals();
    out.push(step);
  }
  flushGoals();
  return out;
}

/** Collect top-level field keys from a print model (for specs). */
export function listPrintModelFieldKeys(
  model: QuestionnairePrintModel,
): string[] {
  return model.steps.flatMap((s) => s.fields.map((f) => f.key));
}
