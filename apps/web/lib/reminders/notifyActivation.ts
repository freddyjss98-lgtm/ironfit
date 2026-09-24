// =============================================================================
// Aviso INSTANTÁNEO de activación de membresía
// =============================================================================
// Se llama desde las Server Actions que crean/cambian una membresía (alta,
// renovación, cambio de plan, editar fechas, ajustar días, reanudar), tanto en
// /admin/membresias como en la ficha del socio, ventas y renovaciones.
//
// Manda `membership_activated_` al socio + copia al admin EN EL MOMENTO, sin
// esperar al cron de las 9am. Es best-effort: NUNCA lanza (no debe romper el
// registro de la membresía) y registra en reminder_log con reference_date =
// end_date, la misma llave que usa el cron → no se duplica.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhatsappMode, sendWhatsapp, type SendResult } from "@/lib/whatsapp/send";
import { formatSpanishDate, planLabel } from "@/lib/reminders/expiry";
import {
  buildAdminCopyTemplate,
  ADMIN_PHONE,
  REMINDER_TYPE_ACTIVATED,
  REMINDER_TYPE_ADMIN_COPY,
  type ReminderCandidate,
} from "@/lib/reminders/processors";

const LANG = process.env.WHATSAPP_TEMPLATE_LANG ?? "es";
const ACTIVATED_TEMPLATE =
  process.env.WHATSAPP_TEMPLATE_ACTIVATED ?? "membership_activated_";

function firstName(full: string): string {
  return (full ?? "").trim().split(/\s+/)[0] || full;
}

function one<T>(x: T | T[] | null | undefined): T | null {
  if (Array.isArray(x)) return x[0] ?? null;
  return x ?? null;
}

type MembershipRow = {
  member_id: string;
  end_date: string;
  status: string;
  members: { full_name: string; phone: string } | { full_name: string; phone: string }[] | null;
  membership_plans: { name: string } | { name: string }[] | null;
};

async function logReminder(
  supabase: SupabaseClient,
  row: {
    member_id: string;
    reminder_type: string;
    reference_date: string;
    to_phone: string;
    message: string;
    result: SendResult;
    mode: "dry_run" | "meta";
  }
) {
  // Best-effort: si el índice único choca (p.ej. admin_copy), lo ignoramos.
  await supabase.from("reminder_log").insert({
    member_id: row.member_id,
    reminder_type: row.reminder_type,
    reference_date: row.reference_date,
    channel: "whatsapp",
    provider: row.result.provider,
    status: row.result.ok
      ? row.mode === "dry_run"
        ? "dry_run"
        : "sent"
      : "failed",
    provider_message_id: row.result.providerMessageId ?? null,
    to_phone: row.to_phone,
    message: row.message,
    error: row.result.error ?? null,
  });
}

/**
 * Notifica al socio (y al admin) que su membresía quedó activa/renovada.
 * @param membershipId  La membresía recién creada o modificada.
 */
export async function notifyMembershipActivated(membershipId: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    const mode = getWhatsappMode();

    const { data } = await supabase
      .from("memberships")
      .select(
        "member_id, end_date, status, members(full_name, phone), membership_plans(name)"
      )
      .eq("id", membershipId)
      .maybeSingle();

    const mb = data as unknown as MembershipRow | null;
    if (!mb || mb.status !== "active") return;

    const mem = one(mb.members);
    const plan = one(mb.membership_plans);
    if (!mem?.phone || !mb.end_date) return;

    const fn = firstName(mem.full_name);
    const planName = planLabel(plan?.name);
    const fecha = formatSpanishDate(mb.end_date);
    const ref = mb.end_date;

    // Idempotencia: no reenviar si ya se avisó por esta fecha (instantáneo o cron).
    const { data: already } = await supabase
      .from("reminder_log")
      .select("id")
      .eq("member_id", mb.member_id)
      .eq("reminder_type", REMINDER_TYPE_ACTIVATED)
      .eq("reference_date", ref)
      .neq("status", "failed")
      .maybeSingle();
    if (already) return;

    const candidate: ReminderCandidate = {
      memberId: mb.member_id,
      memberName: mem.full_name,
      phone: mem.phone,
      referenceDate: ref,
      previewText:
        `¡Gracias por tu membresía, ${fn}! 🎉 Tu plan *${planName}* en Iron ` +
        `Fit Club quedó activo hasta el *${fecha}*. ¡A entrenar con todo! 💪🔥`,
      template: {
        templateName: ACTIVATED_TEMPLATE,
        languageCode: LANG,
        bodyParams: [fn, planName, fecha],
      },
    };

    // 1) Aviso al socio
    const result = await sendWhatsapp({
      to: candidate.phone,
      previewText: candidate.previewText,
      template: candidate.template,
    });
    await logReminder(supabase, {
      member_id: candidate.memberId,
      reminder_type: REMINDER_TYPE_ACTIVATED,
      reference_date: ref,
      to_phone: candidate.phone,
      message: candidate.previewText,
      result,
      mode,
    });

    // Si el envío al socio falló, el cron de las 9am lo reintenta.
    if (!result.ok) return;

    // 2) Copia al admin
    const copy = await sendWhatsapp({
      to: ADMIN_PHONE,
      previewText: `📋 Copia (${candidate.memberName ?? candidate.phone}): ${candidate.previewText}`,
      template: buildAdminCopyTemplate(candidate),
    });
    await logReminder(supabase, {
      member_id: candidate.memberId,
      reminder_type: REMINDER_TYPE_ADMIN_COPY,
      reference_date: ref,
      to_phone: ADMIN_PHONE,
      message: candidate.previewText,
      result: copy,
      mode,
    });
  } catch (err) {
    console.error("[notifyMembershipActivated] error", err);
  }
}
