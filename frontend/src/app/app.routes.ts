import type { Routes } from '@angular/router';

/**
 * Rutas con `loadComponent` (lazy loading por ruta).
 * Cada página se descarga solo cuando el usuario la visita, de modo que el
 * bundle inicial que sirve Vercel es mínimo.
 */
export const APP_ROUTES: Routes = [
  {
    path: '',
    title: 'Inicio · Iglesia Jesús Agua Viva',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'contacto',
    title: 'Contacto · Iglesia Jesús Agua Viva',
    loadComponent: () =>
      import('./features/contact/contact-page.component').then((m) => m.ContactPageComponent),
  },
  {
    path: '**',
    title: 'Página no encontrada · Iglesia Jesús Agua Viva',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
