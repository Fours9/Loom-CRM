import {
  emptyEmployeeContactsBundle,
  normalizeEmployeeContactsBundle,
} from './bundle';
import type {
  EmployeeContactsBundle,
  EmployeeContactsPersonalItem,
  PersonalContactType,
} from './types';

type LegacyScalarAnswers = Record<string, unknown>;

const LEGACY_PERSONAL_KEYS: Array<{
  answerKey: string;
  type: PersonalContactType;
  asPrimary: boolean;
}> = [
  { answerKey: 'personal.phone_primary', type: 'personal_phone', asPrimary: true },
  {
    answerKey: 'personal.phone_secondary',
    type: 'personal_phone',
    asPrimary: false,
  },
  { answerKey: 'personal.email', type: 'personal_email', asPrimary: true },
  { answerKey: 'personal.telegram', type: 'personal_telegram', asPrimary: true },
];

/** Map legacy flat questionnaire answers into a contacts bundle overlay. */
export function legacyScalarsToContactsBundle(
  answers: LegacyScalarAnswers,
  base: EmployeeContactsBundle = emptyEmployeeContactsBundle(),
): EmployeeContactsBundle {
  const bundle = normalizeEmployeeContactsBundle(base);
  const personal: EmployeeContactsPersonalItem[] = [...bundle.personal];

  for (const mapping of LEGACY_PERSONAL_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(answers, mapping.answerKey)) {
      continue;
    }
    const raw = answers[mapping.answerKey];
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) continue;
    personal.push({
      type: mapping.type,
      value,
      isPrimary: mapping.asPrimary,
    });
  }

  return normalizeEmployeeContactsBundle({
    ...bundle,
    personal,
  });
}

export function contactsBundleFromProfileParts(input: {
  workEmail?: string | null;
  workPhone?: string | null;
  workTelegram?: string | null;
  personalContacts?: Array<{
    type: string;
    value: string;
    isPrimary: boolean;
  }>;
  emergencyContacts?: Array<{
    fullName: string;
    relationship?: string | null;
    primaryPhone: string;
    secondaryPhone?: string | null;
    notes?: string | null;
  }>;
}): EmployeeContactsBundle {
  return normalizeEmployeeContactsBundle({
    work: {
      email: input.workEmail ?? null,
      phone: input.workPhone ?? null,
      telegram: input.workTelegram ?? null,
    },
    personal: (input.personalContacts ?? []).map((c) => ({
      type: c.type,
      value: c.value,
      isPrimary: c.isPrimary,
    })),
    emergency: (input.emergencyContacts ?? []).map((c) => ({
      fullName: c.fullName,
      relationship: c.relationship ?? '',
      primaryPhone: c.primaryPhone,
      secondaryPhone: c.secondaryPhone ?? '',
      notes: c.notes ?? '',
    })),
  });
}
