/**
 * Thin FE adapter over `@loom/employee-about-catalog`.
 * Do not maintain a second label/id registry here.
 *
 * @see docs/product/people-about-tab.md
 */

import {
  ABOUT_SUBTAB_DEFS,
  type AboutSubtabDef,
  type AboutSubtabId,
} from '@loom/employee-about-catalog';

export type PeopleAboutSubtabId = AboutSubtabId;

export type PeopleAboutSubtab = {
  id: PeopleAboutSubtabId;
  label: string;
  purposeUa: string;
};

function toPeopleSubtab(def: AboutSubtabDef): PeopleAboutSubtab {
  return {
    id: def.id,
    label: def.labelUa,
    purposeUa: def.purposeUa,
  };
}

/** @deprecated Prefer visiblePeopleAboutSubtabs — alias of catalog order. */
export const PLANNED_ABOUT_SUBTABS: readonly PeopleAboutSubtab[] =
  ABOUT_SUBTAB_DEFS.map(toPeopleSubtab);

/** Visible About subtabs — all six from catalog. */
export function visiblePeopleAboutSubtabs(): readonly PeopleAboutSubtab[] {
  return PLANNED_ABOUT_SUBTABS;
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
