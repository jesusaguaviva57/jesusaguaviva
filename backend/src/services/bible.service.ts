import { ApiError } from "../lib/errors";
import { collapseWhitespace, normalizeReference } from "../lib/text";
import { MidvashClient } from "./midvash.client";
import type { BibleVerseDTO, BibleVersionDTO, Env } from "../types";

/**
 * Lógica de negocio del lector bíblico.
 *
 * Flujo de `GET /api/bible?query=Juan 3:16`:
 *   1. Normaliza y valida la query (400 si falta).
 *   2. Busca en la caché KV (si está configurada).
 *   3. Valida que la versión solicitada exista en Midvash.
 *      ⚠️ Clave: Midvash responde 200 con RVR1909 si le pides un slug que no
 *      existe (p. ej. "rvr1960"). Sin esta validación mostraríamos texto
 *      incorrecto etiquetado como otra versión.
 *   4. Resuelve la referencia con `/v1/parse` (entiende nombres en español).
 *   5. Descarga el pasaje y lo normaliza a `BibleVerseDTO`.
 *   6. Guarda en caché en segundo plano (no bloquea la respuesta).
 */

const DEFAULT_VERSION = "rvr1909";
const DEFAULT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 días
const VERSIONS_CACHE_KEY = "bible:versions:v1";
const VERSIONS_CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 horas
const MAX_QUERY_LENGTH = 120;

/** Opciones de ejecución (permite hacer caché sin bloquear la respuesta). */
export interface PassageOptions {
  /** Envía una promesa a segundo plano (Hono `executionCtx.waitUntil`). */
  waitUntil?: (work: Promise<unknown>) => void;
}

/** `GET /api/bible?query=...` */
export async function getPassage(
  env: Env,
  rawQuery: string,
  options: PassageOptions = {},
): Promise<BibleVerseDTO> {
  const query = collapseWhitespace(rawQuery ?? "");

  if (query.length === 0) {
    throw ApiError.badRequest("Falta el parámetro `query`. Ejemplo: /api/bible?query=Juan 3:16");
  }
  if (query.length > MAX_QUERY_LENGTH) {
    throw ApiError.badRequest(`La referencia es demasiado larga (máximo ${MAX_QUERY_LENGTH} caracteres).`);
  }

  const version = (env.BIBLE_VERSION ?? DEFAULT_VERSION).trim().toLowerCase();
  const cacheKey = `bible:v1:${version}:${normalizeReference(query)}`;

  // 2. Caché
  const cached = await readCache<BibleVerseDTO>(env, cacheKey);
  if (cached) return { ...cached, cached: true };

  const client = MidvashClient.fromEnv(env);

  // 3. Guardarraíl de versión
  const versionInfo = await findVersion(env, version, options);

  // 4. Parse
  const reference = await client.parse(query);

  // 5. Descarga
  const passage = await client.passage(
    version,
    reference.bookSlug,
    reference.chapter,
    reference.verseStart,
    reference.verseEnd,
  );

  const versionMismatch = passage.version.toLowerCase() !== version;
  if (versionMismatch) {
    // No es un error fatal, pero el usuario debe saberlo. Nunca mentimos
    // sobre qué versión está leyendo.
    console.warn("[bible] version mismatch", { requested: version, received: passage.version, query });
  }

  const dto: BibleVerseDTO = {
    reference: passage.reference,
    version: passage.version,
    versionName: versionMismatch ? passage.version.toUpperCase() : versionInfo.name,
    book: passage.book,
    bookName: passage.bookName,
    chapter: passage.chapter,
    verse: passage.verse,
    verseEnd: passage.verseEnd,
    text: passage.text,
    verses: passage.verses,
    copyright: passage.copyright ?? versionInfo.copyright,
    cached: false,
    versionMismatch,
    ...(versionMismatch
      ? {
          notice: `Midvash no tiene la versión "${version}" y devolvió "${passage.version}". Revisa BIBLE_VERSION en wrangler.toml.`,
        }
      : {}),
  };

  // 6. Caché en segundo plano
  scheduleCacheWrite(env, cacheKey, dto, options);

  return dto;
}

