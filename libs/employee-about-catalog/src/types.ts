/** About Profile Core field catalog — pure, no Nest/TypeORM. */

export type AboutSubtabId =
  | 'family_home'
  | 'celebrations'
  | 'hobbies'
  | 'strengths'
  | 'work_style'
  | 'life_goals';

export type AboutValueType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'single_choice'
  | 'multi_choice'
  | 'repeating_group';

export type AboutOption = {
  value: string;
  labelUa: string;
};

export type AboutVisibleWhen = {
  key: string;
  equals: string;
};

export type AboutChildFieldDef = {
  key: string;
  labelUa: string;
  valueType: Exclude<AboutValueType, 'repeating_group'>;
  options?: readonly AboutOption[];
  maxLength?: number;
};

export type AboutFieldDef = {
  key: string;
  subtab: AboutSubtabId;
  labelUa: string;
  valueType: AboutValueType;
  options?: readonly AboutOption[];
  children?: readonly AboutChildFieldDef[];
  maxItems?: number;
  maxLength?: number;
  visibleWhen?: AboutVisibleWhen;
};

export type AboutSubtabDef = {
  id: AboutSubtabId;
  labelUa: string;
  purposeUa: string;
};

export type CanonicalizeAboutResult = {
  set: Record<string, unknown>;
  clearKeys: string[];
};

export type AboutProjectedField = {
  key: string;
  labelUa: string;
  valueType: AboutValueType;
  raw: unknown;
  displayValue: string | null;
  options?: readonly AboutOption[];
};

export type AboutProjectedSubtab = {
  id: AboutSubtabId;
  labelUa: string;
  fields: AboutProjectedField[];
};

export type ProjectEmployeeAboutResult = {
  answers: Record<string, unknown>;
  subtabs: AboutProjectedSubtab[];
};

export class AboutValidationError extends Error {
  readonly code = 'ABOUT_VALIDATION';
  constructor(message: string) {
    super(message);
    this.name = 'AboutValidationError';
  }
}
