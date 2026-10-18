import { Hono } from "hono";
import { background } from "../lib/middleware";
import { jsonCached } from "../lib/response";
import { getPassage, listVersions } from "../services/bible.service";
import type { AppContext } from "../types";

/**
 * Rutas bíblicas. Se montan bajo `/api`, por lo que las rutas completas son:
 *
 *   GET /api/bible?query=Juan 3:16   -> versículo, rango o capítulo completo
 *   GET /api/bible/versions          -> catálogo de versiones disponibles
 *
 * El frontend NUNCA llama a Midvash directamente: toda la lectura pasa por
 * aquí, así controlamos CORS, caché, formato de respuesta y errores.
 */
export const bibleRoutes = new Hono<AppContext>();

bibleRoutes.get("/bible", async (c) => {
  // Aceptamos `query` (contrato) y `q` (atajo cómodo).
  const query = c.req.query("query") ?? c.req.query("q") ?? "";

  const data = await getPassage(c.env, query, {
    waitUntil: (work) => background(c, work),
  });

  // 1 hora de caché en el navegador/CDN: el texto bíblico es inmutable.
  return jsonCached(
    c,
    {
      data,
      meta: {
        cached: data.cached,
        requestId: c.get("requestId"),
      },
    },
    3600,
  );
});

bibleRoutes.get("/bible/versions", async (c) => {
  const data = await listVersions(c.env, {
    waitUntil: (work) => background(c, work),
  });

  return jsonCached(
    c,
    {
      data,
      meta: {
        total: data.length,
        requestId: c.get("requestId"),
      },
    },
    86_400,
  );
});
