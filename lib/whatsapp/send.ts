// =============================================================================
// Adaptador de envío de WhatsApp
// =============================================================================
// Dos modos, seleccionados automáticamente según las variables de entorno:
//
//   • "dry_run" (por defecto): NO envía nada. Devuelve éxito simulado para que
//     el cron registre en reminder_log lo que *habría* enviado. Ideal para
//     probar toda la mecánica antes de tener la cuenta de Meta lista.
//
//   • "meta": envía de verdad usando la WhatsApp Cloud API (Meta) mediante un
//     mensaje de PLANTILLA (requerido para mensajes proactivos fuera de la
//     ventana de 24h). Se activa solo cuando existen WHATSAPP_TOKEN,
//     WHATSAPP_PHONE_ID y el nombre de plantilla correspondiente.
// =============================================================================

const GRAPH_VERSION = "v21.0";

export type WhatsappMode = "dry_run" | "meta";

export type SendResult = {
  ok: boolean;
  mode: WhatsappMode;
  provider: WhatsappMode;
  providerMessageId?: string;
  error?: string;
};

/** Normaliza un teléfono a formato internacional Ecuador sin '+' (ej: 593999123456). */
export function normalizePhoneEC(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("593")) return digits;
  if (digits.startsWith("0")) return "593" + digits.slice(1);
  return "593" + digits;
}

export function getWhatsappMode(): WhatsappMode {
  return process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID
    ? "meta"
    : "dry_run";
}

export type TemplateMessage = {
  /** Nombre de la plantilla aprobada en Meta. */
  templateName: string;
  /** Código de idioma de la plantilla (ej: "es", "es_MX"). */
  languageCode?: string;
  /** Parámetros del cuerpo de la plantilla, en orden ({{1}}, {{2}}, ...). */
  bodyParams: string[];
};

/**
 * POST genérico a la Cloud API de Meta. Centraliza el manejo de token, URL,
 * errores y red para que tanto plantillas como texto libre lo reutilicen.
 * Solo se llama en modo "meta" (con credenciales presentes).
 */
async function postGraphMessage(
  payload: Record<string, unknown>
): Promise<SendResult> {
  const phoneId = process.env.WHATSAPP_PHONE_ID!;
  const token = process.env.WHATSAPP_TOKEN!;
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message =
        json?.error?.message ?? `HTTP ${res.status} al enviar WhatsApp`;
      return { ok: false, mode: "meta", provider: "meta", error: message };
    }

    return {
      ok: true,
      mode: "meta",
      provider: "meta",
      providerMessageId: json?.messages?.[0]?.id,
    };
  } catch (err) {
    return {
      ok: false,
      mode: "meta",
      provider: "meta",
      error: err instanceof Error ? err.message : "Error de red",
    };
  }
}

/**
 * Envía un mensaje de TEXTO libre (no plantilla).
 *
 * Solo válido dentro de la ventana de servicio de 24h (cuando el socio escribió
 * primero). El bot conversacional siempre responde a un mensaje entrante, así
 * que la ventana está abierta. Fuera de esa ventana, Meta exige plantilla.
 */
export async function sendWhatsappText(params: {
  to: string;
  body: string;
}): Promise<SendResult> {
  const mode = getWhatsappMode();
  const to = normalizePhoneEC(params.to);

  if (!to) {
    return { ok: false, mode, provider: mode, error: "Teléfono inválido" };
  }

  if (mode === "dry_run") {
    console.log(
      `[whatsapp:dry_run:text] → ${to}: ${params.body.replace(/\n/g, " ⏎ ")}`
    );
    return { ok: true, mode, provider: "dry_run" };
  }

  return postGraphMessage({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { preview_url: false, body: params.body },
  });
}

/**
 * Envía un recordatorio por WhatsApp.
 *
 * @param to            Teléfono del destinatario (cualquier formato; se normaliza).
 * @param previewText   Texto legible del mensaje (para registro/depuración).
 * @param template      Datos de la plantilla a usar en modo "meta".
 */
export async function sendWhatsapp(params: {
  to: string;
  previewText: string;
  template: TemplateMessage;
}): Promise<SendResult> {
  const mode = getWhatsappMode();
  const to = normalizePhoneEC(params.to);

  if (!to) {
    return { ok: false, mode, provider: mode, error: "Teléfono inválido" };
  }

  // ── Modo simulado ──────────────────────────────────────────────────────────
  if (mode === "dry_run") {
    console.log(
      `[whatsapp:dry_run] → ${to}: ${params.previewText.replace(/\n/g, " ⏎ ")}`
    );
    return { ok: true, mode, provider: "dry_run" };
  }

  // ── Modo real (Meta Cloud API) ───────────────────────────────────────────────
  return postGraphMessage({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: params.template.templateName,
      language: { code: params.template.languageCode ?? "es" },
      components: [
        {
          type: "body",
          parameters: params.template.bodyParams.map((text) => ({
            type: "text",
            text,
          })),
        },
      ],
    },
  });
}
