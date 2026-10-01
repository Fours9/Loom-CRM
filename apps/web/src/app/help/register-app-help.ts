import { registerAppMainHelp } from '../layouts/help/app-main-help.definition';
import { registerHomeHelp } from '../layouts/help/home-help.definition';
import { registerPeopleHelp } from '../features/people/help/register-people-help';
import { registerAbsencesHelp } from '../features/absences/help/register-absences-help';
import { registerPositionsHelp } from '../features/positions/help/register-positions-help';
import { registerSettingsHelp } from '../features/settings/help/register-settings-help';
import { registerQuestionnaireHelp } from '../features/questionnaires/help/register-questionnaire-help';

/**
 * Single composition root for help tours + page descriptors.
 * Pure leaf imports only — must not pull lazy feature components/services/facades.
 */
export function registerAppHelp(): void {
  registerAppMainHelp();
  registerHomeHelp();
  registerPeopleHelp();
  registerAbsencesHelp();
  registerPositionsHelp();
  registerSettingsHelp();
  registerQuestionnaireHelp();
}
