import { Routes } from '@angular/router';
import { QuestionnaireFillStubPageComponent } from './questionnaire-fill-stub-page.component';

export const QUESTIONNAIRE_ROUTES: Routes = [
  {
    path: ':id',
    component: QuestionnaireFillStubPageComponent,
  },
];
