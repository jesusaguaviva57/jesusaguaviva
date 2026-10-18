import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { applyCorsHeaders } from "./cors";
import { ApiError } from "./errors";
import type { ApiErrorBody, AppContext } from "../types";

/** Respuesta JSON de éxito. */
export function jsonOk<T>(c: Context<AppContext>, body: T, status: number = 200): Response {
  return c.json(body, status as ContentfulStatusCode);
}

/** Respuesta JSON de éxito con caché HTTP (la CDN de Vercel/Cloudflare la aprovecha). */
export function jsonCached<T>(c: Context<AppContext>, body: T, seconds: number): Response {
  return c.json(body, 200, {
    "Cache-Control": `public, max-age=${seconds}, s-maxage=${seconds}, stale-while-revalidate=86400`,
  });
}

/**
 * Convierte cualquier error en la respuesta estructurada del contrato.
 *
 * Se usa desde `app.onError` y desde el `notFound` global. Aplica las
 * cabeceras CORS manualmente porque, cuando una ruta lanza una excepción,
 * el middleware CORS no llega a ejecutar su parte "post-next()".
 */
export function toErrorResponse(c: Context<AppContext>, error: unknown): Response {
  const apiError = error instanceof ApiError ? error : ApiError.internal();

  if (!(error instanceof ApiError)) {
    // Solo aquí se registra el stack: son errores no previstos.
    console.error("[api] error no controlado", {
      requestId: c.get("requestId"),
      path: c.req.path,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  const body: ApiErrorBody = {
    error: apiError.message,
    code: apiError.code,
    requestId: c.get("requestId"),
    ...(apiError.details === undefined ? {} : { details: apiError.details }),
  };

  const response = c.json(body, apiError.status as ContentfulStatusCode);
  applyCorsHeaders(response.headers, c.req.header("Origin") ?? undefined, c.env);
  return response;
}
