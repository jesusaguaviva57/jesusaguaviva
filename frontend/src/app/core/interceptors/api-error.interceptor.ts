import { HttpErrorResponse } from '@angular/common/http';
import type { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiError, type ApiErrorPayload } from '../models/api.model';

/**
 * Interceptor funcional (Angular 16) que normaliza TODOS los errores HTTP
 * a `ApiError`. Ventajas:
 *   - Los componentes no repiten `if (err instanceof HttpErrorResponse)`.
 *   - Un fallo de CORS/red (status 0) se convierte en un mensaje entendible.
 *   - Se conserva `requestId` para soporte.
 */
export const apiErrorInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(
    catchError((error: unknown) => throwError(() => normalizeError(error))),
  );

function normalizeError(error: unknown): unknown {
  if (!(error instanceof HttpErrorResponse)) return error;

  // status 0 = no hubo respuesta HTTP: red caída, CORS bloqueado o timeout.
  if (error.status === 0) {
    return new ApiError(
      'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
      0,
      'NETWORK_ERROR',
    );
  }

  const payload = toPayload(error.error);
  const message =
    payload?.error ??
    (error.status >= 500
      ? 'El servidor tuvo un problema. Intenta de nuevo en unos minutos.'
      : 'No pudimos completar la solicitud.');

  return new ApiError(message, error.status, payload?.code ?? 'HTTP_ERROR', payload?.details, payload?.requestId);
}

function toPayload(body: unknown): ApiErrorPayload | null {
  if (typeof body !== 'object' || body === null) return null;
  return body as ApiErrorPayload;
}
