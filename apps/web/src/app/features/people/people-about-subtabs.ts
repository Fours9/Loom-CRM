/**
 * Planned subtabs for People «Про себе» — single registry SoT.
 * UI subtabs are NOT shipped yet (`visiblePeopleAboutSubtabs` returns []).
 *
 * Source mapping: voluntary / soft blocks from questionnaire field catalog
 * (full 360 + soft celebration/family; not Profile Core mirrors, not Managing/Docs process).
 *
 * @see docs/product/people-about-tab.md
 * @see docs/product/questionnaire-360-field-catalog.md
 */

export type PeopleAboutSubtabId =
  | 'family_home'
  | 'celebrations'
  | 'hobbies'
  | 'strengths'
  | 'work_style'
  | 'life_goals';

export type PeopleAboutSubtab = {
  id: PeopleAboutSubtabId;
  label: string;
  /** Questionnaire section keys this subtab will absorb when implemented. */
  questionnaireSections: readonly string[];
  /** Brief UA purpose for docs / future empty-state copy. */
  purposeUa: string;
};

/**
 * Deterministic planned order. Do not render until a panel exists for the id.
 * Keep out of «Дані працівника»: no PII mirrors, contacts, employment, skills matrix.
 */
export const PLANNED_ABOUT_SUBTABS: readonly PeopleAboutSubtab[] = [
  {
    id: 'family_home',
    label: 'Сімʼя і дім',
    questionnaireSections: ['family'],
    purposeUa:
      'Сімейний стан, діти, домашні тварини (family.* зі snapshot анкети).',
  },
  {
    id: 'celebrations',
    label: 'Свята і подарунки',
    questionnaireSections: ['celebration_dates'],
    purposeUa:
      'Вітання з ДН, дозвіл на подарунки, формат подарунка, інші дати (celebration.* / hobbies.gift_*).',
  },
  {
    id: 'hobbies',
    label: 'Хобі та інтереси',
    questionnaireSections: ['hobbies'],
    purposeUa:
      'Інтереси, розміри одягу для мерчу, харчові особливості, корпоративи (hobbies.* без gift fields).',
  },
  {
    id: 'strengths',
    label: 'Сильні сторони',
    questionnaireSections: ['strengths'],
    purposeUa:
      'Що виходить найкраще, енергія / блокери, бачення себе (strengths.*).',
  },
  {
    id: 'work_style',
    label: 'Стиль роботи',
    questionnaireSections: ['work_style'],
    purposeUa:
      'Зручна комунікація, фідбек, мотиватори — мʼякий контекст для керівника (work_style.*).',
  },
  {
    id: 'life_goals',
    label: 'Цілі',
    questionnaireSections: ['career_goals', 'strengths'],
    purposeUa:
      'Життєві / карʼєрні орієнтири з анкети (strengths.in_*_year + managing career_goals.plan як джерело; окремий Profile SoT пізніше).',
  },
] as const;

/**
 * Visible About subtabs. Empty until panels ship — page must not invent ad-hoc subtabs.
 */
export function visiblePeopleAboutSubtabs(): readonly PeopleAboutSubtab[] {
  return [];
}

export function resolvePeopleAboutSubtab(
  requested: string,
  visible: readonly PeopleAboutSubtab[],
): PeopleAboutSubtabId | null {
  if (!visible.length) return null;
  return visible.some((t) => t.id === requested)
    ? (requested as PeopleAboutSubtabId)
    : visible[0]!.id;
}
