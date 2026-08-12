import { EMPLOYEE_CONTACTS_LIMITS } from './limits';
import {
  PERSONAL_CONTACT_TYPES,
  type EmployeeContactsBundle,
  type EmployeeContactsEmergencyItem,
  type EmployeeContactsPersonalItem,
  type PersonalContactType,
} from './types';

export function emptyEmployeeContactsBundle(): EmployeeContactsBundle {
  return {
    work: { email: null, phone: null, telegram: null },
    personal: [],
    emergency: [],
  };
}

function trimOrNull(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function trimOrEmpty(value: unknown, maxLength: number): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, maxLength);
}

function isPersonalContactType(type: string): type is PersonalContactType {
  return (PERSONAL_CONTACT_TYPES as readonly string[]).includes(type);
}

function isPersonalRowEmpty(row: EmployeeContactsPersonalItem): boolean {
  return !row.value.trim();
}

function isEmergencyRowEmpty(row: EmployeeContactsEmergencyItem): boolean {
  return (
    !row.fullName.trim() &&
    !row.relationship.trim() &&
    !row.primaryPhone.trim() &&
    !row.secondaryPhone.trim() &&
    !row.notes.trim()
  );
}

function normalizeWork(work: unknown): EmployeeContactsBundle['work'] {
  const src =
    work && typeof work === 'object' && !Array.isArray(work)
      ? (work as Record<string, unknown>)
      : {};
  return {
    email: trimOrNull(src['email'], EMPLOYEE_CONTACTS_LIMITS.valueMaxLength),
    phone: trimOrNull(src['phone'], EMPLOYEE_CONTACTS_LIMITS.phoneMaxLength),
    telegram: trimOrNull(src['telegram'], EMPLOYEE_CONTACTS_LIMITS.valueMaxLength),
  };
}

function normalizePersonalRows(
  personal: unknown,
): EmployeeContactsPersonalItem[] {
  if (!Array.isArray(personal)) return [];

  const byType = new Map<PersonalContactType, EmployeeContactsPersonalItem[]>();
  for (const type of PERSONAL_CONTACT_TYPES) {
    byType.set(type, []);
  }

  for (const item of personal) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const type = String(row['type'] ?? '');
    if (!isPersonalContactType(type)) continue;
    const value = trimOrEmpty(row['value'], EMPLOYEE_CONTACTS_LIMITS.valueMaxLength);
    if (!value) continue;
    byType.get(type)!.push({
      type,
      value,
      isPrimary: Boolean(row['isPrimary']),
    });
  }

  const normalized: EmployeeContactsPersonalItem[] = [];
  for (const type of PERSONAL_CONTACT_TYPES) {
    const rows = byType.get(type)!;
    if (rows.length > EMPLOYEE_CONTACTS_LIMITS.maxPersonalPerType) {
      rows.length = EMPLOYEE_CONTACTS_LIMITS.maxPersonalPerType;
    }
    if (!rows.length) continue;
    let primaryIndex = rows.findIndex((r) => r.isPrimary);
    if (primaryIndex < 0) primaryIndex = 0;
    rows.forEach((row, index) => {
      normalized.push({
        ...row,
        isPrimary: index === primaryIndex,
      });
    });
  }

  return normalized.filter((row) => !isPersonalRowEmpty(row));
}

function normalizeEmergencyRows(
  emergency: unknown,
): EmployeeContactsEmergencyItem[] {
  if (!Array.isArray(emergency)) return [];

  const rows: EmployeeContactsEmergencyItem[] = [];
  for (const item of emergency) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const normalized: EmployeeContactsEmergencyItem = {
      fullName: trimOrEmpty(
        row['fullName'],
        EMPLOYEE_CONTACTS_LIMITS.fullNameMaxLength,
      ),
      relationship: trimOrEmpty(
        row['relationship'],
        EMPLOYEE_CONTACTS_LIMITS.relationshipMaxLength,
      ),
      primaryPhone: trimOrEmpty(
        row['primaryPhone'],
        EMPLOYEE_CONTACTS_LIMITS.phoneMaxLength,
      ),
      secondaryPhone: trimOrEmpty(
        row['secondaryPhone'],
        EMPLOYEE_CONTACTS_LIMITS.phoneMaxLength,
      ),
      notes: trimOrEmpty(row['notes'], EMPLOYEE_CONTACTS_LIMITS.notesMaxLength),
    };
    if (isEmergencyRowEmpty(normalized)) continue;
    rows.push(normalized);
    if (rows.length >= EMPLOYEE_CONTACTS_LIMITS.maxEmergency) break;
  }
  return rows;
}

/** Draft-safe parse + normalize (shape/limits; partial emergency OK). */
export function normalizeEmployeeContactsBundle(
  input: unknown,
): EmployeeContactsBundle {
  if (input === null || input === undefined) {
    return emptyEmployeeContactsBundle();
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return emptyEmployeeContactsBundle();
  }
  const src = input as Record<string, unknown>;
  return {
    work: normalizeWork(src['work']),
    personal: normalizePersonalRows(src['personal']),
    emergency: normalizeEmergencyRows(src['emergency']),
  };
}

export function parseEmployeeContactsBundle(input: unknown): EmployeeContactsBundle {
  if (input === null || input === undefined) {
    return emptyEmployeeContactsBundle();
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Invalid contacts bundle shape');
  }
  return normalizeEmployeeContactsBundle(input);
}

function sortPersonal(
  a: EmployeeContactsPersonalItem,
  b: EmployeeContactsPersonalItem,
): number {
  if (a.type !== b.type) return a.type.localeCompare(b.type);
  if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
  return a.value.localeCompare(b.value);
}

function sortEmergency(
  a: EmployeeContactsEmergencyItem,
  b: EmployeeContactsEmergencyItem,
): number {
  const nameCmp = a.fullName.localeCompare(b.fullName);
  if (nameCmp !== 0) return nameCmp;
  return a.primaryPhone.localeCompare(b.primaryPhone);
}

/** Stable canonical form for snapshot / stale compare. */
export function canonicalEmployeeContactsBundle(
  bundle: EmployeeContactsBundle,
): EmployeeContactsBundle {
  return {
    work: {
      email: bundle.work.email,
      phone: bundle.work.phone,
      telegram: bundle.work.telegram,
    },
    personal: [...bundle.personal].sort(sortPersonal),
    emergency: [...bundle.emergency].sort(sortEmergency),
  };
}

export function isEmployeeContactsBundleMeaningful(
  bundle: EmployeeContactsBundle,
): boolean {
  const canonical = canonicalEmployeeContactsBundle(bundle);
  if (
    canonical.work.email ||
    canonical.work.phone ||
    canonical.work.telegram
  ) {
    return true;
  }
  if (canonical.personal.length > 0) return true;
  if (canonical.emergency.length > 0) return true;
  return false;
}

export function employeeContactsBundlesEqual(
  a: EmployeeContactsBundle,
  b: EmployeeContactsBundle,
): boolean {
  return (
    JSON.stringify(canonicalEmployeeContactsBundle(a)) ===
    JSON.stringify(canonicalEmployeeContactsBundle(b))
  );
}
