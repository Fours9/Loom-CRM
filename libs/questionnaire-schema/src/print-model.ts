import type {
  QuestionnairePrintField,
  QuestionnairePrintMeta,
  QuestionnairePrintModel,
  QuestionnaireSchemaField,
  QuestionnaireSchemaJson,
} from '@loom/contracts-questionnaires';
import { isQuestionnaireFieldVisible } from './field-visibility';
import {
  formatQuestionnaireFieldDisplay,
  type QuestionnaireFieldFormatContext,
} from './field-display-format';
import { resolveQuestionnaireFieldValue } from './field-value-resolve';
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

function displayOrNull(formatted: string): string | null {
  if (!formatted || formatted === '—') return null;
  return formatted;
}

function buildScalarField(
  field: QuestionnaireSchemaField,
  value: unknown,
  mode: 'blank' | 'filled',
  formatContext: QuestionnaireFieldFormatContext,
): QuestionnairePrintField {
  if (mode === 'blank') {
    return {
      kind: 'scalar',
      key: field.key,
      label: field.label,
      valueType: field.valueType,
      display: null,
    };
  }
  const formatted = formatQuestionnaireFieldDisplay(
    field,
    value,
    formatContext,
  );
  return {
    kind: 'scalar',
    key: field.key,
    label: field.label,
    valueType: field.valueType,
    display: displayOrNull(formatted),
  };
}

function buildRepeatingField(
  field: QuestionnaireSchemaField,
  value: unknown,
  mode: 'blank' | 'filled',
  formatContext: QuestionnaireFieldFormatContext,
): QuestionnairePrintField {
  const children = field.children ?? [];
  const emptyRow = {
    cells: children.map((child) => ({
      key: child.key,
      label: child.label,
      display: null as string | null,
    })),
  };

  if (mode === 'blank') {
    return {
      kind: 'repeating_group',
      key: field.key,
      label: field.label,
      rows: [emptyRow],
    };
  }

  const dataRows = Array.isArray(value) ? value : [];
  if (!dataRows.length) {
    return {
      kind: 'repeating_group',
      key: field.key,
      label: field.label,
      rows: [emptyRow],
    };
  }

  return {
    kind: 'repeating_group',
    key: field.key,
    label: field.label,
    rows: dataRows.map((row) => {
      const rowObj =
        row && typeof row === 'object' && !Array.isArray(row)
          ? (row as Record<string, unknown>)
          : {};
      return {
        cells: children.map((child) => {
          const cellValue = rowObj[child.key];
          const formatted = formatQuestionnaireFieldDisplay(
            child,
            cellValue,
            formatContext,
          );
          return {
            key: child.key,
            label: child.label,
            display: displayOrNull(formatted),
          };
        }),
      };
    }),
  };
}

/**
 * Schema-driven print model. Blank ignores visibleWhen; filled applies it.
 * Blank is a visibility-superset of filled (field counts need not match).
 */
export function buildQuestionnairePrintModel(
  input: BuildQuestionnairePrintModelInput,
): QuestionnairePrintModel {
  const {
    schema,
    answers,
    mode,
    meta,
    formatContext,
  } = input;
  const profileMirror = input.profileMirror ?? {};
  const byKey = fieldsByKey(schema);

  const steps = (schema.steps ?? []).map((step) => {
    const fields: QuestionnairePrintField[] = [];
    for (const field of step.fields ?? []) {
      if (mode === 'filled' && !isQuestionnaireFieldVisible(field, answers)) {
        continue;
      }

      const resolved = resolveQuestionnaireFieldValue(field, {
        answers,
        profileMirror,
        fieldsByKey: byKey,
      });

      if (field.valueType === 'repeating_group') {
        fields.push(
          buildRepeatingField(field, resolved.value, mode, formatContext),
        );
      } else {
        fields.push(
          buildScalarField(field, resolved.value, mode, formatContext),
        );
      }
    }
    return {
      key: step.key,
      label: step.label,
      fields,
    };
  });

  return { mode, meta, steps };
}

/** Collect top-level field keys from a print model (for specs). */
export function listPrintModelFieldKeys(
  model: QuestionnairePrintModel,
): string[] {
  return model.steps.flatMap((s) => s.fields.map((f) => f.key));
}
