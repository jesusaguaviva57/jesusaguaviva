import type { Env } from "../types";

/**
 * Rate limiting en dos capas.
 *
 *  1. **KV (si está configurado)** — distribuido entre todos los isolates del
 *     Worker. Es la capa buena, pero KV es "eventualmente consistente", así que
 *     se considera *best effort*.
 *  2. **Memoria del isolate (siempre activa)** — respaldo para cuando no hay KV
 *     configurado. Cloudflare puede tener varios isolates sirviendo peticiones
 *     a la vez, por lo que no es un límite global exacto: cada isolate cuenta
 *     lo suyo y se reinicia en cada "cold start". Aun así frena en seco el
 *     abuso repetido de un mismo cliente (bots, doble clic, scripts).
 *
 * Para un límite global exacto habría que usar Durable Objects o el binding
 * *Rate Limiting* de Cloudflare; para el formulario de una iglesia, esto es
 * proporcionado (ver README).
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterSeconds: number;
}

const WINDOW_SECONDS = 600; // 10 minutos
const MAX_REQUESTS = 5;
const MAX_MEMORY_ENTRIES = 5_000;

/** Contadores en memoria del isolate (fallback sin KV). */
const memoryCounters = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  env: Env,
  bucket: string,
  limit: number = MAX_REQUESTS,
  windowSeconds: number = WINDOW_SECONDS,
): Promise<RateLimitResult> {
  if (!bucket) {
    return { allowed: true, remaining: limit, limit, retryAfterSeconds: 0 };
  }

  // Capa 1: KV distribuido.
  if (env.CACHE) {
    try {
      return await checkWithKv(env, bucket, limit, windowSeconds);
    } catch (error) {
      // Nunca romper el formulario por un fallo de KV: caemos a memoria.
      console.warn("[ratelimit] fallo consultando KV, uso memoria local", error);
    }
  }

  // Capa 2: memoria del isolate.
  return checkWithMemory(bucket, limit, windowSeconds);
}

async function checkWithKv(
  env: Env,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const cache = env.CACHE;
  if (!cache) return checkWithMemory(bucket, limit, windowSeconds);

  const key = `rl:${bucket}`;
  const current = Number.parseInt((await cache.get(key)) ?? "0", 10) || 0;

  if (current >= limit) {
    return { allowed: false, remaining: 0, limit, retryAfterSeconds: windowSeconds };
  }

  await cache.put(key, String(current + 1), { expirationTtl: windowSeconds });

  return { allowed: true, remaining: Math.max(0, limit - current - 1), limit, retryAfterSeconds: 0 };
}

function checkWithMemory(bucket: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  pruneExpired(now);

  const entry = memoryCounters.get(bucket);

  if (!entry || entry.resetAt <= now) {
    memoryCounters.set(bucket, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, limit, retryAfterSeconds: 0 };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  entry.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - entry.count), limit, retryAfterSeconds: 0 };
}

/** Evita que el Map crezca sin límite entre cold starts del isolate. */
function pruneExpired(now: number): void {
  if (memoryCounters.size < MAX_MEMORY_ENTRIES) return;
  for (const [key, entry] of memoryCounters) {
    if (entry.resetAt <= now) memoryCounters.delete(key);
  }
}

/** Identifica al cliente: IP de Cloudflare o, si no hay, el User-Agent. */
export function rateLimitBucket(request: Request, scope: string): string {
  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  const fallback = request.headers.get("User-Agent") ?? "unknown";
  return `${scope}:${ip || fallback}`;
}
