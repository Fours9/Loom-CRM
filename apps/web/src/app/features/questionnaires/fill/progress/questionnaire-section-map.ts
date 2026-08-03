import type { QuestionnaireSchemaStep } from '@loom/contracts-questionnaires';
import {
  QUESTIONNAIRE_INTRO_STEP,
  QUESTIONNAIRE_REVIEW_STEP,
} from '../../navigation/questionnaire-step-keys';

export type ProgressSectionStep = {
  key: string;
  label: string;
};

export type ProgressSection = {
  id: string;
  label: string;
  steps: ProgressSectionStep[];
};

/** Employee-360 major sections (schema step order may differ). */
const EMPLOYEE_360_SECTION_DEFS: Array<{
  id: string;
  label: string;
  stepKeys: string[];
}> = [
  {
    id: 'intro',
    label: 'Вступ',
    stepKeys: [QUESTIONNAIRE_INTRO_STEP],
  },
  {
    id: 'personal',
    label: 'Особисті',
    stepKeys: [
      'profile_mirror',
      'family',
      'celebration_dates',
      'education',
    ],
  },
  {
    id: 'work',
    label: 'Робота',
    stepKeys: ['experience', 'strengths', 'hobbies', 'work_style'],
  },
  {
    id: 'consents',
    label: 'Згоди',
    stepKeys: ['consents_review'],
  },
  {
    id: 'review',
    label: 'Перегляд',
    stepKeys: [QUESTIONNAIRE_REVIEW_STEP],
  },
];

const INTRO_LABEL = 'Вступ';
const REVIEW_LABEL = 'Перегляд';

/**
 * Builds major progress sections for the fill rail.
 * Uses employee-360 grouping when those keys are present; otherwise
 * Intro + each schema step + Review.
 */
export function buildProgressSections(
  schemaSteps: QuestionnaireSchemaStep[],
): ProgressSection[] {
  const byKey = new Map(schemaSteps.map((s) => [s.key, s] as const));
  const knownKeys = EMPLOYEE_360_SECTION_DEFS.flatMap((d) =>
    d.stepKeys.filter(
      (k) =>
        k === QUESTIONNAIRE_INTRO_STEP ||
        k === QUESTIONNAIRE_REVIEW_STEP ||
        byKey.has(k),
    ),
  );
  const schemaKeySet = new Set(schemaSteps.map((s) => s.key));
  const matchedSchema = [...schemaKeySet].filter((k) =>
    EMPLOYEE_360_SECTION_DEFS.some((d) => d.stepKeys.includes(k)),
  );
  const use360 =
    matchedSchema.length >= Math.min(4, schemaSteps.length) &&
    matchedSchema.length >= schemaSteps.length * 0.6;

  if (use360) {
    const used = new Set<string>();
    const sections: ProgressSection[] = [];
    for (const def of EMPLOYEE_360_SECTION_DEFS) {
      const steps: ProgressSectionStep[] = [];
      for (const key of def.stepKeys) {
        if (key === QUESTIONNAIRE_INTRO_STEP) {
          steps.push({ key, label: INTRO_LABEL });
          used.add(key);
          continue;
        }
        if (key === QUESTIONNAIRE_REVIEW_STEP) {
          steps.push({ key, label: REVIEW_LABEL });
          used.add(key);
          continue;
        }
        const step = byKey.get(key);
        if (!step) continue;
        steps.push({ key, label: step.label });
        used.add(key);
      }
      if (steps.length) sections.push({ id: def.id, label: def.label, steps });
    }
    // Any leftover schema steps (unknown) go into their own sections before review.
    const reviewIdx = sections.findIndex((s) => s.id === 'review');
    for (const step of schemaSteps) {
      if (used.has(step.key)) continue;
      const extra: ProgressSection = {
        id: `step:${step.key}`,
        label: step.label,
        steps: [{ key: step.key, label: step.label }],
      };
      if (reviewIdx >= 0) sections.splice(reviewIdx, 0, extra);
      else sections.push(extra);
    }
    return sections;
  }

  return [
    {
      id: 'intro',
      label: INTRO_LABEL,
      steps: [{ key: QUESTIONNAIRE_INTRO_STEP, label: INTRO_LABEL }],
    },
    ...schemaSteps.map((s) => ({
      id: `step:${s.key}`,
      label: s.label,
      steps: [{ key: s.key, label: s.label }],
    })),
    {
      id: 'review',
      label: REVIEW_LABEL,
      steps: [{ key: QUESTIONNAIRE_REVIEW_STEP, label: REVIEW_LABEL }],
    },
  ];
}

export function findProgressSection(
  sections: ProgressSection[],
  activeStepKey: string,
): ProgressSection | null {
  return (
    sections.find((s) => s.steps.some((st) => st.key === activeStepKey)) ?? null
  );
}
