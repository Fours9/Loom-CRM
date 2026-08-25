import type { EmployeeProfileResponse } from '@loom/contracts-employees';
import {
  emptyEmployeeContactsBundle,
  legacyScalarsToContactsBundle,
  normalizeEmployeeContactsBundle,
  type EmployeeContactsBundle,
} from '@loom/employee-contacts';

export type EmployeeContactsEditorAccess = {
  work: { visible: boolean; editable: boolean };
  personal: { visible: boolean; editable: boolean };
  emergency: { visible: boolean; editable: boolean };
};

export function questionnaireContactsAccess(editable: boolean): EmployeeContactsEditorAccess {
  return {
    work: { visible: true, editable },
    personal: { visible: true, editable },
    emergency: { visible: true, editable },
  };
}

export function profileContactsAccess(
  profile: EmployeeProfileResponse,
): EmployeeContactsEditorAccess {
  return {
    work: {
      visible: true,
      editable: profile.capabilities.canEditBasic,
    },
    personal: {
      visible: profile.capabilities.canViewPersonal,
      editable: profile.capabilities.canEditPersonal,
    },
    emergency: {
      visible: profile.capabilities.canViewEmergencyContact,
      editable: profile.capabilities.canEditEmergencyContact,
    },
  };
}

export function contactsBundleFromProfile(
  profile: EmployeeProfileResponse,
): EmployeeContactsBundle {
  const contacts = profile.sections.contacts ?? [];
  const emergency = profile.sections.emergencyContact ?? [];

  return normalizeEmployeeContactsBundle({
    work: {
      email: profile.header.workEmail,
      phone: profile.header.workPhone,
      telegram: profile.header.workTelegram,
    },
    personal: contacts
      .filter((c) => c.type.startsWith('personal_'))
      .map((c) => ({
        type: c.type as EmployeeContactsBundle['personal'][number]['type'],
        value: c.value,
        isPrimary: c.isPrimary,
      })),
    emergency: emergency.map((e) => ({
      fullName: e.fullName,
      relationship: e.relationship ?? '',
      primaryPhone: e.primaryPhone,
      secondaryPhone: e.secondaryPhone ?? '',
      notes: e.notes ?? '',
    })),
  });
}

export function hydrateContactsBundleDisplay(input: {
  answers: Record<string, unknown>;
  profileMirror: Record<string, unknown>;
  employeeId: string | null;
}): EmployeeContactsBundle {
  if (Object.prototype.hasOwnProperty.call(input.answers, 'contacts.bundle')) {
    return normalizeEmployeeContactsBundle(input.answers['contacts.bundle']);
  }

  const legacyKeys = [
    'personal.phone_primary',
    'personal.phone_secondary',
    'personal.email',
    'personal.telegram',
  ];
  const hasLegacy = legacyKeys.some((key) =>
    Object.prototype.hasOwnProperty.call(input.answers, key),
  );

  let base = emptyEmployeeContactsBundle();
  if (
    Object.prototype.hasOwnProperty.call(input.profileMirror, 'contactsBundle')
  ) {
    base = normalizeEmployeeContactsBundle(input.profileMirror['contactsBundle']);
  }

  if (hasLegacy) {
    return legacyScalarsToContactsBundle(input.answers, base);
  }

  if (input.employeeId && base !== emptyEmployeeContactsBundle()) {
    return base;
  }

  if (!input.employeeId) {
    return emptyEmployeeContactsBundle();
  }

  return base;
}

export function shouldPersistContactsBundleEdit(
  answers: Record<string, unknown>,
): boolean {
  return Object.prototype.hasOwnProperty.call(answers, 'contacts.bundle');
}

export function mergeLegacyContactsIntoDraft(
  answers: Record<string, unknown>,
  profileMirror: Record<string, unknown>,
): Record<string, unknown> {
  if (Object.prototype.hasOwnProperty.call(answers, 'contacts.bundle')) {
    return answers;
  }
  const legacyKeys = [
    'personal.phone_primary',
    'personal.phone_secondary',
    'personal.email',
    'personal.telegram',
  ];
  if (!legacyKeys.some((key) => Object.prototype.hasOwnProperty.call(answers, key))) {
    return answers;
  }
  const base = Object.prototype.hasOwnProperty.call(
    profileMirror,
    'contactsBundle',
  )
    ? normalizeEmployeeContactsBundle(profileMirror['contactsBundle'])
    : emptyEmployeeContactsBundle();
  const next = { ...answers };
  next['contacts.bundle'] = legacyScalarsToContactsBundle(answers, base);
  for (const key of legacyKeys) {
    delete next[key];
  }
  return next;
}
