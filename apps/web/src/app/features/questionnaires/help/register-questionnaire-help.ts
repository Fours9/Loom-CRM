import type { HelpRouteDescriptor } from '../../../core/help/help-page.models';
import { helpPageContextRegistry } from '../../../core/help/help-page-context.registry';
import { helpTourRegistry } from '../../../core/help/help-tour.registry';
import { QUESTIONNAIRE_HELP_BUNDLE } from './questionnaire-help.definition';

export const QUESTIONNAIRE_ROUTE_HELP_DESCRIPTORS: readonly HelpRouteDescriptor[] =
  [
    {
      id: 'route.questionnaires.directory',
      pattern: ['questionnaires'],
      exact: true,
      context: {
        label: 'Анкети',
        tourId: 'questionnaires.directory',
        soon: false,
      },
    },
    {
      id: 'route.questionnaires.fill',
      pattern: ['questionnaires', ':id'],
      exact: true,
      context: {
        label: 'Анкета',
        tourId: 'questionnaires.fill',
        soon: false,
      },
    },
  ];

/** Register questionnaire tours + page descriptors (idempotent Map.set). */
export function registerQuestionnaireHelp(): void {
  helpTourRegistry.register(QUESTIONNAIRE_HELP_BUNDLE);
  helpPageContextRegistry.register(QUESTIONNAIRE_ROUTE_HELP_DESCRIPTORS);
}
