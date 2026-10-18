import { Hono } from "hono";
import { ApiError } from "../lib/errors";
import { jsonOk } from "../lib/response";
import { assertValidContact } from "../lib/validation";
import { sendContactEmail } from "../services/email.service";
import { checkRateLimit, rateLimitBucket } from "../services/rate-limit";
import type { AppContext } from "../types";

/**
 * POST /api/contact
 *
 * Cadena de defensa:
 *   1. Rate limit por IP (5 envíos / 10 min) — solo si KV está configurado.
 *   2. Cuerpo JSON válido y de tamaño acotado.
 *   3. Validación de campos (nombre, email, mensaje).
 *   4. Honeypot `website`: si viene relleno, es un bot -> falso éxito.
 *   5. Envío con Resend (la API Key nunca sale del Worker).
 */
export const contactRoutes = new Hono<AppContext>();

contactRoutes.post("/contact", async (c) => {
  const requestId = c.get("requestId");

  // 1) Rate limit
  const rateLimit = await checkRateLimit(c.env, rateLimitBucket(c.req.raw, "contact"));
  if (!rateLimit.allowed) {
    c.header("Retry-After", String(rateLimit.retryAfterSeconds));
    throw ApiError.rateLimited(
      "Has enviado varios mensajes seguidos. Espera unos minutos e inténtalo de nuevo.",
      { retryAfterSeconds: rateLimit.retryAfterSeconds },
    );
  }

  // 2) Cuerpo
  const payload = await readJsonBody(c.req.raw);

  // 3) Validación
  const { value, isSpam } = assertValidContact(payload);

  // 4) Honeypot: respondemos 202 sin enviar nada (el bot cree que funcionó).
  if (isSpam) {
    console.warn(JSON.stringify({ level: "warn", msg: "contact:honeypot", requestId }));
    return jsonOk(
      c,
      { data: { id: "ignored", delivered: false, dryRun: false }, meta: { requestId } },
      202,
    );
  }

  // 5) Envío
  const country = c.req.raw.cf?.country;
  const result = await sendContactEmail(c.env, value, {
    requestId,
    ip: c.req.header("CF-Connecting-IP") ?? undefined,
    country: typeof country === "string" ? country : undefined,
  });

  // Nota: aquí solo se notifica a la iglesia. Si quieres acuse de recibo
  // automático al usuario, añade un segundo envío a `value.email`.
  return jsonOk(
    c,
    {
      data: result,
      meta: { requestId },
    },
    200,
  );
});

/** Lee y valida el cuerpo JSON (tipo, tamaño y sintaxis). */
async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw ApiError.badRequest("El cuerpo debe enviarse con Content-Type: application/json.");
  }

  const raw = await request.text();
  if (raw.length === 0) {
    throw ApiError.badRequest("El cuerpo de la petición está vacío.");
  }
  if (raw.length > 20_000) {
    throw ApiError.badRequest("El cuerpo de la petición es demasiado grande.");
  }

  try {
    // Algunos clientes (herramientas Windows antiguas) añaden un BOM UTF-8 al
    // principio del cuerpo; `JSON.parse` lo rechazaría. Lo quitamos.
    const cleaned = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    return JSON.parse(cleaned) as unknown;
  } catch {
    throw ApiError.badRequest("El cuerpo enviado no es JSON válido.");
  }
}
