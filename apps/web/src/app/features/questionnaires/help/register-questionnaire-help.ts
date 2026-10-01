import { helpTourRegistry } from '../../../core/help';
import { QUESTIONNAIRE_HELP_BUNDLE } from './questionnaire-help.definition';

let registered = false;

/** Idempotent registration of questionnaire help tours (call once from routes). */
export function registerQuestionnaireHelp(): void {
  if (registered) return;
  helpTourRegistry.register(QUESTIONNAIRE_HELP_BUNDLE);
  registered = true;
}
