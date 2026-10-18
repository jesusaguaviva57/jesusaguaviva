/** Utilidades de texto puras (sin dependencias del runtime). */

/** Escapa HTML. OBLIGATORIO antes de inyectar input de usuario en un correo. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Colapsa espacios/saltos y recorta los extremos. */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Recorta a `max` caracteres añadiendo "…". */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Normaliza una referencia para usarla como clave de caché:
 * minúsculas, sin acentos y sin espacios redundantes.
 * " Juan  3:16 " -> "juan 3:16"
 */
export function normalizeReference(value: string): string {
  return collapseWhitespace(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Convierte un texto plano en HTML seguro (mantiene saltos de línea). */
export function textToSafeHtml(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}
