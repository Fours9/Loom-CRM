/**
 * Section / step trail helpers for the fill progress rail.
 * Dot fill and spine follow **position relative to the active step**,
 * not visit history (jumping ahead must still light all prior marks).
 */
import type { ProgressSection } from './questionnaire-section-map';

/** Spine fill = position along sections. */
export function sectionSpineProgress(
  sections: ProgressSection[],
  activeSectionId: string | undefined,
): string {
  if (!sections.length || !activeSectionId) return '0%';
  const idx = sections.findIndex((s) => s.id === activeSectionId);
  if (idx <= 0) return '0%';
  return `${(idx / (sections.length - 1)) * 100}%`;
}

export function substepSpineProgress(
  steps: { key: string }[],
  activeStepKey: string,
): string {
  if (steps.length <= 1) return '0%';
  const idx = steps.findIndex((s) => s.key === activeStepKey);
  if (idx <= 0) return '0%';
  return `${(idx / (steps.length - 1)) * 100}%`;
}

/** Marks before the active section (trail fill). */
export function isSectionPassed(
  sections: ProgressSection[],
  activeSectionId: string | undefined,
  sectionId: string,
): boolean {
  if (!activeSectionId) return false;
  const ids = sections.map((s) => s.id);
  const activeIdx = ids.indexOf(activeSectionId);
  const thisIdx = ids.indexOf(sectionId);
  return thisIdx >= 0 && activeIdx >= 0 && thisIdx < activeIdx;
}

/**
 * @deprecated Visit history is no longer used for rail fill.
 * Kept for callers / specs that still track opens.
 */
export function isSectionVisited(
  section: ProgressSection | undefined,
  visitedStepKeys: ReadonlySet<string>,
): boolean {
  if (!section?.steps.length) return false;
  return section.steps.some((s) => visitedStepKeys.has(s.key));
}

/** @deprecated Use isSectionVisited */
export const isSectionCompleted = isSectionVisited;

/** Marks before the active step within the active section. */
export function isStepPassed(
  steps: { key: string }[],
  activeStepKey: string,
  stepKey: string,
): boolean {
  if (stepKey === activeStepKey) return false;
  const idx = steps.findIndex((s) => s.key === stepKey);
  const activeIdx = steps.findIndex((s) => s.key === activeStepKey);
  return idx >= 0 && activeIdx >= 0 && idx < activeIdx;
}

/** @deprecated Visit history is no longer used for rail fill. */
export function isStepVisited(
  stepKey: string,
  visitedStepKeys: ReadonlySet<string>,
): boolean {
  return visitedStepKeys.has(stepKey);
}

/** @deprecated Use isStepVisited */
export const isStepCompleted = isStepVisited;
