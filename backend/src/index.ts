import { Hono } from "hono";
import { corsMiddleware, parseAllowedOrigins } from "./lib/cors";
import { ApiError } from "./lib/errors";
import { loggerMiddleware, requestIdMiddleware } from "./lib/middleware";
import { toErrorResponse } from "./lib/response";
import { bibleRoutes } from "./routes/bible";
import { contactRoutes } from "./routes/contact";
import { configuredVersion } from "./services/bible.service";
import type { AppContext } from "./types";

/**
 * ============================================================================
 *  API Gateway · Iglesia Jesús Agua Viva
 *  Cloudflare Workers + Hono + TypeScript estricto
 * ============================================================================
 *
 *  Endpoints:
 *    GET  /                          -> índice de la API
 *    GET  /api/health                -> estado y configuración (sin secretos)
 *    GET  /api/bible?query=Juan 3:16 -> versículo / rango / capítulo completo
 *    GET  /api/bible/versions        -> versiones disponibles en Midvash
 *    POST /api/contact               -> formulario de contacto vía Resend
 *    OPTIONS *                       -> preflight CORS
 *
 *  Contrato de error (siempre el mismo, siempre en español):
 *    { "error": "mensaje legible", "code": "NOT_FOUND", "requestId": "4f2c9a1b" }
 */

const API_VERSION = "1.0.0";

const app = new Hono<AppContext>();

// ---------------------------------------------------------------------------
// Middlewares globales (el orden importa)
//  1. CORS: corta el preflight OPTIONS antes de tocar nada más.
//  2. requestId: trazabilidad en todas las respuestas.
//  3. Logger: una línea JSON por petición (indexable en Cloudflare).
// ---------------------------------------------------------------------------
app.use("*", corsMiddleware);
app.use("*", requestIdMiddleware);
app.use("*", loggerMiddleware);

// ---------------------------------------------------------------------------
// Metadatos
// ---------------------------------------------------------------------------
app.get("/", (c) =>
  c.json({
    name: "API Iglesia Jesús Agua Viva",
    version: API_VERSION,
    docs: "GET /api/health para ver la configuración activa",
    endpoints: [
      { method: "GET", path: "/api/health", description: "Estado del servicio" },
      { method: "GET", path: "/api/bible?query=Juan%203:16", description: "Versículo, rango o capítulo (Biblia)" },
      { method: "GET", path: "/api/bible/versions", description: "Versiones bíblicas disponibles" },
      { method: "POST", path: "/api/contact", description: "Formulario de contacto (Resend)" },
    ],
  }),
);

app.get("/api/health", (c) => {
  const env = c.env;
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  const version = configuredVersion(env);
  const dryRun = env.RESEND_DRY_RUN === "true";

  return c.json({
    status: "ok",
    version: API_VERSION,
    environment: env.ENVIRONMENT ?? "production",
    timestamp: new Date().toISOString(),
    bible: {
      version,
      upstream: env.MIDVASH_BASE_URL ?? "https://api.midvash.com",
      warning:
        version === "rvr1960"
          ? "RVR1960 no existe en Midvash: las peticiones fallarán con 400 hasta que configures rvr1909 o rvg."
          : null,
    },
    email: {
      configured: Boolean(env.RESEND_API_KEY),
      dryRun,
      to: maskEmail(env.CONTACT_TO),
    },
    cache: {
      enabled: Boolean(env.CACHE),
      ttlSeconds: env.BIBLE_CACHE_TTL ?? null,
    },
    cors: {
      allowedOrigins,
      wildcard: allowedOrigins.includes("*"),
    },
  });
});

// ---------------------------------------------------------------------------
// Rutas de negocio (montadas bajo /api)
// ---------------------------------------------------------------------------
app.route("/api", bibleRoutes);
app.route("/api", contactRoutes);

// ---------------------------------------------------------------------------
// 404 y manejo global de errores
// ---------------------------------------------------------------------------
app.notFound((c) => {
  // Dentro de /api siempre devolvemos JSON estructurado;
  // fuera de /api, un JSON informativo (este Worker no sirve HTML).
  if (c.req.path.startsWith("/api")) {
    return toErrorResponse(
      c,
      ApiError.notFound(`La ruta ${c.req.method} ${c.req.path} no existe en esta API.`, {
        hint: "Consulta GET / para ver los endpoints disponibles.",
      }),
    );
  }
  return c.json({ name: "API Iglesia Jesús Agua Viva", hint: "Prueba GET /api/health" }, 404);
});

app.onError((error, c) => toErrorResponse(c, error));

// ---------------------------------------------------------------------------
// Export del Worker.
// Se exporta un objeto (en lugar de `export default app`) para poder añadir
// en el futuro handlers `scheduled` (cron) o `queue` sin reestructurar nada.
// ---------------------------------------------------------------------------
export default {
  fetch: app.fetch,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ofusca un email para poder mostrarlo en /api/health sin filtrarlo. */
function maskEmail(email: string | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}
