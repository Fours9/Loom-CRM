import type { EmployeeContact } from '../../../organization/employees/employee-contact.entity';
import {
  contactsBundleFromProfileParts,
  type EmployeeContactsBundle,
} from '@loom/employee-contacts';

type EmployeeMirrorSource = {
  lastName: string;
  firstName: string;
  middleName: string | null;
  preferredName: string | null;
  birthDate: string | null;
  city: string | null;
  preferredLanguage: string | null;
  personalPhoneNumber: string | null;
  personalEmail: string | null;
  personalTelegram: string | null;
  workEmail?: string | null;
  workPhone?: string | null;
  workTelegram?: string | null;
};

export type EmploymentMirrorSlice = {
  directionId: string | null;
  departmentId: string | null;
  positionId: string | null;
  workFormat: string | null;
  employmentType: string | null;
  startDate: string | null;
  probationEndDate: string | null;
};

export type ProfileMirrorOptions = {
  /** Owner/admin personal visibility — birthDate, city, preferred*, personal contacts. */
  includePersonal?: boolean;
  /** Actor can view employment / profile work fields. */
  includeEmployment?: boolean;
  employment?: EmploymentMirrorSlice | null;
};

/**
 * Flat keys MUST match schema `proposalMapping.field` / `profileMirrorKey`.
 * `contactsBundle` holds canonical bundle for contacts.bundle hydrate.
 * ACL slicing is applied via options — not `canEditDraft ⇒ full mirror`.
 */
export function buildQuestionnaireProfileMirror(
  employee: EmployeeMirrorSource,
  contacts: Pick<EmployeeContact, 'type' | 'value' | 'isPrimary'>[] = [],
  contactsBundle?: EmployeeContactsBundle | null,
  options: ProfileMirrorOptions = {},
): Record<string, unknown> {
  const includePersonal = options.includePersonal !== false;
  const includeEmployment = options.includeEmployment === true;

  const mirror: Record<string, unknown> = {
    lastName: employee.lastName,
    firstName: employee.firstName,
    middleName: employee.middleName,
  };

  if (includePersonal) {
    const primaryPhone =
      contacts.find((c) => c.type === 'personal_phone' && c.isPrimary)?.value ??
      employee.personalPhoneNumber;
    const secondaryPhone =
      contacts.find((c) => c.type === 'personal_phone' && !c.isPrimary)?.value ??
      null;
    const email =
      contacts.find((c) => c.type === 'personal_email' && c.isPrimary)?.value ??
      employee.personalEmail;
    const telegram =
      contacts.find((c) => c.type === 'personal_telegram' && c.isPrimary)
        ?.value ?? employee.personalTelegram;

    const bundle =
      contactsBundle ??
      contactsBundleFromProfileParts({
        workEmail: employee.workEmail ?? null,
        workPhone: employee.workPhone ?? null,
        workTelegram: employee.workTelegram ?? null,
        personalContacts: contacts.map((c) => ({
          type: c.type,
          value: c.value,
          isPrimary: c.isPrimary,
        })),
      });

    mirror.preferredName = employee.preferredName;
    mirror.birthDate = employee.birthDate;
    mirror.city = employee.city;
    mirror.preferredLanguage = employee.preferredLanguage;
    mirror.personal_phone = primaryPhone;
    mirror.personal_phone_secondary = secondaryPhone;
    mirror.personal_email = email;
    mirror.personal_telegram = telegram;
    mirror.contactsBundle = bundle;
  }

  if (includeEmployment && options.employment) {
    const e = options.employment;
    mirror.directionId = e.directionId;
    mirror.departmentId = e.departmentId;
    mirror.positionId = e.positionId;
    mirror.workFormat = e.workFormat;
    mirror.employmentType = e.employmentType;
    mirror.startDate = e.startDate;
    mirror.probationEndDate = e.probationEndDate;
  }

  return mirror;
}
