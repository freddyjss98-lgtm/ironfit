// Solicitudes de renovación: el socio paga por transferencia, sube el
// comprobante y el admin aprueba (se crea la membresía + la venta) o rechaza.

import { todayInEcuador } from "@ironfit/shared/date";
import { notifyMembershipActivated } from "@/lib/reminders/notifyActivation";
import { formatSpanishDate } from "@/lib/reminders/expiry";
import { pushToAdmins, pushToMember } from "@/lib/push/expo";
import { nextMembershipStart } from "./memberships";
import type { ServiceCtx } from "./types";

// ── Socio: crear la solicitud ────────────────────────────────────────────────

export type CreateRenewalInput = {
  planId: string;
  amount: number;
  paymentMethod?: string | null;
  /** Ruta del comprobante dentro del bucket `payment-receipts`. */
  receiptPath: string | null;
  memberNote?: string | null;
};

export async function createRenewalRequest(
  { supabase, userId }: ServiceCtx,
  input: CreateRenewalInput
): Promise<{ id: string }> {
  if (!userId) throw new Error("No autenticado");

  const { data: member, error: mErr } = await supabase
    .from("members")
    .select("id, full_name")
    .eq("user_id", userId)
    .single();
  if (mErr || !member) throw new Error("Perfil de miembro no encontrado");

  // Una sola solicitud pendiente a la vez
  const { data: pending } = await supabase
    .from("renewal_requests")
    .select("id")
    .eq("member_id", member.id)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (pending) throw new Error("Ya tienes una solicitud en revisión.");

  if (!input.planId) throw new Error("Selecciona un plan");
  if (!input.receiptPath) throw new Error("Sube el comprobante de pago");

  const { data: created, error } = await supabase
    .from("renewal_requests")
    .insert({
      member_id: member.id,
      plan_id: input.planId,
      amount: Number.isFinite(input.amount) ? input.amount : 0,
      payment_method: input.paymentMethod || "transfer",
      receipt_url: input.receiptPath,
      member_note: input.memberNote || null,
    })
    .select("id, membership_plans(name)")
    .single();
  if (error || !created) throw new Error(error?.message ?? "No se pudo crear la solicitud");

  const plan = created.membership_plans as unknown as { name: string } | null;
  await pushToAdmins({
    title: "Renovación por aprobar",
    body: `${member.full_name} · ${plan?.name ?? "Plan"} · $${Number(input.amount || 0).toFixed(2)}`,
    data: { screen: "renewals", id: created.id },
  });

  return { id: created.id as string };
}

// ── Admin: aprobar / rechazar ────────────────────────────────────────────────

/** Aprueba la solicitud → renueva la membresía (membership + venta) y la marca aprobada. */
export async function approveRenewalRequest(
  { supabase, userId }: ServiceCtx,
  requestId: string
): Promise<{ membershipId: string; startDate: string; endDate: string }> {
  const { data: req, error: reqErr } = await supabase
    .from("renewal_requests")
    .select("id, member_id, plan_id, amount, payment_method, status")
    .eq("id", requestId)
    .single();
  if (reqErr || !req) throw new Error("Solicitud no encontrada");
  if (req.status !== "pending") throw new Error("La solicitud ya fue procesada");

  const { data: plan, error: planErr } = await supabase
    .from("membership_plans")
    .select("duration_days, name")
    .eq("id", req.plan_id)
    .single();
  if (planErr || !plan) throw new Error("Plan no encontrado");

  // Igual que el resto de altas: si tiene una membresía vigente, la nueva arranca
  // el día SIGUIENTE a su vencimiento; si no, hoy (fecha de Ecuador, no UTC).
  const startDate = await nextMembershipStart(supabase, req.member_id as string);
  const end = new Date(startDate + "T00:00:00");
  end.setDate(end.getDate() + plan.duration_days);
  const endDate = end.toISOString().split("T")[0];

  const { data: membership, error: mErr } = await supabase
    .from("memberships")
    .insert({
      member_id: req.member_id,
      plan_id: req.plan_id,
      start_date: startDate,
      end_date: endDate,
      paid_amount: req.amount,
      notes: "Renovación vía portal",
      created_by: userId,
    })
    .select("id")
    .single();
  if (mErr || !membership) throw new Error(mErr?.message ?? "Error al crear membresía");

  // La venta se registra HOY (día del pago), no en la fecha de inicio de la
  // membresía (que al renovar puede ser futura).
  const saleDate = todayInEcuador();
  const { data: sale } = await supabase
    .from("sales")
    .insert({
      member_id: req.member_id,
      sale_date: saleDate,
      total: req.amount,
      payment_method: req.payment_method,
      notes: `Renovación: ${plan.name}`,
      created_by: userId,
    })
    .select("id")
    .single();

  if (sale) {
    await supabase.from("sale_items").insert({
      sale_id: sale.id,
      item_type: "membership",
      membership_id: membership.id,
      description: `${plan.name} (${plan.duration_days} días) — Renovación`,
      quantity: 1,
      unit_price: req.amount,
    });
  }

  const { error: updErr } = await supabase
    .from("renewal_requests")
    .update({
      status: "approved",
      membership_id: membership.id,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (updErr) throw new Error(updErr.message);

  await notifyMembershipActivated(membership.id);
  await pushToMember(req.member_id as string, {
    title: "Renovación aprobada",
    body: `Tu plan ${plan.name} está activo hasta el ${formatSpanishDate(endDate)}. ¡A entrenar!`,
    data: { screen: "membership" },
  });

  return { membershipId: membership.id as string, startDate, endDate };
}

export async function rejectRenewalRequest(
  { supabase, userId }: ServiceCtx,
  requestId: string,
  reason: string | null
) {
  const { data: rejected, error } = await supabase
    .from("renewal_requests")
    .update({
      status: "rejected",
      admin_note: reason || null,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("member_id");
  if (error) throw new Error(error.message);

  const memberId = rejected?.[0]?.member_id as string | undefined;
  if (memberId) {
    await pushToMember(memberId, {
      title: "Renovación rechazada",
      body: reason ? `Motivo: ${reason}` : "Revisa tu solicitud en la app.",
      data: { screen: "renew" },
    });
  }
}
