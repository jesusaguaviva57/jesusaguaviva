/**
 * Tipos compartidos del Worker (API Gateway de la iglesia Jesús Agua Viva).
 *
 * Regla del proyecto: `strict: true` + `noUncheckedIndexedAccess: true`.
 * Todo lo que entra desde el exterior (HTTP, KV, terceros) se tipa aquí y se
 * valida en `lib/validation.ts` antes de usarse.
 */

/** Variables de entorno y bindings disponibles dentro del Worker. */
export interface Env {
  /** "production" | "development". Controla mensajes y modo simulado. */
  ENVIRONMENT?: string;

  /** Slug de la versión de la Biblia en Midvash (ej. "rvr1909", "rvg"). */
  BIBLE_VERSION?: string;

  /** Orígenes permitidos para CORS, separados por coma. Admite comodines (`*`). */
  ALLOWED_ORIGINS?: string;

  /** URL base de la API de Midvash. */
  MIDVASH_BASE_URL?: string;

  /** TTL (segundos) de la caché de versículos en KV. */
  BIBLE_CACHE_TTL?: string;

  /** Buzón destino del formulario de contacto. */
  CONTACT_TO?: string;

  /** Remitente verificado en Resend: "Nombre <correo@dominio.com>". */
  CONTACT_FROM?: string;

  /** Secreto: API Key de Resend. `wrangler secret put RESEND_API_KEY`. */
  RESEND_API_KEY?: string;

  /** "true" => no envía correos, solo los registra en los logs. */
  RESEND_DRY_RUN?: string;

  /** KV opcional: caché de la Biblia + rate-limit del formulario. */
  CACHE?: KVNamespace;
}

/** Contexto de Hono: bindings + variables de request. */
export interface AppContext {
  Bindings: Env;
  Variables: {
    /** ID único de la petición (trazabilidad / soporte). */
    requestId: string;
  };
}

/** Códigos de error estables que consume el frontend. */
export type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "NOT_CONFIGURED"
  | "INTERNAL_ERROR";

/** Cuerpo de error estructurado devuelto por la API. */
export interface ApiErrorBody {
  /** Mensaje legible en español, listo para mostrar al usuario. */
  error: string;
  /** Código estable para ramificar en el frontend. */
  code: ApiErrorCode;
  /** Datos extra (pistas, campos inválidos, mensaje del proveedor...). */
  details?: unknown;
  /** ID de la petición para cruzar con los logs. */
  requestId?: string;
}

/** Versículo (o pasaje) normalizado que devuelve nuestra API. */
export interface BibleVerseDTO {
  /** Referencia tal como la reporta Midvash, ej. "John 3:16". */
  reference: string;
  /** Slug de la versión realmente entregada, ej. "rvr1909". */
  version: string;
  /** Nombre legible de la versión, ej. "Reina-Valera 1909". */
  versionName: string;
  /** Slug del libro en inglés, ej. "john". */
  book: string;
  /** Nombre del libro según Midvash, ej. "John". */
  bookName: string;
  chapter: number;
  verse: number;
  verseEnd: number;
  /** Texto completo del pasaje en un solo string. */
  text: string;
  /** Texto versículo por versículo (útil para capítulos). */
  verses: string[];
  /** Aviso legal/textual de la versión (obligatorio mostrarlo en la UI). */
  copyright: string | null;
  /** true si salió de la caché KV. */
  cached: boolean;
  /** true si Midvash devolvió una versión distinta a la solicitada. */
  versionMismatch: boolean;
  /** Aviso opcional para el frontend (ej. versión degradada). */
  notice?: string;
}

/** Versión bíblica disponible en Midvash. */
export interface BibleVersionDTO {
  slug: string;
  name: string;
  shortName: string;
  language: string;
  copyright: string | null;
}

/** Mensaje de contacto ya validado. */
export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/** Resultado del envío de correo. */
export interface EmailResult {
  id: string;
  delivered: boolean;
  dryRun: boolean;
}
