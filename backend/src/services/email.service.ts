import { ApiError } from "../lib/errors";
import { escapeHtml, textToSafeHtml } from "../lib/text";
import type { ContactMessage, EmailResult, Env } from "../types";

/**
 * Envío de correo transaccional con Resend desde el Worker.
 *
 * Seguridad:
 *  - La API Key vive en `env.RESEND_API_KEY` (secreto de Cloudflare) y NUNCA
 *    se devuelve al cliente ni se registra en logs.
 *  - Todo el contenido del usuario se escapa con `escapeHtml` antes de
 *    entrar en el HTML del correo (defensa contra inyección de HTML).
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 10_000;

interface ResendSuccess {
  id?: string;
}

interface ResendFailure {
  message?: string;
  name?: string;
  statusCode?: number;
}

export interface SendEmailContext {
  requestId: string;
  ip?: string;
  country?: string;
}

/**
 * Envía el mensaje del formulario al buzón de la iglesia.
 *
 * Modo simulado (`RESEND_DRY_RUN=true` o falta la API Key fuera de producción):
 * se registra el correo en los logs y se devuelve `delivered: false`, de modo
 * que desarrollar en local no requiere credenciales.
 */
export async function sendContactEmail(
  env: Env,
  message: ContactMessage,
  context: SendEmailContext,
): Promise<EmailResult> {
  const dryRun = isDryRun(env);

  const from = env.CONTACT_FROM?.trim();
  const to = env.CONTACT_TO?.trim();

  if (!from || !to) {
    throw ApiError.notConfigured(
      "El servicio de correo no está configurado. Faltan CONTACT_FROM o CONTACT_TO en wrangler.toml.",
    );
  }

  const payload = {
    from,
    to: [to],
    reply_to: message.email,
    subject: `Nuevo mensaje web · ${message.subject}`,
    html: buildHtml(message),
    text: buildText(message),
  };

  if (dryRun) {
    console.log(
      JSON.stringify({
        level: "info",
        msg: "email:dry-run",
        requestId: context.requestId,
        to,
        from,
        replyTo: message.email,
        preview: payload.text.slice(0, 240),
      }),
    );
    return { id: "dry-run", delivered: false, dryRun: true };
  }

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    throw ApiError.notConfigured(
      "Falta el secreto RESEND_API_KEY. Configúralo con: wrangler secret put RESEND_API_KEY",
    );
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Cabecera de idempotencia: evita correos duplicados si el usuario
        // hace doble clic o si hay un reintento de red.
        "Idempotency-Key": context.requestId,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const raw = await response.text();
    const body = safeJson(raw);

    if (!response.ok) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "resend:error",
          requestId: context.requestId,
          status: response.status,
          durationMs: Date.now() - startedAt,
          // `message` de Resend es seguro de loguear; la API Key jamás.
          providerMessage: (body as ResendFailure | null)?.message ?? raw.slice(0, 200),
        }),
      );

      throw ApiError.upstream(
        "No pudimos enviar tu mensaje en este momento. Intenta de nuevo en unos minutos.",
        { provider: "resend", status: response.status },
      );
    }

    const id = (body as ResendSuccess | null)?.id;
    console.log(
      JSON.stringify({
        level: "info",
        msg: "resend:sent",
        requestId: context.requestId,
        emailId: id ?? null,
        durationMs: Date.now() - startedAt,
      }),
    );

    return { id: typeof id === "string" ? id : "sent", delivered: true, dryRun: false };
  } catch (error) {
    if (error instanceof ApiError) throw error;

    const aborted = error instanceof Error && error.name === "AbortError";
    throw ApiError.upstream(
      aborted
        ? "El servicio de correo tardó demasiado. Intenta de nuevo."
        : "No pudimos conectar con el servicio de correo. Intenta de nuevo en unos minutos.",
      { provider: "resend" },
    );
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Interno
// ---------------------------------------------------------------------------

/** Modo simulado: solo en desarrollo, o si se pide explícitamente. */
function isDryRun(env: Env): boolean {
  if (env.RESEND_DRY_RUN === "true") return true;
  const isProduction = (env.ENVIRONMENT ?? "production") === "production";
  return !isProduction && !env.RESEND_API_KEY;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Plantilla HTML del correo (estilos inline: los clientes de correo no cargan CSS externo). */
function buildHtml(message: ContactMessage): string {
  const rows: Array<{ label: string; value: string; href?: string }> = [
    { label: "Nombre", value: message.name },
    { label: "Email", value: message.email, href: `mailto:${message.email}` },
    { label: "Título", value: message.subject },
  ];

  const rowsHtml = rows
    .map(
      (row) => `
        <tr>
          <td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;color:#334155;width:130px;">${escapeHtml(row.label)}</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#0f172a;">${
            row.href
              ? `<a href="${escapeHtml(row.href)}" style="color:#1d4ed8;">${escapeHtml(row.value)}</a>`
              : escapeHtml(row.value)
          }</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">
      <tr>
        <td style="padding:20px 24px;border-bottom:3px solid #1d4ed8;">
          <h1 style="margin:0;font-size:18px;color:#1e3a8a;">Nuevo mensaje desde la web</h1>
          <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Iglesia Jesús Agua Viva</p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 24px;">
          <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">${rowsHtml}</table>
          <h2 style="margin:20px 0 8px;font-size:14px;color:#334155;">Mensaje</h2>
          <div style="padding:14px 16px;background:#f8fafc;border-left:4px solid #1d4ed8;border-radius:6px;font-size:14px;line-height:1.6;color:#0f172a;">
            ${textToSafeHtml(message.message)}
          </div>
          <p style="margin:20px 0 0;font-size:12px;color:#64748b;">
            Responde a este correo y le llegará directamente a ${escapeHtml(message.email)}.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Versión texto plano (obligatoria para entregabilidad y accesibilidad). */
function buildText(message: ContactMessage): string {
  const lines = [
    "Nuevo mensaje desde la web - Iglesia Jesús Agua Viva",
    "",
    `Nombre:  ${message.name}`,
    `Email:   ${message.email}`,
    `Título:  ${message.subject}`,
  ];
  lines.push("", "Mensaje:", message.message);
  return lines.join("\n");
}
