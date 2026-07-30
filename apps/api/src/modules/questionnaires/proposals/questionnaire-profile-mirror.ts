import type { EmployeeContact } from '../../../organization/employees/employee-contact.entity';

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
};

/**
 * Flat keys MUST match schema `proposalMapping.field`
 * (e.g. personal_phone, not personalPhoneNumber).
 */
export function buildQuestionnaireProfileMirror(
  employee: EmployeeMirrorSource,
  contacts: Pick<EmployeeContact, 'type' | 'value' | 'isPrimary'>[] = [],
): Record<string, unknown> {
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

  return {
    lastName: employee.lastName,
    firstName: employee.firstName,
    middleName: employee.middleName,
    preferredName: employee.preferredName,
    birthDate: employee.birthDate,
    city: employee.city,
    preferredLanguage: employee.preferredLanguage,
    personal_phone: primaryPhone,
    personal_phone_secondary: secondaryPhone,
    personal_email: email,
    personal_telegram: telegram,
  };
}
