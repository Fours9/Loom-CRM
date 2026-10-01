import { Routes } from '@angular/router';
import { QuestionnaireDirectoryPageComponent } from './directory/questionnaire-directory-page.component';
import { QuestionnaireFillPageComponent } from './fill/questionnaire-fill-page.component';
import { registerQuestionnaireHelp } from './help/register-questionnaire-help';

registerQuestionnaireHelp();

export const QUESTIONNAIRE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: QuestionnaireDirectoryPageComponent,
  },
  {
    path: ':id',
    component: QuestionnaireFillPageComponent,
    data: { hideAppChrome: true },
  },
];
