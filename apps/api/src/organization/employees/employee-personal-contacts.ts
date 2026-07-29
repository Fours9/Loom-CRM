import type { EmployeeContactType } from './employee-contact.entity';

export const PERSONAL_CONTACT_TYPES = [
  'personal_phone',
  'personal_email',
  'personal_telegram',
] as const satisfies readonly EmployeeContactType[];

export type PersonalContactType = (typeof PERSONAL_CONTACT_TYPES)[number];

export function isPersonalContactType(type: string): type is PersonalContactType {
  return (PERSONAL_CONTACT_TYPES as readonly string[]).includes(type);
}

export type PersonalContactWriteInput = {
  type: PersonalContactType;
  value: string;
  isPrimary?: boolean;
};

export type PersonalContactReadSlice = {
  type: string;
  value: string;
  isPrimary: boolean;
};

export type LegacyPersonalColumns = {
  personalPhoneNumber: string | null;
  personalEmail: string | null;
  personalTelegram: string | null;
};

const LEGACY_BY_TYPE: Record<
  PersonalContactType,
  keyof LegacyPersonalColumns
> = {
  personal_phone: 'personalPhoneNumber',
  personal_email: 'personalEmail',
  personal_telegram: 'personalTelegram',
};

export function resolvePrimaryPersonalValue(
  contacts: PersonalContactReadSlice[],
  type: PersonalContactType,
  legacy: LegacyPersonalColumns,
): string | null {
  const ofType = contacts.filter((c) => c.type === type && c.value?.trim());
  const primary = ofType.find((c) => c.isPrimary) ?? ofType[0];
  if (primary?.value?.trim()) return primary.value.trim();
  const legacyValue = legacy[LEGACY_BY_TYPE[type]];
  return legacyValue?.trim() || null;
}

export function legacyPersonalFromContacts(
  contacts: PersonalContactReadSlice[],
): LegacyPersonalColumns {
  const empty: LegacyPersonalColumns = {
    personalPhoneNumber: null,
    personalEmail: null,
    personalTelegram: null,
  };
  for (const type of PERSONAL_CONTACT_TYPES) {
    empty[LEGACY_BY_TYPE[type]] = resolvePrimaryPersonalValue(
      contacts,
      type,
      empty,
    );
  }
  return empty;
}

/** Normalize write payload: trim, drop empties, enforce one primary per type. */
export function normalizePersonalContactsForWrite(
  contacts: PersonalContactWriteInput[],
): Array<{ type: PersonalContactType; value: string; isPrimary: boolean }> {
  const byType = new Map<
    PersonalContactType,
    Array<{ type: PersonalContactType; value: string; isPrimary: boolean }>
  >();

  for (const type of PERSONAL_CONTACT_TYPES) {
    byType.set(type, []);
  }

  for (const item of contacts) {
    if (!isPersonalContactType(item.type)) {
      throw new Error(`Invalid personal contact type: ${item.type}`);
    }
    const value = item.value.trim();
    if (!value) continue;
    byType.get(item.type)!.push({
      type: item.type,
      value,
      isPrimary: Boolean(item.isPrimary),
    });
  }

  const normalized: Array<{
    type: PersonalContactType;
    value: string;
    isPrimary: boolean;
  }> = [];

  for (const type of PERSONAL_CONTACT_TYPES) {
    const rows = byType.get(type)!;
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

  return normalized;
}
