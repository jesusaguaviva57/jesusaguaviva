import type { MiddlewareHandler } from "hono";
import type { AppContext, Env } from "../types";

/**
 * CORS explícito y auditable.
 *
 * Decisiones de diseño:
 *  1. NUNCA se responde con `Access-Control-Allow-Origin: *` salvo que lo pidas
 *     a propósito poniendo `ALLOWED_ORIGINS="*"`. Se refleja el `Origin` exacto.
 *  2. Todo se controla desde la variable `ALLOWED_ORIGINS` (coma-separada).
 *     Admite comodines: `https://mi-iglesia-*.vercel.app` (previews de Vercel).
 *  3. Las respuestas de error también llevan cabeceras CORS. Esto es clave:
 *     si un 4xx/5xx no lleva CORS, el navegador oculta el mensaje y el frontend
 *     solo ve "network error".
 *  4. Preflight (`OPTIONS`) responde 204 sin tocar la base de datos ni Midvash.
 */

/** Convierte `ALLOWED_ORIGINS` en una lista normalizada. */
export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter((origin) => origin.length > 0);
}

/** Comodín seguro: `*` -> `[^/]*` (no cruza `/`, así no se escapa del dominio). */
function originToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`, "i");
}

/** ¿El origen de la petición está en la lista blanca? */
export function isOriginAllowed(origin: string | undefined, env: Env): boolean {
  if (!origin) return false;
  return parseAllowedOrigins(env.ALLOWED_ORIGINS).some(
    (pattern) => pattern === "*" || originToRegExp(pattern).test(origin),
  );
}

/** Añade `Vary: Origin` (sin duplicarlo) para no envenenar cachés intermedias. */
function appendVaryOrigin(headers: Headers): void {
  const current = headers.get("Vary");
  if (!current) {
    headers.set("Vary", "Origin");
    return;
  }
  const alreadyPresent = current.split(",").some((value) => value.trim().toLowerCase() === "origin");
  if (!alreadyPresent) headers.set("Vary", `${current}, Origin`);
}

/**
 * Aplica las cabeceras CORS a un `Headers` ya existente.
 * Exportada para poder reutilizarla en el manejador global de errores.
 */
export function applyCorsHeaders(headers: Headers, origin: string | undefined, env: Env): void {
  appendVaryOrigin(headers);
  if (!origin || !isOriginAllowed(origin, env)) return;

  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Accept, X-Requested-With");
  headers.set("Access-Control-Expose-Headers", "X-Request-Id");
  headers.set("Access-Control-Max-Age", "86400");
}

/** Middleware CORS. Debe registrarse el PRIMERO en la cadena. */
export const corsMiddleware: MiddlewareHandler<AppContext> = async (c, next) => {
  const origin = c.req.header("Origin") ?? undefined;

  // Preflight: se responde antes de llegar a las rutas.
  if (c.req.method === "OPTIONS") {
    const headers = new Headers();
    applyCorsHeaders(headers, origin, c.env);
    return new Response(null, { status: 204, headers });
  }

  await next();
  applyCorsHeaders(c.res.headers, origin, c.env);
};
