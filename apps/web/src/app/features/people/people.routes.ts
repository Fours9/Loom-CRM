import { Routes } from '@angular/router';
import { employeeCreateGuard } from '../../core/auth/employee-create.guard';
import { PeoplePageComponent } from './people-page.component';
import { PeopleProfilePageComponent } from './people-profile-page.component';
import { PeopleEmployeeCreatePageComponent } from './people-employee-create-page.component';

export const PEOPLE_ROUTES: Routes = [
  { path: '', component: PeoplePageComponent },
  {
    path: 'new',
    component: PeopleEmployeeCreatePageComponent,
    canActivate: [employeeCreateGuard],
  },
  { path: ':id', component: PeopleProfilePageComponent },
];
