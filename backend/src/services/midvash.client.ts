import { ApiError } from "../lib/errors";
import { collapseWhitespace } from "../lib/text";

/**
 * Cliente HTTP de la API pública de Midvash (Biblia).
 * Docs: https://api.midvash.com/  ·  Descubrimiento: https://api.midvash.com/v1
 *
 * Este cliente es la ÚNICA parte del Worker que habla con Midvash.
 * Ventajas de centralizarlo aquí:
 *   - El frontend nunca depende de un tercero (si Midvash cambia, se arregla aquí).
 *   - Se añade timeout, reintento y validación de forma de respuesta.
 *   - Se traducen sus errores a nuestro contrato `{ error, code, details }`.
 */

const DEFAULT_BASE_URL = "https://api.midvash.com";
const REQUEST_TIMEOUT_MS = 8_000;

/** Forma cruda de `/v1/parse`. */
interface RawParseResponse {
  data?: {
    bookId?: number;
    book_slug?: string;
    chapter?: number;
    verse_start?: number | null;
    verse_end?: number | null;
  };
}

/** Forma cruda de `/v1/{version}/{book}/{chapter}[/{verse}]`. */
interface RawPassageResponse {
  data?: {
    version?: string;
    book?: string;
    bookName?: string;
    chapter?: number;
    verse?: number;
    verseEnd?: number;
    text?: string;
    verses?: string[];
  };
  meta?: {
    reference?: string;
    total?: number;
    copyright?: string;
  };
}

/** Forma cruda de `/v1/versions`. */
interface RawVersionsResponse {
  data?: Array<{
    slug?: string;
    name?: string;
    shortName?: string;
    language?: string;
    copyright?: string;
  }>;
}

/** Errores tal como los devuelve Midvash. */
interface RawErrorResponse {
  error?: { code?: string; message?: string; details?: unknown };
}

/** Referencia ya resuelta por Midvash. */
export interface ParsedReference {
  bookId: number;
  bookSlug: string;
  chapter: number;
  /** null => se pidió el capítulo completo. */
  verseStart: number | null;
  verseEnd: number | null;
}

/** Pasaje resuelto y normalizado. */
export interface PassageResult {
  version: string;
  book: string;
  bookName: string;
  chapter: number;
  verse: number;
  verseEnd: number;
  text: string;
  verses: string[];
  reference: string;
  copyright: string | null;
}

/** Versión bíblica disponible. */
export interface UpstreamVersion {
  slug: string;
  name: string;
  shortName: string;
  language: string;
  copyright: string | null;
}

