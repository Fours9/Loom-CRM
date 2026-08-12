export {
  emptyEmployeeContactsBundle,
  normalizeEmployeeContactsBundle,
  parseEmployeeContactsBundle,
  canonicalEmployeeContactsBundle,
  isEmployeeContactsBundleMeaningful,
  employeeContactsBundlesEqual,
} from './bundle';

export {
  parseEmployeeContactsBundleStrict,
  validateEmployeeContactsBundleForWrite,
} from './validate-write';

export { InvalidEmployeeContactsBundle } from './errors';

export { EMPLOYEE_CONTACTS_LIMITS } from './limits';

export type {
  EmployeeContactsBundle,
  EmployeeContactsWorkSlice,
  EmployeeContactsPersonalItem,
  EmployeeContactsEmergencyItem,
  PersonalContactType,
} from './types';

export { PERSONAL_CONTACT_TYPES } from './types';

export {
  legacyScalarsToContactsBundle,
  contactsBundleFromProfileParts,
} from './legacy-map';

export { formatContactsBundleReviewSummary } from './review-summary';
