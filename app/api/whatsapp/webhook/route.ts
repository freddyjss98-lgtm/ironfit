// =============================================================================
// Webhook de WhatsApp Cloud API — bot conversacional para socios
// =============================================================================
// GET  → handshake de verificación de Meta (al configurar el webhook).
// POST → mensajes entrantes de los socios. Valida la firma de Meta, extrae los
//        mensajes y los procesa (responde por menú). Ver lib/whatsapp/bot/.
//
// Requisitos en Meta para recibir mensajes REALES:
//   • App PUBLICADA (no en modo desarrollo).
//   • WABA suscrita al campo "messages".
//   • Callback URL = https://<dominio>/api/whatsapp/webhook
//   • Verify token = WHATSAPP_VERIFY_TOKEN
//   • App secret   = WHATSAPP_APP_SECRET (para validar la firma)
// =============================================================================

import { NextRequest } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { processInboundMessage, type InboundMessage } from "@/lib/whatsapp/bot/handle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── GET: verificación del webhook ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response("Forbidden", { status: 403 });
}

// ── POST: mensajes entrantes ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (!verifySignature(req, raw)) {
    return Response.json({ error: "Firma inválida" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const messages = extractMessages(payload);

  // Sin mensajes (ej. recibos de entrega/lectura) → 200 y listo.
  if (messages.length === 0) {
    return Response.json({ ok: true, processed: 0 });
  }

  const supabase = createAdminClient();
  let processed = 0;

  for (const msg of messages) {
    try {
      const res = await processInboundMessage(supabase, msg);
      if (res.handled) processed++;
    } catch (err) {
      // No tumbamos el resto del lote por un mensaje con error.
      console.error("[whatsapp:webhook] error procesando mensaje", err);
    }
  }

  return Response.json({ ok: true, processed });
}

/**
 * Valida que el POST venga realmente de Meta usando HMAC-SHA256 del cuerpo con
 * el App Secret. Si WHATSAPP_APP_SECRET no está configurado, se omite (solo
 * conviene en pruebas locales; en producción SIEMPRE debe estar).
 */
function verifySignature(req: NextRequest, raw: string): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.warn(
      "[whatsapp:webhook] WHATSAPP_APP_SECRET no configurado — firma NO validada"
    );
    return true;
  }

  const header = req.headers.get("x-hub-signature-256");
  if (!header || !header.startsWith("sha256=")) return false;

  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(raw, "utf8")
    .digest("hex");

  const received = header.slice("sha256=".length);

  // Comparación en tiempo constante (evita timing attacks).
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Aplana el payload de Meta a una lista de mensajes entrantes simples. */
function extractMessages(payload: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return out;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const value = (change as { value?: { messages?: unknown[] } })?.value;
      const msgs = value?.messages;
      if (!Array.isArray(msgs)) continue;

      for (const m of msgs) {
        const msg = m as {
          from?: string;
          id?: string;
          type?: string;
          text?: { body?: string };
          interactive?: {
            button_reply?: { id?: string; title?: string };
            list_reply?: { id?: string; title?: string };
          };
        };

        out.push({
          from: msg.from ?? "",
          waMessageId: msg.id ?? "",
          type: msg.type ?? "unknown",
          body: extractBody(msg),
        });
      }
    }
  }

  return out;
}

function extractBody(msg: {
  type?: string;
  text?: { body?: string };
  interactive?: {
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string };
  };
}): string {
  if (msg.type === "text") return msg.text?.body ?? "";
  if (msg.type === "interactive") {
    const i = msg.interactive;
    return (
      i?.button_reply?.title ??
      i?.button_reply?.id ??
      i?.list_reply?.title ??
      i?.list_reply?.id ??
      ""
    );
  }
  return "";
}
