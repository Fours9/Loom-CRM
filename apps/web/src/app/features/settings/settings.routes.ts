import { Routes } from '@angular/router';
import { PlaceholderPageComponent } from '../../shared/placeholder-page.component';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    component: PlaceholderPageComponent,
    data: { title: 'Налаштування', note: 'Platform settings — Deliverable 2+' },
  },
];
