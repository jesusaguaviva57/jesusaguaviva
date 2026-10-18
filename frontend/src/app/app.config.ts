import { provideHttpClient, withInterceptors } from '@angular/common/http';
import type { ApplicationConfig } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { APP_ROUTES } from './app.routes';
import { apiErrorInterceptor } from './core/interceptors/api-error.interceptor';

/**
 * Configuración global de la aplicación (standalone).
 * Sustituye al antiguo `AppModule.providers`.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      APP_ROUTES,
      withInMemoryScrolling({
        // Las anclas del menú (#biblia, #ubicacion) hacen scroll suave.
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      }),
    ),
    provideHttpClient(withInterceptors([apiErrorInterceptor])),
  ],
};
