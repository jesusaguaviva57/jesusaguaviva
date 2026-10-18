import type { MiddlewareHandler } from "hono";
import type { AppContext } from "../types";

/** Genera un ID corto y legible para trazar una petición en los logs. */
function createRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Middleware 1: asigna un `requestId` a cada petición y lo devuelve en la
 * cabecera `X-Request-Id` (útil para soporte: "tu error fue el id 4f2c9a1b").
 */
export const requestIdMiddleware: MiddlewareHandler<AppContext> = async (c, next) => {
  const requestId = c.req.header("X-Request-Id") ?? createRequestId();
  c.set("requestId", requestId);
  await next();
  c.res.headers.set("X-Request-Id", requestId);
  // Cabecera de seguridad básica (el frontend vive en otro dominio).
  c.res.headers.set("Referrer-Policy", "no-referrer");
  c.res.headers.set("X-Content-Type-Options", "nosniff");
};

/**
 * Middleware 2: log estructurado (una línea JSON por petición).
 * Cloudflare los indexa y se consultan con `wrangler tail`.
 */
export const loggerMiddleware: MiddlewareHandler<AppContext> = async (c, next) => {
  const startedAt = Date.now();
  await next();
  console.log(
    JSON.stringify({
      level: "info",
      requestId: c.get("requestId"),
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Date.now() - startedAt,
      country: c.req.raw.cf?.country ?? null,
    }),
  );
};

/**
 * Contexto mínimo con `executionCtx`. Se declara así (en lugar de usar el
 * `ExecutionContext` global) para que sea compatible tanto con el `Context` de
 * Hono como con `ExecutionContext` de Workers sin pelearse con los genéricos.
 */
interface WaitUntilContext {
  executionCtx: { waitUntil(work: Promise<unknown>): void };
}

/**
 * Ejecuta trabajo en segundo plano (escrituras a KV) sin bloquear la respuesta.
 * Si el contexto no expone `waitUntil` (p. ej. tests), simplemente se ignora.
 */
export function background(c: WaitUntilContext, work: Promise<unknown>): void {
  const safeWork = work.catch((error: unknown) => {
    console.error("[api] background task failed", error);
  });
  try {
    c.executionCtx.waitUntil(safeWork);
  } catch {
    // Sin ExecutionContext: no hay nada más que hacer, el trabajo ya está lanzado.
  }
}
