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

export type ProgressSectionDefinition = {
  id: string;
  label: string;
  stepKeys: string[];
};

/**
 * UX section grouping for the fill progress rail.
 * May reorder relative to linear wizard Next/Back (schema order).
 */
const EMPLOYEE_360_SECTION_DEFS: ProgressSectionDefinition[] = [
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
      'contacts',
      'family',
      'celebration_dates',
      'education',
      'hobbies',
    ],
  },
  {
    id: 'work',
    label: 'Робота',
    stepKeys: [
      'experience',
      'strengths',
      'work_style',
    ],
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

const EMPLOYEE_DOCS_SECTION_DEFS: ProgressSectionDefinition[] = [
  {
    id: 'intro',
    label: 'Вступ',
    stepKeys: [QUESTIONNAIRE_INTRO_STEP],
  },
  {
    id: 'docs',
    label: 'Документи',
    stepKeys: ['profile_mirror', 'onboarding', 'hr_documents'],
  },
  {
    id: 'review',
    label: 'Перегляд',
    stepKeys: [QUESTIONNAIRE_REVIEW_STEP],
  },
];

const EMPLOYEE_MANAGING_SECTION_DEFS: ProgressSectionDefinition[] = [
  {
    id: 'intro',
    label: 'Вступ',
    stepKeys: [QUESTIONNAIRE_INTRO_STEP],
  },
  {
    id: 'profile',
    label: 'Профіль',
    stepKeys: ['profile_mirror', 'company_work', 'grade'],
  },
  {
    id: 'skills_goals',
    label: 'Навички та цілі',
    stepKeys: ['skills', 'career_goals', 'probation_goals'],
  },
  {
    id: 'review',
    label: 'Перегляд',
    stepKeys: [QUESTIONNAIRE_REVIEW_STEP],
  },
];

const EMPLOYEE_STARTER_SECTION_DEFS: ProgressSectionDefinition[] = [
  {
    id: 'intro',
    label: 'Вступ',
    stepKeys: [QUESTIONNAIRE_INTRO_STEP],
  },
  {
    id: 'personal',
    label: 'Особисті',
    stepKeys: ['profile_mirror', 'contacts', 'family', 'education'],
  },
  {
    id: 'work',
    label: 'Робота',
    stepKeys: ['experience', 'company_work'],
  },
  {
    id: 'review',
    label: 'Перегляд',
    stepKeys: [QUESTIONNAIRE_REVIEW_STEP],
  },
];

const TEMPLATE_PROGRESS_SECTION_MAPS = {
  'employee-360': EMPLOYEE_360_SECTION_DEFS,
  'employee-docs': EMPLOYEE_DOCS_SECTION_DEFS,
  'employee-managing': EMPLOYEE_MANAGING_SECTION_DEFS,
  'employee-starter': EMPLOYEE_STARTER_SECTION_DEFS,
} satisfies Record<string, ProgressSectionDefinition[]>;

const INTRO_LABEL = 'Вступ';
const REVIEW_LABEL = 'Перегляд';

export type BuildProgressSectionsInput = {
  templateCode: string;
  schemaSteps: Array<Pick<QuestionnaireSchemaStep, 'key' | 'label'>>;
};

/**
 * Builds major progress sections for the fill rail.
 * Uses an explicit templateCode map when present; otherwise
 * Intro + each schema step + Review.
 */
export function buildProgressSections(
  input: BuildProgressSectionsInput,
): ProgressSection[] {
  const { templateCode, schemaSteps } = input;
  const defs =
    TEMPLATE_PROGRESS_SECTION_MAPS[
      templateCode as keyof typeof TEMPLATE_PROGRESS_SECTION_MAPS
    ];

  if (!defs) {
    return buildFallbackSections(schemaSteps);
  }

  const byKey = new Map(schemaSteps.map((s) => [s.key, s] as const));
  const used = new Set<string>();
  const sections: ProgressSection[] = [];

  for (const def of defs) {
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
    if (steps.length) {
      sections.push({ id: def.id, label: def.label, steps });
    }
  }

  // Leftover schema steps (unknown to the map) in schema order, before review.
  const extras: ProgressSection[] = [];
  for (const step of schemaSteps) {
    if (used.has(step.key)) continue;
    extras.push({
      id: `step:${step.key}`,
      label: step.label,
      steps: [{ key: step.key, label: step.label }],
    });
  }
  if (extras.length) {
    const reviewIdx = sections.findIndex((s) => s.id === 'review');
    if (reviewIdx >= 0) {
      sections.splice(reviewIdx, 0, ...extras);
    } else {
      sections.push(...extras);
    }
  }

  return sections;
}

function buildFallbackSections(
  schemaSteps: Array<Pick<QuestionnaireSchemaStep, 'key' | 'label'>>,
): ProgressSection[] {
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
