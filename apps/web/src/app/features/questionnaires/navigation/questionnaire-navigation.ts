/**
 * Single FE navigation contract for questionnaire routes.
 */

export const QUESTIONNAIRE_ASSIGNMENT_NAVIGATION = {
  pathPrefix: '/questionnaires',
  query: {
    step: 'step',
  },
} as const;

export type QuestionnaireAssignmentLinkInput = {
  assignmentId: string;
  stepKey?: string;
};

export type QuestionnaireAssignmentLink = {
  routerLink: string;
  queryParams: Record<string, string>;
};

export function buildQuestionnaireAssignmentLink(
  input: QuestionnaireAssignmentLinkInput,
): QuestionnaireAssignmentLink {
  const assignmentId = input.assignmentId?.trim();
  if (!assignmentId) {
    throw new Error('assignmentId is required');
  }

  const queryParams: Record<string, string> = {};
  const stepKey = input.stepKey?.trim();
  if (stepKey) {
    queryParams[QUESTIONNAIRE_ASSIGNMENT_NAVIGATION.query.step] = stepKey;
  }

  return {
    routerLink: `${QUESTIONNAIRE_ASSIGNMENT_NAVIGATION.pathPrefix}/${assignmentId}`,
    queryParams,
  };
}

export function buildQuestionnaireDirectoryLink(): { routerLink: string } {
  return { routerLink: QUESTIONNAIRE_ASSIGNMENT_NAVIGATION.pathPrefix };
}

export function parseQuestionnaireStepQuery(
  params: Pick<{ get(name: string): string | null }, 'get'>,
): string | null {
  const step = params
    .get(QUESTIONNAIRE_ASSIGNMENT_NAVIGATION.query.step)
    ?.trim();
  return step || null;
}
