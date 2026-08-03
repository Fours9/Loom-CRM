import {
  QUESTIONNAIRE_INTRO_STEP,
  QUESTIONNAIRE_REVIEW_STEP,
} from '../../navigation/questionnaire-step-keys';
import type { ProgressSection } from './questionnaire-section-map';

/** Spine fill = position along sections (not completion). */
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

/** Position relative to active section only (trail). */
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
 * Completion from schema step keys only.
 * Intro / Review alone never count as completed.
 */
export function isSectionCompleted(
  section: ProgressSection | undefined,
  completedStepKeys: ReadonlySet<string>,
): boolean {
  if (!section) return false;
  const schemaSteps = section.steps.filter(
    (s) =>
      s.key !== QUESTIONNAIRE_INTRO_STEP &&
      s.key !== QUESTIONNAIRE_REVIEW_STEP,
  );
  if (!schemaSteps.length) return false;
  return schemaSteps.every((s) => completedStepKeys.has(s.key));
}

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

export function isStepCompleted(
  stepKey: string,
  completedStepKeys: ReadonlySet<string>,
): boolean {
  if (
    stepKey === QUESTIONNAIRE_INTRO_STEP ||
    stepKey === QUESTIONNAIRE_REVIEW_STEP
  ) {
    return false;
  }
  return completedStepKeys.has(stepKey);
}