/** `GET /api/bible/versions` -> catálogo de versiones (con las de español primero). */
export async function listVersions(env: Env, options: PassageOptions = {}): Promise<BibleVersionDTO[]> {
  const cached = await readCache<BibleVersionDTO[]>(env, VERSIONS_CACHE_KEY);
  if (cached) return cached;

  const client = MidvashClient.fromEnv(env);
  const versions = await client.versions();

  const dto: BibleVersionDTO[] = versions.map((version) => ({
    slug: version.slug,
    name: version.name,
    shortName: version.shortName,
    language: version.language,
    copyright: version.copyright,
  }));

  // Español primero: es lo que necesita esta iglesia.
  dto.sort((a, b) => {
    if (a.language === "es" && b.language !== "es") return -1;
    if (b.language === "es" && a.language !== "es") return 1;
    return a.name.localeCompare(b.name, "es");
  });

  scheduleCacheWrite(env, VERSIONS_CACHE_KEY, dto, options, VERSIONS_CACHE_TTL_SECONDS);

  return dto;
}

/** Versión por defecto + aviso de configuración (lo usa `/api/health`). */
export function configuredVersion(env: Env): string {
  return (env.BIBLE_VERSION ?? DEFAULT_VERSION).trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Interno
// ---------------------------------------------------------------------------

/**
 * Comprueba que el slug exista en Midvash. Si no, devuelve 400 explicando
 * cuáles sí existen en español (evita el falso positivo de Midvash).
 */
async function findVersion(
  env: Env,
  slug: string,
  options: PassageOptions,
): Promise<BibleVersionDTO> {
  let versions: BibleVersionDTO[];
  try {
    versions = await listVersions(env, options);
  } catch (error) {
    // Si el catálogo falla, no bloqueamos la lectura del versículo:
    // más abajo el chequeo `versionMismatch` sigue protegiendo la integridad.
    console.warn("[bible] no se pudo verificar el catálogo de versiones", error);
    return { slug, name: slug.toUpperCase(), shortName: slug.toUpperCase(), language: "und", copyright: null };
  }

  const found = versions.find((version) => version.slug.toLowerCase() === slug);
  if (found) return found;

  const spanish = versions.filter((version) => version.language === "es");
  throw ApiError.badRequest(
    `La versión "${slug}" no existe en la API de la Biblia.`,
    {
      requestedVersion: slug,
      availableSpanish: spanish.map((version) => ({ slug: version.slug, name: version.name })),
      hint:
        slug === "rvr1960"
          ? "La Reina-Valera 1960 no está disponible en Midvash por derechos de autor. Usa \"rvr1909\" (dominio público) o \"rvg\" (Reina-Valera Gómez 2010)."
          : "Configura BIBLE_VERSION en wrangler.toml con uno de los slugs disponibles.",
    },
  );
}

async function readCache<T>(env: Env, key: string): Promise<T | null> {
  if (!env.CACHE) return null;
  try {
    return await env.CACHE.get<T>(key, "json");
  } catch (error) {
    console.warn("[bible] error leyendo la caché KV", error);
    return null;
  }
}

function scheduleCacheWrite(
  env: Env,
  key: string,
  value: unknown,
  options: PassageOptions,
  ttlSeconds: number = cacheTtl(env),
): void {
  if (!env.CACHE) return;
  const work = env.CACHE.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  if (options.waitUntil) options.waitUntil(work);
  else void work.catch(() => undefined);
}

function cacheTtl(env: Env): number {
  const parsed = Number.parseInt(env.BIBLE_CACHE_TTL ?? "", 10);
  return Number.isFinite(parsed) && parsed > 60 ? parsed : DEFAULT_CACHE_TTL_SECONDS;
}
