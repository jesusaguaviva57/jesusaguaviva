/**
 * Entorno de PRODUCCIÓN. Lo aplica `ng build` (configuración por defecto).
 *
 * URL real del Worker ya desplegado. Si algún día cambias de subdominio o
 * pones dominio propio (https://api.jesusaguaviva.org), cambia solo esta línea.
 */
export const environment = {
  production: true,
  apiBaseUrl: 'https://jesusaguaviva-api.jesusaguaviva57.workers.dev',
  bibleVersionLabel: 'Reina-Valera 1909',
} as const;

export type Environment = typeof environment;
