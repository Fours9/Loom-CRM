import { aboutFieldByKey, fieldsForSubtab } from './fields';
import {
  AboutValidationError,
  type AboutChildFieldDef,
  type AboutFieldDef,
  type AboutSubtabId,
} from './types';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function optionValues(def: { options?: readonly { value: string }[] }): Set<string> {
  return new Set((def.options ?? []).map((o) => o.value));
}

function assertDate(value: unknown, path: string): void {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) {
    throw new AboutValidationError(`${path}: expected YYYY-MM-DD date`);
  }
}

function assertText(
  value: unknown,
  path: string,
  maxLength: number | undefined,
): void {
  if (typeof value !== 'string') {
    throw new AboutValidationError(`${path}: expected string`);
  }
  if (maxLength != null && value.length > maxLength) {
    throw new AboutValidationError(
      `${path}: exceeds maxLength ${maxLength}`,
    );
  }
}

function validateScalarChild(
  child: AboutChildFieldDef,
  value: unknown,
  path: string,
): void {
  switch (child.valueType) {
    case 'text':
    case 'textarea':
      assertText(value, path, child.maxLength);
      return;
    case 'date':
      assertDate(value, path);
      return;
    case 'single_choice': {
      if (typeof value !== 'string') {
        throw new AboutValidationError(`${path}: expected string option`);
      }
      const allowed = optionValues(child);
      if (allowed.size && !allowed.has(value)) {
        throw new AboutValidationError(`${path}: invalid option ${value}`);
      }
      return;
    }
    case 'multi_choice': {
      if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
        throw new AboutValidationError(`${path}: expected string[]`);
      }
      const allowed = optionValues(child);
      for (const v of value) {
        if (allowed.size && !allowed.has(v)) {
          throw new AboutValidationError(`${path}: invalid option ${v}`);
        }
      }
      return;
    }
    default:
      throw new AboutValidationError(`${path}: unsupported child type`);
  }
}

function validateFieldValue(def: AboutFieldDef, value: unknown): void {
  const path = def.key;
  switch (def.valueType) {
    case 'text':
    case 'textarea':
      assertText(value, path, def.maxLength);
      return;
    case 'date':
      assertDate(value, path);
      return;
    case 'single_choice': {
      if (typeof value !== 'string') {
        throw new AboutValidationError(`${path}: expected string option`);
      }
      const allowed = optionValues(def);
      if (allowed.size && !allowed.has(value)) {
        throw new AboutValidationError(`${path}: invalid option ${value}`);
      }
      return;
    }
    case 'multi_choice': {
      if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
        throw new AboutValidationError(`${path}: expected string[]`);
      }
      const allowed = optionValues(def);
      for (const v of value) {
        if (allowed.size && !allowed.has(v)) {
          throw new AboutValidationError(`${path}: invalid option ${v}`);
        }
      }
      return;
    }
    case 'repeating_group': {
      if (!Array.isArray(value)) {
        throw new AboutValidationError(`${path}: expected array`);
      }
      if (def.maxItems != null && value.length > def.maxItems) {
        throw new AboutValidationError(
          `${path}: exceeds maxItems ${def.maxItems}`,
        );
      }
      const childDefs = def.children ?? [];
      const childKeys = new Set(childDefs.map((c) => c.key));
      for (let i = 0; i < value.length; i++) {
        const row = value[i];
        if (!row || typeof row !== 'object' || Array.isArray(row)) {
          throw new AboutValidationError(`${path}[${i}]: expected object`);
        }
        const src = row as Record<string, unknown>;
        for (const k of Object.keys(src)) {
          if (!childKeys.has(k)) {
            throw new AboutValidationError(
              `${path}[${i}]: unknown child key ${k}`,
            );
          }
        }
        for (const child of childDefs) {
          if (!Object.prototype.hasOwnProperty.call(src, child.key)) continue;
          const v = src[child.key];
          if (v === null || v === undefined) continue;
          validateScalarChild(child, v, `${path}[${i}].${child.key}`);
        }
      }
      return;
    }
    default:
      throw new AboutValidationError(`${path}: unsupported valueType`);
  }
}

/**
 * Validate PATCH values for one subtab.
 * `null` means clear — allowed without type check.
 * Returns { set, clearKeys } before canonicalizeAboutMutation.
 */
export function validateAboutSubtabPatch(input: {
  subtabId: AboutSubtabId;
  values: Record<string, unknown>;
}): { set: Record<string, unknown>; clearKeys: string[] } {
  const allowed = new Set(fieldsForSubtab(input.subtabId).map((f) => f.key));
  const set: Record<string, unknown> = {};
  const clearKeys: string[] = [];

  for (const [key, value] of Object.entries(input.values)) {
    if (!allowed.has(key)) {
      throw new AboutValidationError(
        `key ${key} not allowed on subtab ${input.subtabId}`,
      );
    }
    if (value === null) {
      clearKeys.push(key);
      continue;
    }
    const def = aboutFieldByKey(key);
    if (!def) {
      throw new AboutValidationError(`unknown key ${key}`);
    }
    validateFieldValue(def, value);
    set[key] = value;
  }

  return { set, clearKeys };
}

/** Validate a sync subset (all keys must be About keys; no nulls expected). */
export function validateAboutSyncSet(
  set: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(set)) {
    const def = aboutFieldByKey(key);
    if (!def) continue;
    if (value === null || value === undefined) continue;
    validateFieldValue(def, value);
    out[key] = value;
  }
  return out;
}
