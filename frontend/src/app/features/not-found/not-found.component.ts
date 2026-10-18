import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Página 404 (también la usa Vercel como fallback del SPA). */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p class="text-sm font-bold uppercase tracking-widest text-brand-700 dark:text-brand-300">
        Error 404
      </p>
      <h1 class="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100">
        No encontramos esta página
      </h1>
      <p class="mt-4 max-w-lg text-slate-600 dark:text-slate-400">
        Puede que el enlace haya cambiado o que ya no exista. Vuelve al inicio para seguir leyendo la
        Biblia o escribirnos.
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <a routerLink="/" class="btn-primary px-5 py-3 text-base">Volver al inicio</a>
        <a routerLink="/contacto" class="btn-secondary px-5 py-3 text-base">Contacto</a>
      </div>
    </section>
  `,
})
export class NotFoundComponent {}
