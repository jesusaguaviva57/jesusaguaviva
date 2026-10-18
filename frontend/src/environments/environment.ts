/**
 * Entorno de DESARROLLO (valor por defecto).
 * `ng serve` y `ng build --configuration development` usan este archivo.
 * En producción se sustituye por `environment.production.ts`
 * (ver `fileReplacements` en angular.json).
 */
export const environment = {
  production: false,
  /** Worker de Cloudflare en local (`npm run dev` dentro de /backend). */
  apiBaseUrl: 'http://localhost:8787',
  /** Versión que muestra la UI como "principal" (debe coincidir con el Worker). */
  bibleVersionLabel: 'Reina-Valera 1909',
} as const;

export type Environment = typeof environment;
