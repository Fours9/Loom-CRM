import { ABOUT_FIELD_DEFS, fieldsForSubtab } from './fields';
import { ABOUT_SUBTAB_DEFS } from './subtabs';
import type {
  AboutChildFieldDef,
  AboutFieldDef,
  AboutOption,
  AboutProjectedField,
  ProjectEmployeeAboutResult,
} from './types';

function optionLabel(
  options: readonly AboutOption[] | undefined,
  value: string,
): string {
  const hit = options?.find((o) => o.value === value);
  return hit ? hit.labelUa : `Невідоме значення: ${value}`;
}

function formatScalar(
  def: Pick<AboutFieldDef | AboutChildFieldDef, 'valueType' | 'options'>,
  value: unknown,
): string | null {
  if (value === null || value === undefined || value === '') return null;
  switch (def.valueType) {
    case 'text':
    case 'textarea':
    case 'date':
      return typeof value === 'string' ? value : String(value);
    case 'single_choice':
      return typeof value === 'string'
        ? optionLabel(def.options, value)
        : `Невідоме значення: ${String(value)}`;
    case 'multi_choice': {
      if (!Array.isArray(value)) return String(value);
      if (!value.length) return null;
      return value
        .map((v) =>
          typeof v === 'string' ? optionLabel(def.options, v) : String(v),
        )
        .join(', ');
    }
    default:
      return String(value);
  }
}

function formatRepeatingGroup(def: AboutFieldDef, value: unknown): string | null {
  if (!Array.isArray(value) || !value.length) return null;
  const children = def.children ?? [];
  const rows: string[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const src = row as Record<string, unknown>;
    const parts: string[] = [];
    for (const child of children) {
      if (!Object.prototype.hasOwnProperty.call(src, child.key)) continue;
      const formatted = formatScalar(child, src[child.key]);
      if (formatted == null) continue;
      parts.push(`${child.labelUa}: ${formatted}`);
    }
    if (parts.length) rows.push(parts.join('; '));
  }
  return rows.length ? rows.join(' | ') : null;
}

export function formatAboutDisplayValue(
  def: AboutFieldDef,
  raw: unknown,
): string | null {
  if (raw === null || raw === undefined) return null;
  if (def.valueType === 'repeating_group') {
    return formatRepeatingGroup(def, raw);
  }
  return formatScalar(def, raw);
}

export function projectEmployeeAbout(input: {
  answers: Record<string, unknown>;
}): ProjectEmployeeAboutResult {
  const answers = input.answers ?? {};
  const subtabs = ABOUT_SUBTAB_DEFS.map((sub) => {
    const fields: AboutProjectedField[] = fieldsForSubtab(sub.id).map((def) => {
      const raw = Object.prototype.hasOwnProperty.call(answers, def.key)
        ? answers[def.key]
        : null;
      return {
        key: def.key,
        labelUa: def.labelUa,
        valueType: def.valueType,
        raw: raw ?? null,
        displayValue: formatAboutDisplayValue(def, raw),
        options: def.options,
        children: def.children,
        maxItems: def.maxItems,
      };
    });
    return {
      id: sub.id,
      labelUa: sub.labelUa,
      fields,
    };
  });

  return { answers, subtabs };
}

/** Extract About keys present in a snapshot (present-only). */
export function extractAboutKeysFromSnapshot(
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  for (const def of ABOUT_FIELD_DEFS) {
    if (!Object.prototype.hasOwnProperty.call(snapshot, def.key)) continue;
    set[def.key] = snapshot[def.key];
  }
  return set;
}
