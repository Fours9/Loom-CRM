import { Routes } from '@angular/router';
import { PositionManagementPageComponent } from './position-management-page.component';
import { PositionCatalogPageComponent } from './position-catalog-page.component';

export const POSITIONS_ROUTES: Routes = [
  {
    path: '',
    component: PositionManagementPageComponent,
    data: { title: 'Керування посадами' },
  },
  {
    path: ':id/catalog',
    component: PositionCatalogPageComponent,
    data: { title: 'Каталог посади' },
  },
];
