/**
 * Utilidades de Google Maps.
 *
 * Google Maps, al pulsar "Compartir → Insertar un mapa", entrega un `<iframe>`
 * completo en lugar de una URL. Estas funciones aceptan **ambas cosas** (la URL
 * suelta o el HTML del iframe) para que puedas pegar en `site.config.ts` lo que
 * te dé Google sin tener que editarlo a mano.
 */

/** Devuelve el `src` si recibe un `<iframe>`, o el propio valor si ya es una URL. */
export function toMapSrc(value: string): string {
  const match = /src\s*=\s*"([^"]+)"/i.exec(value);
  return (match?.[1] ?? value).trim();
}

/** Extrae el nombre del lugar de una URL de embed (`...!2sNombre...`). */
export function toPlaceName(embedSrc: string): string | null {
  const match = /!2s([^!]+)/.exec(embedSrc);
  const raw = match?.[1];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return null;
  }
}

/**
 * Construye un enlace de navegación ("Cómo llegar") válido.
 *
 * - Si ya te dieron un enlace de navegación (`/maps/dir/...`), se respeta.
 * - Si te dieron el `<iframe>`/URL de embed, se saca el nombre del lugar y se
 *   genera el enlace de indicaciones.
 * - Si no se puede leer el lugar, se usa la dirección textual (`fallbackQuery`).
 */
export function buildDirectionsUrl(configured: string, fallbackQuery: string): string {
  const src = toMapSrc(configured);

  if (/^https?:\/\//i.test(src) && !/\/maps\/embed/i.test(src)) {
    return src;
  }

  const place = toPlaceName(src) ?? fallbackQuery;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}`;
}
