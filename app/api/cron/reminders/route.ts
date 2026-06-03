// =============================================================================
// Cron: recordatorios automáticos por WhatsApp
// =============================================================================
// Ejecutado a diario por Vercel Cron (ver vercel.json). Por ahora solo procesa
// el recordatorio de VENCIMIENTO de membresía. Se puede disparar manualmente:
//
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//        https://<dominio>/api/cron/reminders
//
// Mientras no existan credenciales de Meta, corre en modo "dry_run": registra
// en reminder_log lo que habría enviado, sin mandar nada real.
// =============================================================================

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhatsappMode, sendWhatsapp } from "@/lib/whatsapp/send";
import {
  REMINDER_TYPE_EXPIRY,
  EXPIRY_REMINDER_DAYS,
  buildExpiryMessage,
  buildExpiryTemplate,
  type ExpiryCandidate,
} from "@/lib/reminders/expiry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Sin secreto configurado → solo permitir fuera de producción (desarrollo).
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const mode = getWhatsappMode();

  // ── 1. Candidatos: membresía activa que vence en 0..N días ────────────────
  const { data: rows, error } = await supabase
    .from("vw_members_with_active_membership")
    .select(
      "id, full_name, phone, current_plan_name, current_end_date, days_until_expiry, membership_status, status"
    )
    .eq("status", "active")
    .eq("membership_status", "active")
    .gte("days_until_expiry", 0)
    .lte("days_until_expiry", EXPIRY_REMINDER_DAYS);

  if (error) {
    return Response.json(
      { error: `Error al consultar candidatos: ${error.message}` },
      { status: 500 }
    );
  }

  const candidates: ExpiryCandidate[] = (rows ?? [])
    .filter((r) => !!r.current_end_date && !!r.phone && r.days_until_expiry !== null)
    .map((r) => ({
      id: r.id,
      full_name: r.full_name,
      phone: r.phone,
      current_plan_name: r.current_plan_name,
      current_end_date: r.current_end_date,
      days_until_expiry: r.days_until_expiry,
    }));

  // ── 2. Excluir a quienes ya se les avisó este período (idempotencia) ──────
  const memberIds = candidates.map((c) => c.id);
  const alreadySent = new Set<string>();

  if (memberIds.length > 0) {
    const { data: logs } = await supabase
      .from("reminder_log")
      .select("member_id, reference_date")
      .eq("reminder_type", REMINDER_TYPE_EXPIRY)
      .neq("status", "failed")
      .in("member_id", memberIds);

    for (const l of logs ?? []) {
      alreadySent.add(`${l.member_id}|${l.reference_date}`);
    }
  }

  const pending = candidates.filter(
    (c) => !alreadySent.has(`${c.id}|${c.current_end_date}`)
  );

  // ── 3. Enviar (o simular) y registrar ──────────────────────────────────────
  let sent = 0;
  let failed = 0;
  const results: { member: string; ok: boolean; error?: string }[] = [];

  for (const c of pending) {
    const message = buildExpiryMessage(c);
    const result = await sendWhatsapp({
      to: c.phone,
      previewText: message,
      template: buildExpiryTemplate(c),
    });

    await supabase.from("reminder_log").insert({
      member_id: c.id,
      reminder_type: REMINDER_TYPE_EXPIRY,
      reference_date: c.current_end_date,
      channel: "whatsapp",
      provider: result.provider,
      status: result.ok ? (mode === "dry_run" ? "dry_run" : "sent") : "failed",
      provider_message_id: result.providerMessageId ?? null,
      to_phone: c.phone,
      message,
      error: result.error ?? null,
    });

    if (result.ok) sent++;
    else failed++;
    results.push({ member: c.full_name, ok: result.ok, error: result.error });
  }

  return Response.json({
    ok: true,
    mode,
    candidates: candidates.length,
    skipped: candidates.length - pending.length,
    sent,
    failed,
    results,
  });
}
