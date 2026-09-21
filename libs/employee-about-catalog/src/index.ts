export type {
  AboutSubtabId,
  AboutValueType,
  AboutOption,
  AboutVisibleWhen,
  AboutChildFieldDef,
  AboutFieldDef,
  AboutSubtabDef,
  CanonicalizeAboutResult,
  AboutProjectedField,
  AboutProjectedSubtab,
  ProjectEmployeeAboutResult,
} from './types';

export { AboutValidationError } from './types';

export { ABOUT_SUBTAB_DEFS, isAboutSubtabId } from './subtabs';

export {
  ABOUT_FIELD_DEFS,
  allAboutFieldKeys,
  aboutFieldByKey,
  fieldsForSubtab,
  isAboutFieldKey,
} from './fields';

export { canonicalizeAboutMutation } from './canonicalize';

export {
  validateAboutSubtabPatch,
  validateAboutSyncSet,
} from './validate';

export {
  formatAboutDisplayValue,
  projectEmployeeAbout,
  extractAboutKeysFromSnapshot,
} from './project';
