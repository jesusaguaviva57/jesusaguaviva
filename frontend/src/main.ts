import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

/**
 * Punto de entrada de la SPA.
 * Angular 16 con Standalone Components: no hay `AppModule`.
 */
bootstrapApplication(AppComponent, appConfig).catch((error: unknown) => {
  // Si el bootstrap falla, queremos verlo en la consola (no un blank page silencioso).
  console.error('[bootstrap] la aplicación no pudo iniciarse', error);
});
