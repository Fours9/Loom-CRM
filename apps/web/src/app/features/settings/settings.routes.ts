import { Routes } from '@angular/router';
import { SettingsShellComponent } from './settings-shell.component';
import { PositionManagementPageComponent } from './positions/position-management-page.component';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    component: SettingsShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'positions' },
      {
        path: 'positions',
        component: PositionManagementPageComponent,
        data: { title: 'Керування посадами' },
      },
    ],
  },
];
