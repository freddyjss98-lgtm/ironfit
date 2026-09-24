// =============================================================================
// Cron: recordatorios automáticos por WhatsApp
// =============================================================================
// Ejecutado a diario por Vercel Cron (ver vercel.json). Itera sobre todos los
// procesadores (lib/reminders/processors.ts): vencimiento próximo, membresía
// vencida, bienvenida, reenganche, cumpleaños y recordatorio de clase.
// Se puede disparar manualmente:
//
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//        https://<dominio>/api/cron/reminders
//
// Sin credenciales de Meta corre en "dry_run": registra en reminder_log lo que
// habría enviado, sin mandar nada real. La idempotencia (por tipo + member +
// reference_date, ignorando 'failed') evita duplicados y reintenta los fallidos.
// =============================================================================

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhatsappMode, sendWhatsapp } from "@/lib/whatsapp/send";
import {
  reminderProcessors,
  buildAdminCopyTemplate,
  ADMIN_PHONE,
  REMINDER_TYPE_ADMIN_COPY,
  type ReminderCandidate,
} from "@/lib/reminders/processors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Sin secreto configurado → solo permitir fuera de producción (desarrollo).
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

type TypeSummary = {
  candidates: number;
  skipped: number;
  sent: number;
  failed: number;
};

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const mode = getWhatsappMode();
  const summary: Record<string, TypeSummary> = {};
  let totalSent = 0;
  let totalFailed = 0;
  let totalAdminCopies = 0;

  for (const processor of reminderProcessors) {
    // ── 1. Candidatos del tipo ────────────────────────────────────────────
    let candidates: ReminderCandidate[] = [];
    try {
      candidates = await processor.fetchCandidates(supabase);
    } catch (err) {
      summary[processor.type] = {
        candidates: 0,
        skipped: 0,
        sent: 0,
        failed: 0,
      };
      console.error(`[reminders] ${processor.type} fetch error`, err);
      continue;
    }

    // ── 2. Idempotencia: excluir a quienes ya se les avisó (no fallidos) ────
    const memberIds = candidates.map((c) => c.memberId);
    const alreadySent = new Set<string>();
    if (memberIds.length > 0) {
      const { data: logs } = await supabase
        .from("reminder_log")
        .select("member_id, reference_date")
        .eq("reminder_type", processor.type)
        .neq("status", "failed")
        .in("member_id", memberIds);
      for (const l of logs ?? []) {
        alreadySent.add(`${l.member_id}|${l.reference_date}`);
      }
    }

    const pending = candidates.filter(
      (c) => !alreadySent.has(`${c.memberId}|${c.referenceDate}`)
    );

    // ── 3. Enviar (o simular) y registrar ──────────────────────────────────
    let sent = 0;
    let failed = 0;
    for (const c of pending) {
      const result = await sendWhatsapp({
        to: c.phone,
        previewText: c.previewText,
        template: c.template,
      });

      await supabase.from("reminder_log").insert({
        member_id: c.memberId,
        reminder_type: processor.type,
        reference_date: c.referenceDate,
        channel: "whatsapp",
        provider: result.provider,
        status: result.ok
          ? mode === "dry_run"
            ? "dry_run"
            : "sent"
          : "failed",
        provider_message_id: result.providerMessageId ?? null,
        to_phone: c.phone,
        message: c.previewText,
        error: result.error ?? null,
      });

      if (!result.ok) {
        failed++;
        continue;
      }
      sent++;

      // ── Copia al admin, en el mismo momento que se envió al socio ─────────
      const copy = await sendWhatsapp({
        to: ADMIN_PHONE,
        previewText: `📋 Copia (${c.memberName ?? c.phone}): ${c.previewText}`,
        template: buildAdminCopyTemplate(c),
      });
      await supabase.from("reminder_log").insert({
        member_id: c.memberId,
        reminder_type: REMINDER_TYPE_ADMIN_COPY,
        reference_date: c.referenceDate,
        channel: "whatsapp",
        provider: copy.provider,
        status: copy.ok
          ? mode === "dry_run"
            ? "dry_run"
            : "sent"
          : "failed",
        provider_message_id: copy.providerMessageId ?? null,
        to_phone: ADMIN_PHONE,
        message: c.previewText,
        error: copy.error ?? null,
      });
      if (copy.ok) totalAdminCopies++;
    }

    summary[processor.type] = {
      candidates: candidates.length,
      skipped: candidates.length - pending.length,
      sent,
      failed,
    };
    totalSent += sent;
    totalFailed += failed;
  }

  return Response.json({
    ok: true,
    mode,
    totalSent,
    totalFailed,
    totalAdminCopies,
    summary,
  });
}
