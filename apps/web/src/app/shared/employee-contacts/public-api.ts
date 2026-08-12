export {
  EmployeeContactsEditorComponent,
} from './employee-contacts-editor.component';
export {
  contactsBundleFromProfile,
  hydrateContactsBundleDisplay,
  mergeLegacyContactsIntoDraft,
  profileContactsAccess,
  questionnaireContactsAccess,
  shouldPersistContactsBundleEdit,
  type EmployeeContactsEditorAccess,
} from './employee-contacts.mappers';

export type {
  EmployeeContactsBundle,
  EmployeeContactsEmergencyItem,
  EmployeeContactsPersonalItem,
  EmployeeContactsWorkSlice,
} from '@loom/employee-contacts';

export {
  emptyEmployeeContactsBundle,
  normalizeEmployeeContactsBundle,
  formatContactsBundleReviewSummary,
} from '@loom/employee-contacts';
