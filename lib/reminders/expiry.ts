// =============================================================================
// Recordatorio: vencimiento de membresía
// =============================================================================
// Lógica pura (sin I/O) para decidir el mensaje del recordatorio de
// vencimiento. La consulta de candidatos y el envío se orquestan en el cron
// (app/api/cron/reminders/route.ts).
// =============================================================================

import type { TemplateMessage } from "@/lib/whatsapp/send";

export const REMINDER_TYPE_EXPIRY = "membership_expiry";

/**
 * Ventana de aviso: se notifica cuando faltan 0..N días para vencer.
 *
 * Se dispara UNA sola vez por período de membresía (idempotencia por
 * member_id + fecha de vencimiento en reminder_log). Con la ventana en 7, el
 * socio recibe el aviso al entrar al rango — es decir, ~7 días antes de vencer —
 * y no se repite día a día. Si un socio ya está más cerca del vencimiento (ej.
 * se registró tarde), igual recibe UN aviso la primera vez que se le procesa.
 */
export const EXPIRY_REMINDER_DAYS = 7;

/**
 * Nombre de la plantilla de Meta para el aviso de vencimiento.
 *
 * Fijo a propósito: ya NO se lee WHATSAPP_TEMPLATE_EXPIRY.
 *
 * Esa variable en Vercel quedó con un valor que no existe en Meta y provocó 653
 * fallos seguidos con "(#132001) Template name does not exist in the
 * translation" — desde el 3 de julio hasta el 25 de agosto de 2026 ningún socio
 * recibió su aviso de vencimiento. El diagnóstico de julio culpó al idioma y se
 * corrigió eso (da0cad8), pero el idioma nunca fue el problema: los demás avisos
 * usan la MISMA variable de idioma y salen bien.
 *
 * Verificado el 2026-08-26 contra la Graph API de Meta (WABA 1639423534018428):
 * `membership_expiry` · es · APPROVED · UTILITY · 3 variables, cuerpo
 * "Hola {{1}}, tu membresía {{2}} en Iron Fit Club vence el {{3}}...", que calza
 * exacto con buildExpiryTemplate.
 *
 * Si algún día hay que renombrarla en Meta, se cambia aquí — no por env.
 */
export function expiryTemplateName(): string {
  return "membership_expiry";
}

export type ExpiryCandidate = {
  id: string;
  full_name: string;
  phone: string;
  current_plan_name: string | null;
  current_end_date: string; // 'YYYY-MM-DD'
  days_until_expiry: number;
};

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Formatea 'YYYY-MM-DD' como '29 de mayo de 2026'. */
export function formatSpanishDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return ymd;
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/**
 * Nombre de plan listo para meter en un mensaje.
 *
 * El .trim() no es cosmético: los mensajes envuelven el plan en asteriscos
 * (*{{2}}*) y WhatsApp no cierra la negrita si hay un espacio antes del
 * asterisco. Con el plan "Iron " el socio recibía
 *   "Tu plan *Iron * en Iron Fit Club quedó activo hasta el *3 de octubre*"
 * con la negrita corrida hasta la fecha. Se limpió el dato y se limpia también
 * aquí, porque el nombre puede volver a llegar sucio desde cualquier lado.
 */
export function planLabel(name: string | null | undefined): string {
  return name?.trim() || "actual";
}

/** Texto legible del recordatorio (para registro y para modo dry-run). */
export function buildExpiryMessage(c: ExpiryCandidate): string {
  const plan = c.current_plan_name ? ` *${planLabel(c.current_plan_name)}*` : "";
  const fecha = formatSpanishDate(c.current_end_date);
  return (
    `Hola ${firstName(c.full_name)}! 👋 Tu membresía${plan} en Iron Fit Club ` +
    `vence el *${fecha}*. Te invitamos a renovar para continuar entrenando ` +
    `sin interrupción. 💪🔥`
  );
}

/**
 * Parámetros para la plantilla de Meta. El cuerpo de la plantilla aprobada
 * debe usar estas variables en este orden:
 *   {{1}} = nombre, {{2}} = plan, {{3}} = fecha de vencimiento.
 *
 * Ejemplo de cuerpo de plantilla a registrar en Meta:
 *   "Hola {{1}}! Tu membresía {{2}} en Iron Fit Club vence el {{3}}.
 *    Te invitamos a renovar para seguir entrenando sin interrupción."
 */
export function buildExpiryTemplate(c: ExpiryCandidate): TemplateMessage {
  return {
    templateName: expiryTemplateName(),
    // Usa WHATSAPP_TEMPLATE_LANG (la que usan los demás avisos y sí funciona).
    // Antes usaba WHATSAPP_TEMPLATE_EXPIRY_LANG, mal configurada en Vercel
    // (p.ej. "es_ES"), lo que causaba (#132001) does not exist in the translation.
    languageCode: process.env.WHATSAPP_TEMPLATE_LANG ?? "es",
    bodyParams: [
      firstName(c.full_name),
      planLabel(c.current_plan_name),
      formatSpanishDate(c.current_end_date),
    ],
  };
}
