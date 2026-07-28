import { Routes } from '@angular/router';
import { PlaceholderPageComponent } from '../../shared/placeholder-page.component';

export const STATISTICS_ROUTES: Routes = [
  {
    path: '',
    component: PlaceholderPageComponent,
    data: {
      title: 'Статистика',
      note: 'Звіти та аналітика — незабаром.',
    },
  },
];
