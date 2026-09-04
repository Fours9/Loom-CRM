import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authTokenInterceptor } from './core/auth/auth-token.interceptor';
import { apiAvailabilityInterceptor } from './core/api/api-availability.interceptor';
import { SessionStore } from './core/auth/session.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([apiAvailabilityInterceptor, authTokenInterceptor]),
    ),
    provideAppInitializer(() => inject(SessionStore).initialize()),
  ],
};
