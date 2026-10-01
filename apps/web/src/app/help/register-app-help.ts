import { registerAppMainHelp } from '../layouts/help/app-main-help.definition';
import { registerQuestionnaireHelp } from '../features/questionnaires/help/register-questionnaire-help';

/**
 * Single composition root for help tours + page descriptors.
 * Call from AppComponent — independent of lazy route load order.
 */
export function registerAppHelp(): void {
  registerAppMainHelp();
  registerQuestionnaireHelp();
}
