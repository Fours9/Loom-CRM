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

/** Post-submit / close return: People profile with Анкети tab. */
export function buildPeopleQuestionnairesReturnUrl(
  employeeId: string | null | undefined,
): string {
  const id = employeeId?.trim();
  if (!id) return '/people';
  return `/people/${id}?tab=questionnaires`;
}

/**
 * Leave the fill route after submit. Prefer router, then hard assign so a
 * cancelled SPA navigation cannot leave the user on the fill page.
 */
export async function leaveQuestionnaireFillAfterSubmit(
  router: { navigateByUrl(url: string): Promise<boolean> },
  employeeId: string | null | undefined,
): Promise<void> {
  const url = buildPeopleQuestionnairesReturnUrl(employeeId);
  try {
    const ok = await router.navigateByUrl(url);
    if (ok) return;
  } catch {
    // fall through to hard navigation
  }
  if (typeof window !== 'undefined') {
    window.location.assign(url);
  }
}

export function parseQuestionnaireStepQuery(
  params: Pick<{ get(name: string): string | null }, 'get'>,
): string | null {
  const step = params
    .get(QUESTIONNAIRE_ASSIGNMENT_NAVIGATION.query.step)
    ?.trim();
  return step || null;
}
