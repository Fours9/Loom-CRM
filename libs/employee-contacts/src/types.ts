export const PERSONAL_CONTACT_TYPES = [
  'personal_phone',
  'personal_email',
  'personal_telegram',
] as const;

export type PersonalContactType = (typeof PERSONAL_CONTACT_TYPES)[number];

export type EmployeeContactsWorkSlice = {
  email: string | null;
  phone: string | null;
  telegram: string | null;
};

export type EmployeeContactsPersonalItem = {
  type: PersonalContactType;
  value: string;
  isPrimary: boolean;
};

export type EmployeeContactsEmergencyItem = {
  fullName: string;
  relationship: string;
  primaryPhone: string;
  secondaryPhone: string;
  notes: string;
};

export type EmployeeContactsBundle = {
  work: EmployeeContactsWorkSlice;
  personal: EmployeeContactsPersonalItem[];
  emergency: EmployeeContactsEmergencyItem[];
};
