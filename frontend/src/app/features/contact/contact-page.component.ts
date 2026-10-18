import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SITE } from '../../core/config/site.config';
import { buildDirectionsUrl } from '../../core/utils/maps.util';
import { LocationMapComponent } from '../location/location-map.component';
import { ContactFormComponent } from './contact-form.component';

/**
 * Página de contacto: formulario + canales directos + redes + mapa.
 */
@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [CommonModule, ContactFormComponent, LocationMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="border-b border-slate-200 bg-white py-14 dark:border-slate-800 dark:bg-slate-900">
      <div class="container-page">
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100">
          Contacto
        </h1>
        <p class="section-subtitle">
          Escríbenos y te responderemos lo antes posible. También puedes visitarnos cualquier domingo.
        </p>
      </div>
    </section>

    <section class="container-page py-12 sm:py-16">
      <div class="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div>
          <h2 class="section-title">Envíanos un mensaje</h2>
          <p class="section-subtitle">
            Cuéntanos en qué podemos ayudarte, comparte tu petición de oración o pregunta por nuestras
            reuniones.
          </p>
          <div class="mt-6">
            <app-contact-form />
          </div>
        </div>

        <aside class="space-y-4">
          <div class="card p-6">
            <h2 class="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">
              Escríbenos
            </h2>
            <ul class="mt-4 space-y-3 text-sm">
              <li>
                <a
                  class="flex items-start gap-3 rounded-lg p-2 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  [href]="'mailto:' + site.contact.email"
                >
                  <span class="text-brand-700 dark:text-brand-400">✉️</span>
                  <span>
                    <span class="block font-medium text-slate-800 dark:text-slate-200">Correo</span>
                    <span class="text-slate-600 dark:text-slate-400">{{ site.contact.email }}</span>
                  </span>
                </a>
              </li>
            </ul>
          </div>

          <div class="card p-6">
            <h2 class="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">
              Reuniones
            </h2>
            <ul class="mt-4 space-y-3 text-sm">
              <li *ngFor="let item of site.schedule" class="flex items-start justify-between gap-4">
                <span class="font-medium text-slate-800 dark:text-slate-200">{{ item.title }}</span>
                <span class="text-right text-slate-600 dark:text-slate-400">{{ item.detail }}</span>
              </li>
            </ul>
          </div>

          <div class="card p-6">
            <h2 class="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">
              Dirección
            </h2>
            <address class="mt-3 space-y-1 text-sm not-italic text-slate-600 dark:text-slate-400">
              <p class="font-medium text-slate-800 dark:text-slate-200">{{ site.contact.address }}</p>
              <p>{{ site.contact.city }} · {{ site.contact.country }}</p>
            </address>
            <a class="btn-secondary mt-4 w-full" [href]="directionsUrl" target="_blank" rel="noopener noreferrer">
              Cómo llegar
            </a>
          </div>

          <!-- Redes sociales -->
          <div class="card p-6">
            <h2 class="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">
              Redes sociales
            </h2>
            <ul class="mt-4 space-y-2 text-sm">
              <li *ngFor="let social of site.social">
                <a
                  class="flex items-center justify-between gap-3 rounded-lg p-2 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  [href]="social.href"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span class="font-medium text-slate-800 dark:text-slate-200">{{ social.label }}</span>
                  <span class="text-slate-600 dark:text-slate-400">{{ social.handle ?? 'Visitar' }}</span>
                </a>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <div class="mt-14">
        <h2 class="section-title">Cómo llegar</h2>
        <p class="section-subtitle">Este es el mapa con nuestra ubicación exacta.</p>
        <div class="mt-6">
          <app-location-map />
        </div>
      </div>
    </section>
  `,
})
export class ContactPageComponent {
  readonly site = SITE;

  /** Enlace "Cómo llegar" (funciona aunque en la config hayas pegado el `<iframe>` de Google). */
  readonly directionsUrl = buildDirectionsUrl(SITE.maps.directionsUrl, SITE.maps.query);
}
