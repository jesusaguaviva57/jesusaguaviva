import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { SITE } from '../../core/config/site.config';
import { BibleReaderComponent } from '../bible/bible-reader.component';
import { LocationMapComponent } from '../location/location-map.component';

/**
 * Landing principal: hero + lector de Biblia + ubicación + CTA de contacto.
 * Las secciones llevan `id` para que el menú del header navegue por anclas.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, BibleReaderComponent, LocationMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- ======================= HERO ======================= -->
    <section id="inicio" class="relative overflow-hidden border-b border-slate-200 bg-white">
      <div
        class="pointer-events-none absolute inset-x-0 -top-32 h-72 bg-gradient-to-b from-brand-50 to-transparent"
        aria-hidden="true"
      ></div>

      <div class="container-page relative grid gap-12 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
        <div>
          <p class="badge bg-brand-50 text-brand-800">{{ site.name }}</p>

          <h1 class="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            {{ site.tagline }}
          </h1>

          <p class="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">{{ site.description }}</p>

          <div class="mt-8 flex flex-wrap items-center gap-3">
            <a routerLink="/contacto" class="btn-primary px-5 py-3 text-base">
              Contacto
              <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fill-rule="evenodd"
                  d="M3 10a.75.75 0 0 1 .75-.75h8.69L9.22 6.03a.75.75 0 1 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06l3.22-3.22H3.75A.75.75 0 0 1 3 10Z"
                  clip-rule="evenodd"
                />
              </svg>
            </a>
            <a
              [routerLink]="['/']"
              fragment="biblia"
              class="btn-secondary px-5 py-3 text-base"
            >
              Leer la Biblia
            </a>
          </div>

          <p class="mt-8 flex items-start gap-2.5 text-sm text-slate-600">
            <svg class="mt-0.5 h-5 w-5 shrink-0 text-brand-700" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M9.69 18.93a.75.75 0 0 0 1.12 0c.59-.63 4.94-5.42 4.94-9.18a6.25 6.25 0 1 0-12.5 0c0 3.76 4.35 8.55 4.94 9.18ZM10 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                clip-rule="evenodd"
              />
            </svg>
            <span>
              <span class="font-medium text-slate-800">{{ site.contact.address }}</span><br />
              {{ site.contact.city }} · {{ site.contact.country }}
            </span>
          </p>
        </div>

        <!-- Tarjeta de horarios -->
        <div class="card p-6 sm:p-8">
          <h2 class="text-lg font-bold text-slate-900">Horarios de reunión</h2>
          <p class="mt-1 text-sm text-slate-600">Te esperamos. ¡Ven como estás!</p>

          <ul class="mt-6 divide-y divide-slate-100">
            <li *ngFor="let item of site.schedule" class="flex items-center justify-between gap-4 py-3.5">
              <span class="text-sm font-semibold text-slate-800">{{ item.title }}</span>
              <span class="text-sm text-slate-600">{{ item.detail }}</span>
            </li>
          </ul>

          <a [routerLink]="['/']" fragment="ubicacion" class="btn-secondary mt-6 w-full">
            Ver ubicación en el mapa
          </a>
        </div>
      </div>
    </section>

    <!-- ======================= LECTOR DE BIBLIA ======================= -->
    <section id="biblia" class="container-page py-16 sm:py-20">
      <header>
        <h2 class="section-title">Lee la Biblia</h2>
        <p class="section-subtitle">
          Busca cualquier versículo por su referencia y léelo al instante. Texto bíblico:
          <span class="font-medium text-slate-700">{{ versionLabel }}</span>.
        </p>
      </header>

      <div class="mt-8">
        <app-bible-reader />
      </div>
    </section>

    <!-- ======================= UBICACIÓN ======================= -->
    <section id="ubicacion" class="border-y border-slate-200 bg-white py-16 sm:py-20">
      <div class="container-page">
        <header>
          <h2 class="section-title">Nuestra ubicación</h2>
          <p class="section-subtitle">
            Nos encantaría conocerte en persona. Aquí puedes ver dónde estamos y la mejor ruta para llegar.
          </p>
        </header>

        <div class="mt-8">
          <app-location-map />
        </div>
      </div>
    </section>

    <!-- ======================= CTA FINAL ======================= -->
    <section class="container-page py-16 sm:py-20">
      <div class="card flex flex-col items-center gap-5 p-8 text-center sm:p-12">
        <h2 class="section-title">¿Tienes una petición o una pregunta?</h2>
        <p class="max-w-xl text-slate-600">
          Escríbenos y alguien del equipo te responderá lo antes posible. También puedes visitarnos
          cualquier domingo.
        </p>
        <div class="flex flex-wrap justify-center gap-3">
          <a routerLink="/contacto" class="btn-primary px-5 py-3 text-base">Enviar un mensaje</a>
        </div>
      </div>
    </section>
  `,
})
export class HomeComponent {
  readonly site = SITE;
  readonly versionLabel = environment.bibleVersionLabel;
}
