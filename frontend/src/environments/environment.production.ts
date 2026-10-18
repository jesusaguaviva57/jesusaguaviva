/**
 * Entorno de PRODUCCIÓN. Lo aplica `ng build` (configuración por defecto).
 *
 * ⚠️ Cambia `apiBaseUrl` por la URL real de tu Worker tras el
 *    primer `wrangler deploy` (ej. https://jesusaguaviva-api.TU-SUBDOMINIO.workers.dev)
 *    o por tu dominio propio (https://api.jesusaguaviva.org).
 */
export const environment = {
  production: true,
  apiBaseUrl: 'https://jesusaguaviva-api.workers.dev',
  bibleVersionLabel: 'Reina-Valera 1909',
} as const;

export type Environment = typeof environment;
