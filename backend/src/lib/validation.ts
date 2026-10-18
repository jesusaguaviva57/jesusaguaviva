import { ApiError } from "./errors";
import { collapseWhitespace, truncate } from "./text";
import type { ContactMessage } from "../types";

/** Un campo inválido del formulario. */
export interface ValidationIssue {
  field: string;
  message: string;
}

export type ContactValidation =
  | { ok: true; value: ContactMessage; isSpam: boolean }
  | { ok: false; issues: ValidationIssue[] };

/** Límite de caracteres por campo (defensa contra payloads gigantes). */
const LIMITS = {
  nameMin: 2,
  nameMax: 80,
  emailMax: 160,
  messageMin: 10,
  messageMax: 4000,
  subjectMin: 3,
  subjectMax: 120,
} as const;

/**
 * Email pragmático: no intentamos implementar el RFC 5322 completo.
 * Validación de forma + el envío real de Resend es la validación definitiva.
 */
const EMAIL_REGEX = /^[^\s@<>()[\]\\,;:"]+@[^\s@.]+(\.[^\s@.]+)+$/;

function asRecord(payload: unknown): Record<string, unknown> | null {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value === "string") return value;
  return "";
}

/**
 * Valida el cuerpo de `POST /api/contact`.
 *
 * - Nunca confía en el tipo declarado por el cliente (`unknown`).
 * - `website` es un "honeypot": los bots lo rellenan, los humanos no lo ven.
 *   Si viene con contenido, se marca como spam y se responde un falso éxito
 *   para no dar pistas al bot.
 */
export function validateContactPayload(payload: unknown): ContactValidation {
  const body = asRecord(payload);
  if (!body) {
    return { ok: false, issues: [{ field: "body", message: "Se esperaba un objeto JSON." }] };
  }

  const honeypot = collapseWhitespace(readString(body, "website"));
  const name = collapseWhitespace(readString(body, "name"));
  const email = collapseWhitespace(readString(body, "email")).toLowerCase();
  const subject = collapseWhitespace(readString(body, "subject"));
  const message = readString(body, "message").replace(/\r\n/g, "\n").trim();

  const issues: ValidationIssue[] = [];

  if (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax) {
    issues.push({ field: "name", message: `El nombre debe tener entre ${LIMITS.nameMin} y ${LIMITS.nameMax} caracteres.` });
  }

  if (email.length === 0) {
    issues.push({ field: "email", message: "El email es obligatorio." });
  } else if (email.length > LIMITS.emailMax || !EMAIL_REGEX.test(email)) {
    issues.push({ field: "email", message: "Ingresa un email válido (ej. nombre@dominio.com)." });
  }

  if (message.length < LIMITS.messageMin) {
    issues.push({ field: "message", message: `El mensaje debe tener al menos ${LIMITS.messageMin} caracteres.` });
  } else if (message.length > LIMITS.messageMax) {
    issues.push({ field: "message", message: `El mensaje no puede superar ${LIMITS.messageMax} caracteres.` });
  }

  if (subject.length < LIMITS.subjectMin || subject.length > LIMITS.subjectMax) {
    issues.push({
      field: "subject",
      message: `El título debe tener entre ${LIMITS.subjectMin} y ${LIMITS.subjectMax} caracteres.`,
    });
  }

  if (issues.length > 0) return { ok: false, issues };

  // Se truncan por seguridad aunque ya se validó la longitud.
  return {
    ok: true,
    isSpam: honeypot.length > 0,
    value: {
      name: truncate(name, LIMITS.nameMax),
      email: truncate(email, LIMITS.emailMax),
      subject: truncate(subject, LIMITS.subjectMax),
      message: truncate(message, LIMITS.messageMax),
    },
  };
}

/** Lanza un 400 con la lista de campos inválidos (lo consume el frontend). */
export function assertValidContact(payload: unknown): { value: ContactMessage; isSpam: boolean } {
  const result = validateContactPayload(payload);
  if (!result.ok) {
    throw ApiError.validation("Revisa los datos del formulario.", { fields: result.issues });
  }
  return { value: result.value, isSpam: result.isSpam };
}
