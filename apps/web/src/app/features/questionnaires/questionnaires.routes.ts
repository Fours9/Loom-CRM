import { Routes } from '@angular/router';
import { QuestionnaireFillPageComponent } from './fill/questionnaire-fill-page.component';

export const QUESTIONNAIRE_ROUTES: Routes = [
  {
    path: ':id',
    component: QuestionnaireFillPageComponent,
  },
];
