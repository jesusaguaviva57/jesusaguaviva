import type { ApiErrorCode } from "../types";

/**
 * Error controlado de la API.
 *
 * Se lanza desde cualquier capa (servicios, rutas) y lo transforma
 * `toErrorResponse()` en el JSON estructurado del contrato:
 *
 *   { "error": "Versículo no encontrado", "code": "NOT_FOUND", "requestId": "..." }
 *
 * Cualquier error NO instanciado como ApiError se considera bug interno
 * y se devuelve como 500 sin filtrar detalles al cliente.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, "BAD_REQUEST", message, details);
  }

  static validation(message: string, details?: unknown): ApiError {
    return new ApiError(400, "VALIDATION_ERROR", message, details);
  }

  static notFound(message: string, details?: unknown): ApiError {
    return new ApiError(404, "NOT_FOUND", message, details);
  }

  static rateLimited(message: string, details?: unknown): ApiError {
    return new ApiError(429, "RATE_LIMITED", message, details);
  }

  /** Fallo de un proveedor externo (Midvash, Resend...). */
  static upstream(message: string, details?: unknown): ApiError {
    return new ApiError(502, "UPSTREAM_ERROR", message, details);
  }

  /** Falta configuración en el Worker (secreto o variable). */
  static notConfigured(message: string, details?: unknown): ApiError {
    return new ApiError(500, "NOT_CONFIGURED", message, details);
  }

  static internal(message = "Ocurrió un error inesperado. Intenta de nuevo en unos minutos."): ApiError {
    return new ApiError(500, "INTERNAL_ERROR", message);
  }

  static methodNotAllowed(message = "Método HTTP no permitido."): ApiError {
    return new ApiError(405, "METHOD_NOT_ALLOWED", message);
  }
}
