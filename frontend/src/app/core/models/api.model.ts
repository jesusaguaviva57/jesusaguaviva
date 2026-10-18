/**
 * Contrato de la API (Cloudflare Workers) tipado para el frontend.
 * Se mantiene espejo de `backend/src/types.ts`.
 */

/** Sobre de respuesta estándar: { data, meta }. */
export interface ApiEnvelope<T> {
  data: T;
  meta?: {
    cached?: boolean;
    requestId?: string;
  };
}

/** Cuerpo de error estructurado del backend. */
export interface ApiErrorPayload {
  error?: string;
  code?: string;
  details?: unknown;
  requestId?: string;
}

/** Pasaje bíblico normalizado. */
export interface BibleVerse {
  reference: string;
  version: string;
  versionName: string;
  book: string;
  bookName: string;
  chapter: number;
  verse: number;
  verseEnd: number;
  text: string;
  verses: string[];
  copyright: string | null;
  cached: boolean;
  versionMismatch: boolean;
  notice?: string;
}

/** Versión bíblica disponible. */
export interface BibleVersion {
  slug: string;
  name: string;
  shortName: string;
  language: string;
  copyright: string | null;
}

/** Datos que envía el formulario de contacto. */
export interface ContactPayload {
  name: string;
  email: string;
  /** Título o asunto del mensaje: se usa como asunto del correo. */
  subject: string;
  message: string;
  /** Honeypot: siempre vacío para humanos. */
  website?: string;
}

/** Resultado del envío del formulario. */
export interface ContactResult {
  id: string;
  delivered: boolean;
  dryRun: boolean;
}

/** Error de formulario devuelto por el backend (`details.fields`). */
export interface FieldIssue {
  field: string;
  message: string;
}

/**
 * Error normalizado de la API. El interceptor `apiErrorInterceptor` convierte
 * cualquier `HttpErrorResponse` en esta clase, de modo que los componentes
 * siempre manejan el mismo tipo.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** true si el servidor no respondió (red, CORS, offline). */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

/**
 * Convierte cualquier error capturado en un `ApiError`.
 * Normalmente el interceptor ya lo hace; esto cubre errores lanzados en el
 * propio componente o por un operador RxJS.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
  return new ApiError(message, 0, 'UNKNOWN_ERROR');
}

/** Extrae los errores por campo de un ApiError (si los trae). */
export function extractFieldIssues(error: unknown): FieldIssue[] {
  if (!(error instanceof ApiError)) return [];
  const details = error.details;
  if (typeof details !== 'object' || details === null) return [];

  const raw = (details as { fields?: unknown }).fields;
  if (!Array.isArray(raw)) return [];

  const issues: FieldIssue[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const field = (item as { field?: unknown }).field;
    const message = (item as { message?: unknown }).message;
    if (typeof field === 'string' && typeof message === 'string') {
      issues.push({ field, message });
    }
  }
  return issues;
}
