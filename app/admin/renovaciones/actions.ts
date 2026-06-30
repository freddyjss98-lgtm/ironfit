"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { todayInEcuador } from "@/lib/date";

// Aprueba la solicitud → renueva la membresía (membership + venta) y la marca aprobada.
export async function approveRenewalRequest(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // Renovar: si tiene membresía vigente, extiende desde su fin; si no, desde hoy.
  const { data: current } = await supabase
    .from("memberships")
    .select("end_date")
    .eq("member_id", req.member_id)
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const base =
    current && new Date(current.end_date) > new Date() ? new Date(current.end_date) : new Date();
  const startDate = base.toISOString().split("T")[0];
  const end = new Date(base);
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
      created_by: user?.id,
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
      created_by: user?.id,
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
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (updErr) throw new Error(updErr.message);

  revalidatePath("/admin/renovaciones");
  revalidatePath("/admin/membresias");
  revalidatePath("/admin");
}

export async function rejectRenewalRequest(requestId: string, reason: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("renewal_requests")
    .update({
      status: "rejected",
      admin_note: reason || null,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  revalidatePath("/admin/renovaciones");
}

export async function updateGymSettings(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("gym_settings")
    .update({
      bank_name: (formData.get("bank_name") as string) || null,
      account_type: (formData.get("account_type") as string) || null,
      account_number: (formData.get("account_number") as string) || null,
      account_holder: (formData.get("account_holder") as string) || null,
      account_doc: (formData.get("account_doc") as string) || null,
      payment_note: (formData.get("payment_note") as string) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/renovaciones");
  revalidatePath("/portal/renovar");
}
