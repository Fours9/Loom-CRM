import { Routes } from '@angular/router';
import { SettingsShellComponent } from './settings-shell.component';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    component: SettingsShellComponent,
    children: [
      { path: 'positions', redirectTo: '/positions', pathMatch: 'full' },
    ],
  },
];
