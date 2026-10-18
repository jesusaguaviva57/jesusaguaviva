import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SITE } from './core/config/site.config';
import { ThemeService } from './core/services/theme.service';
import { LogoComponent } from './shared/components/logo.component';

interface NavItem {
  label: string;
  /** Ruta del router (el menú solo usa rutas simples). */
  link: string;
  fragment?: string;
  exact: boolean;
}

/**
 * Layout raíz: header sticky + router-outlet + footer.
 * El menú móvil se controla con `signal` (Angular 16 signals) y el tema
 * claro/oscuro con `ThemeService`.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      href="#contenido"
      class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
    >
      Saltar al contenido
    </a>

    <!-- ======================= HEADER ======================= -->
    <header
      class="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur
        dark:border-slate-800 dark:bg-slate-950/90"
    >
      <div class="container-page flex h-16 items-center justify-between gap-4">
        <a routerLink="/" [fragment]="'inicio'" class="rounded-lg" aria-label="Ir al inicio">
          <app-logo [name]="site.name" [tagline]="site.tagline" size="sm" />
        </a>

        <div class="flex items-center gap-1.5">
          <!-- Navegación de escritorio -->
          <nav class="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
            <ng-container *ngFor="let item of navItems">
              <a
                [routerLink]="item.link"
                [fragment]="item.fragment"
                routerLinkActive="text-brand-800 dark:text-brand-300"
                [routerLinkActiveOptions]="{ exact: item.exact }"
                class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition
                  hover:bg-slate-100 hover:text-slate-900
                  dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                {{ item.label }}
              </a>
            </ng-container>

            <a routerLink="/contacto" class="btn-primary ml-2">Escríbenos</a>
          </nav>

          <!-- Interruptor de tema: luna (pasar a oscuro) / sol (volver a claro) -->
          <button
            type="button"
            class="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100
              dark:text-slate-300 dark:hover:bg-slate-800"
            [attr.aria-label]="isDark ? 'Activar modo claro' : 'Activar modo oscuro'"
            [attr.aria-pressed]="isDark"
            [attr.title]="
              isDark
                ? 'Modo claro'
                : 'Modo oscuro' + (theme.isManual() ? '' : ' (ahora según tu sistema)')
            "
            (click)="theme.toggle()"
          >
            <!-- Luna -->
            <svg
              *ngIf="!isDark"
              class="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
            </svg>

            <!-- Sol -->
            <svg
              *ngIf="isDark"
              class="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4" />
              <path
                d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
              />
            </svg>
          </button>

          <!-- Botón del menú móvil -->
          <button
            type="button"
            class="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100
              dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
            [attr.aria-expanded]="menuOpen()"
            aria-controls="menu-movil"
            aria-label="Abrir menú"
            (click)="toggleMenu()"
          >
            <svg
              class="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path *ngIf="!menuOpen()" stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16" />
              <path *ngIf="menuOpen()" stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Navegación móvil -->
      <nav
        id="menu-movil"
        *ngIf="menuOpen()"
        class="border-t border-slate-200 bg-white px-4 pb-4 pt-2 dark:border-slate-800 dark:bg-slate-950 md:hidden"
        aria-label="Navegación móvil"
      >
        <a
          *ngFor="let item of navItems"
          [routerLink]="item.link"
          [fragment]="item.fragment"
          class="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition
            hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          (click)="closeMenu()"
        >
          {{ item.label }}
        </a>
      </nav>
    </header>

    <!-- ======================= CONTENIDO ======================= -->
    <main id="contenido">
      <router-outlet />
    </main>

    <!-- ======================= FOOTER ======================= -->
    <footer class="mt-20 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div class="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div class="lg:col-span-2">
          <app-logo [name]="site.name" [tagline]="site.tagline" />
          <p class="mt-4 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {{ site.description }}
          </p>
        </div>

        <div>
          <h2 class="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">
            Visítanos
          </h2>
          <address class="mt-4 space-y-1 text-sm not-italic text-slate-600 dark:text-slate-400">
            <p>{{ site.contact.address }}</p>
            <p>{{ site.contact.city }} · {{ site.contact.country }}</p>
            <p>
              <a
                class="text-brand-800 hover:underline dark:text-brand-300"
                [href]="'mailto:' + site.contact.email"
              >
                {{ site.contact.email }}
              </a>
            </p>
          </address>
        </div>

        <div>
          <h2 class="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">
            Síguenos
          </h2>
          <ul class="mt-4 flex flex-wrap gap-2">
            <li *ngFor="let social of site.social">
              <a class="chip" [href]="social.href" target="_blank" rel="noopener noreferrer">
                {{ social.label }}
              </a>
            </li>
          </ul>
          <a routerLink="/contacto" class="btn-secondary mt-4 w-full sm:w-auto">Enviar un mensaje</a>
        </div>
      </div>

      <div class="border-t border-slate-200 dark:border-slate-800">
        <div
          class="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-slate-500 sm:flex-row dark:text-slate-400"
        >
          <p>© {{ currentYear }} {{ site.name }}. Todos los derechos reservados.</p>
          <p>Hecho con fe · Texto bíblico vía Midvash API</p>
        </div>
      </div>
    </footer>
  `,
})
export class AppComponent {
  readonly site = SITE;
  readonly currentYear = new Date().getFullYear();

  readonly theme = inject(ThemeService);

  readonly menuOpen = signal(false);

  /** `true` cuando el tema oscuro está activo. */
  get isDark(): boolean {
    return this.theme.mode() === 'dark';
  }

  /** El menú usa anclas a la home para las secciones de la landing. */
  readonly navItems: NavItem[] = [
    { label: 'Inicio', link: '/', fragment: 'inicio', exact: true },
    { label: 'Biblia', link: '/', fragment: 'biblia', exact: false },
    { label: 'Ubicación', link: '/', fragment: 'ubicacion', exact: false },
    { label: 'Contacto', link: '/contacto', exact: true },
  ];

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }
}