export class MidvashClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  static fromEnv(env: { MIDVASH_BASE_URL?: string }): MidvashClient {
    return new MidvashClient(env.MIDVASH_BASE_URL ?? DEFAULT_BASE_URL);
  }

  /** `GET /v1/parse?q=Juan 3:16` -> referencia estructurada. */
  async parse(query: string): Promise<ParsedReference> {
    const body = await this.request<RawParseResponse>(
      `/v1/parse?q=${encodeURIComponent(collapseWhitespace(query))}`,
      { context: "parse" },
    );

    const data = body.data;
    if (
      !data ||
      typeof data.book_slug !== "string" ||
      typeof data.chapter !== "number"
    ) {
      throw ApiError.upstream("La API de la Biblia devolvió una referencia inesperada.");
    }

    return {
      bookId: typeof data.bookId === "number" ? data.bookId : 0,
      bookSlug: data.book_slug,
      chapter: data.chapter,
      verseStart: typeof data.verse_start === "number" ? data.verse_start : null,
      verseEnd: typeof data.verse_end === "number" ? data.verse_end : null,
    };
  }

  /**
   * `GET /v1/{version}/{book}/{chapter}[/{verse}[-{end}]]`
   * Sin `verseStart` devuelve el capítulo completo.
   */
  async passage(
    version: string,
    bookSlug: string,
    chapter: number,
    verseStart?: number | null,
    verseEnd?: number | null,
  ): Promise<PassageResult> {
    const segments = [version, bookSlug, String(chapter)];
    if (typeof verseStart === "number" && verseStart > 0) {
      const range =
        typeof verseEnd === "number" && verseEnd > verseStart
          ? `${verseStart}-${verseEnd}`
          : String(verseStart);
      segments.push(range);
    }

    const body = await this.request<RawPassageResponse>(`/v1/${segments.join("/")}`, { context: "passage" });
    const data = body.data;

    if (!data || typeof data.text !== "string") {
      throw ApiError.notFound("No encontramos ese pasaje en la Biblia.");
    }

    const chapterNumber = typeof data.chapter === "number" ? data.chapter : chapter;
    const verse = typeof data.verse === "number" ? data.verse : (verseStart ?? 1);
    const verseEndNumber = typeof data.verseEnd === "number" ? data.verseEnd : verse;

    return {
      version: typeof data.version === "string" ? data.version : version,
      book: typeof data.book === "string" ? data.book : bookSlug,
      bookName: typeof data.bookName === "string" ? data.bookName : bookSlug,
      chapter: chapterNumber,
      verse,
      verseEnd: verseEndNumber,
      text: data.text,
      verses: Array.isArray(data.verses) && data.verses.length > 0 ? data.verses : [data.text],
      reference: body.meta?.reference ?? `${bookSlug} ${chapterNumber}:${verse}`,
      copyright: typeof body.meta?.copyright === "string" ? body.meta.copyright : null,
    };
  }

  /** `GET /v1/versions` -> catálogo de versiones disponibles. */
  async versions(): Promise<UpstreamVersion[]> {
    const body = await this.request<RawVersionsResponse>("/v1/versions", { context: "versions" });
    const list = Array.isArray(body.data) ? body.data : [];

    const versions: UpstreamVersion[] = [];
    for (const item of list) {
      if (typeof item?.slug !== "string" || item.slug.length === 0) continue;
      versions.push({
        slug: item.slug,
        name: typeof item.name === "string" ? item.name : item.slug,
        shortName: typeof item.shortName === "string" ? item.shortName : item.slug.toUpperCase(),
        language: typeof item.language === "string" ? item.language : "und",
        copyright: typeof item.copyright === "string" ? item.copyright : null,
      });
    }

    return versions;
  }

  // -------------------------------------------------------------------------
  // Interno
  // -------------------------------------------------------------------------

  /**
   * GET con timeout, un reintento y traducción de errores al contrato de la API.
   * `context` solo sirve para enriquecer los logs/detalles.
   */
  private async request<T>(
    path: string,
    options: { context: string; retries?: number },
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const maxAttempts = (options.retries ?? 1) + 1;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url);
        const payload = await this.parseJson(response);

        if (response.ok) return payload as T;

        // 5xx: reintentamos una vez (Midvash puede tener un parpadeo).
        if (response.status >= 500 && attempt < maxAttempts) {
          lastError = { status: response.status, payload };
          continue;
        }

        throw this.mapUpstreamError(response.status, payload as RawErrorResponse, options.context);
      } catch (error) {
        if (error instanceof ApiError) throw error;

        lastError = error;
        if (attempt >= maxAttempts) break;
      }
    }

    console.error("[midvash] upstream failure", { url, context: options.context, lastError });
    throw ApiError.upstream(
      "La API de la Biblia no está disponible en este momento. Intenta de nuevo en unos segundos.",
    );
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async parseJson(response: Response): Promise<unknown> {
    const raw = await response.text();
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return { error: { code: "INVALID_JSON", message: raw.slice(0, 200) } } satisfies RawErrorResponse;
    }
  }

  /** Traduce los códigos de Midvash a nuestro contrato (mensajes en español). */
  private mapUpstreamError(status: number, payload: RawErrorResponse, context: string): ApiError {
    const upstream = payload.error?.message ?? `HTTP ${status}`;
    const details: Record<string, unknown> = {
      upstream,
      upstreamCode: payload.error?.code ?? null,
      context,
      ...toDetailsObject(payload.error?.details),
    };

    switch (payload.error?.code) {
      case "INVALID_PARAMS": {
        // Midvash usa INVALID_PARAMS tanto para "no entiendo la referencia"
        // como para "ese capítulo no existe". Distinguimos por `maxChapters`.
        const maxChapters = details["maxChapters"];
        if (typeof maxChapters === "number") {
          return ApiError.notFound(
            `Ese capítulo no existe en ese libro: solo tiene ${maxChapters} capítulo${maxChapters === 1 ? "" : "s"}.`,
            details,
          );
        }
        return ApiError.badRequest(
          "No pudimos interpretar esa referencia. Usa el formato: Libro Capítulo:Versículo (ej. Juan 3:16).",
          details,
        );
      }
      case "BOOK_NOT_FOUND":
        return ApiError.notFound("No encontramos ese libro de la Biblia.", details);
      case "VERSE_NOT_FOUND":
      case "CHAPTER_NOT_FOUND":
        return ApiError.notFound("Ese capítulo o versículo no existe. Verifica el número.", details);
      default:
        if (status === 404) return ApiError.notFound("No encontramos ese pasaje en la Biblia.", details);
        if (status === 400) {
          return ApiError.badRequest("La referencia bíblica no es válida. Revisa el libro, capítulo y versículo.", details);
        }
        return ApiError.upstream(
          "La API de la Biblia no está disponible en este momento. Intenta de nuevo en unos segundos.",
          details,
        );
    }
  }
}

/** `details` de Midvash es `unknown`: solo lo propagamos si es un objeto plano. */
function toDetailsObject(details: unknown): Record<string, unknown> {
  if (typeof details === "object" && details !== null && !Array.isArray(details)) {
    return details as Record<string, unknown>;
  }
  return details === undefined ? {} : { upstreamDetails: details };
}
