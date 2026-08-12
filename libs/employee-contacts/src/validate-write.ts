import { InvalidEmployeeContactsBundle } from './errors';
import { EMPLOYEE_CONTACTS_LIMITS } from './limits';
import {
  normalizeEmployeeContactsBundle,
  parseEmployeeContactsBundle,
} from './bundle';
import type { EmployeeContactsBundle } from './types';

function assertLength(label: string, value: string, max: number): void {
  if (value.length > max) {
    throw new InvalidEmployeeContactsBundle(
      `${label} exceeds max length ${max}`,
    );
  }
}

/** Strict parse for draft patch/submit — malformed → throw InvalidEmployeeContactsBundle. */
export function parseEmployeeContactsBundleStrict(
  input: unknown,
): EmployeeContactsBundle {
  if (input === null || input === undefined) {
    return normalizeEmployeeContactsBundle(null);
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new InvalidEmployeeContactsBundle('Invalid contacts bundle shape');
  }
  const src = input as Record<string, unknown>;
  if (src['work'] !== undefined && (typeof src['work'] !== 'object' || Array.isArray(src['work']))) {
    throw new InvalidEmployeeContactsBundle('Invalid work contacts shape');
  }
  if (src['personal'] !== undefined && !Array.isArray(src['personal'])) {
    throw new InvalidEmployeeContactsBundle('Invalid personal contacts shape');
  }
  if (src['emergency'] !== undefined && !Array.isArray(src['emergency'])) {
    throw new InvalidEmployeeContactsBundle('Invalid emergency contacts shape');
  }

  if (Array.isArray(src['personal'])) {
    const counts = new Map<string, number>();
    for (const item of src['personal']) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new InvalidEmployeeContactsBundle('Invalid personal contact row');
      }
      const row = item as Record<string, unknown>;
      const type = String(row['type'] ?? '');
      counts.set(type, (counts.get(type) ?? 0) + 1);
      const value = String(row['value'] ?? '').trim();
      if (value) assertLength('Personal contact value', value, EMPLOYEE_CONTACTS_LIMITS.valueMaxLength);
    }
    for (const [, count] of counts) {
      if (count > EMPLOYEE_CONTACTS_LIMITS.maxPersonalPerType) {
        throw new InvalidEmployeeContactsBundle(
          `Too many personal contacts (max ${EMPLOYEE_CONTACTS_LIMITS.maxPersonalPerType} per type)`,
        );
      }
    }
  }

  if (Array.isArray(src['emergency'])) {
    if (src['emergency'].length > EMPLOYEE_CONTACTS_LIMITS.maxEmergency) {
      throw new InvalidEmployeeContactsBundle(
        `Too many emergency contacts (max ${EMPLOYEE_CONTACTS_LIMITS.maxEmergency})`,
      );
    }
    for (const item of src['emergency']) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new InvalidEmployeeContactsBundle('Invalid emergency contact row');
      }
      const row = item as Record<string, unknown>;
      assertLength(
        'Emergency full name',
        String(row['fullName'] ?? '').trim(),
        EMPLOYEE_CONTACTS_LIMITS.fullNameMaxLength,
      );
      assertLength(
        'Emergency relationship',
        String(row['relationship'] ?? '').trim(),
        EMPLOYEE_CONTACTS_LIMITS.relationshipMaxLength,
      );
      assertLength(
        'Emergency primary phone',
        String(row['primaryPhone'] ?? '').trim(),
        EMPLOYEE_CONTACTS_LIMITS.phoneMaxLength,
      );
      assertLength(
        'Emergency secondary phone',
        String(row['secondaryPhone'] ?? '').trim(),
        EMPLOYEE_CONTACTS_LIMITS.phoneMaxLength,
      );
      assertLength(
        'Emergency notes',
        String(row['notes'] ?? '').trim(),
        EMPLOYEE_CONTACTS_LIMITS.notesMaxLength,
      );
    }
  }

  if (src['work'] && typeof src['work'] === 'object') {
    const work = src['work'] as Record<string, unknown>;
    for (const key of ['email', 'telegram'] as const) {
      const val = String(work[key] ?? '').trim();
      if (val) assertLength(`Work ${key}`, val, EMPLOYEE_CONTACTS_LIMITS.valueMaxLength);
    }
    const phone = String(work['phone'] ?? '').trim();
    if (phone) assertLength('Work phone', phone, EMPLOYEE_CONTACTS_LIMITS.phoneMaxLength);
  }

  try {
    return parseEmployeeContactsBundle(input);
  } catch {
    throw new InvalidEmployeeContactsBundle('Invalid contacts bundle');
  }
}

/** Write-time validation: non-empty emergency rows require fullName + primaryPhone. */
export function validateEmployeeContactsBundleForWrite(
  bundle: EmployeeContactsBundle,
): void {
  for (const row of bundle.emergency) {
    const hasAny =
      row.fullName.trim() ||
      row.relationship.trim() ||
      row.primaryPhone.trim() ||
      row.secondaryPhone.trim() ||
      row.notes.trim();
    if (!hasAny) continue;
    if (!row.fullName.trim() || !row.primaryPhone.trim()) {
      throw new InvalidEmployeeContactsBundle(
        'Emergency contact requires full name and primary phone',
      );
    }
  }
}
