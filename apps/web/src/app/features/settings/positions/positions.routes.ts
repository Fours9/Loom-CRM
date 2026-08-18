import { Routes } from '@angular/router';
import { PositionManagementPageComponent } from './position-management-page.component';

export const POSITIONS_ROUTES: Routes = [
  {
    path: '',
    component: PositionManagementPageComponent,
    data: { title: 'Керування посадами' },
  },
];
