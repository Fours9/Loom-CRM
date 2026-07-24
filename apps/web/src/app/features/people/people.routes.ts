import { Routes } from '@angular/router';
import { PeoplePageComponent } from './people-page.component';
import { PeopleProfilePageComponent } from './people-profile-page.component';

export const PEOPLE_ROUTES: Routes = [
  { path: '', component: PeoplePageComponent },
  { path: ':id', component: PeopleProfilePageComponent },
];
