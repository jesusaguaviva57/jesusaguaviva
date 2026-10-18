import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SITE } from '../../core/config/site.config';
import { buildDirectionsUrl, toMapSrc } from '../../core/utils/maps.util';

/**
 * Mapa de ubicación.
 *
 * En `site.config.ts` puedes pegar la URL del mapa **o el `<iframe>` completo**
 * que da Google Maps ("Compartir → Insertar un mapa"): aquí se normaliza. No
 * necesita API Key ni tarjeta de crédito.
 */
@Component({
  selector: 'app-location-map',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card overflow-hidden">
      <div class="relative aspect-[4/3] w-full bg-slate-100 sm:aspect-[16/9] dark:bg-slate-800">
        <iframe
          class="absolute inset-0 h-full w-full border-0"
          [src]="embedSrc"
          [title]="'Mapa de ubicación de ' + site.name"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          allowfullscreen
        ></iframe>
      </div>

      <div class="grid gap-6 p-6 sm:grid-cols-2">
        <div>
          <h3 class="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">
            Dirección
          </h3>
          <address class="mt-3 space-y-1 text-sm not-italic text-slate-600 dark:text-slate-400">
            <p class="font-medium text-slate-800 dark:text-slate-200">{{ site.contact.address }}</p>
            <p>{{ site.contact.city }} · {{ site.contact.country }}</p>
          </address>

          <a
            class="btn-primary mt-4"
            [href]="directionsHref"
            target="_blank"
            rel="noopener noreferrer"
          >
            Cómo llegar
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                d="M11 3a1 1 0 1 0 0 2h2.586l-6.293 6.293a1 1 0 1 0 1.414 1.414L15 6.414V9a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-5Z"
              />
              <path
                d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5Z"
              />
            </svg>
          </a>
        </div>

        <div>
          <h3 class="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">
            Reuniones
          </h3>
          <ul class="mt-3 space-y-2.5">
            <li *ngFor="let item of site.schedule" class="flex items-start gap-3 text-sm">
              <span
                class="mt-0.5 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-800
                  dark:bg-brand-950 dark:text-brand-300"
              >
                {{ item.title }}
              </span>
              <span class="text-slate-600 dark:text-slate-400">{{ item.detail }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  `,
})
export class LocationMapComponent {
  readonly site = SITE;

  /**
   * `src` del iframe, ya normalizado (acepta una URL o el `<iframe>` completo).
   *
   * Angular bloquea las URLs de recursos (`<iframe src>`) por seguridad y exige
   * un `SafeResourceUrl`: sin esto lanza `NG0904` y el mapa no aparece. Es seguro
   * "confiar" en esta URL porque **no viene del usuario**, sino de nuestro propio
   * `site.config.ts`; aun así, si no es `https://` se usa la dirección textual.
   */
  readonly embedSrc: SafeResourceUrl;

  /** Enlace "Cómo llegar" derivado de la configuración. */
  readonly directionsHref: string;

  constructor(sanitizer: DomSanitizer) {
    const configured = toMapSrc(SITE.maps.embedUrl);
    const fallback = `https://www.google.com/maps?q=${encodeURIComponent(SITE.maps.query)}&output=embed`;
    const src = /^https:\/\//i.test(configured) ? configured : fallback;

    this.embedSrc = sanitizer.bypassSecurityTrustResourceUrl(src);
    this.directionsHref = buildDirectionsUrl(SITE.maps.directionsUrl, SITE.maps.query);
  }
}
