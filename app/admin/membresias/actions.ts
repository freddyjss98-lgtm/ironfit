"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Devuelve la membresía activa (vigente) del socio, si la tiene. Una membresía
// cuenta como activa si status='active' y su fecha de fin no ha pasado.
export async function getActiveMembership(memberId: string) {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("memberships")
    .select("id, plan_id, start_date, end_date, paid_amount, membership_plans(name, color)")
    .eq("member_id", memberId)
    .eq("status", "active")
    .gte("end_date", today)
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const plan = data.membership_plans as unknown as { name: string; color: string } | null;
  return {
    id: data.id as string,
    plan_id: data.plan_id as string,
    start_date: data.start_date as string,
    end_date: data.end_date as string,
    paid_amount: Number(data.paid_amount),
    plan_name: plan?.name ?? "—",
    plan_color: plan?.color ?? "#999",
  };
}

export async function createMembership(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const memberId = formData.get("member_id") as string;
  const planId = formData.get("plan_id") as string;
  const startDate = formData.get("start_date") as string;
  const paidAmount = parseFloat(formData.get("paid_amount") as string);
  const paymentMethod = formData.get("payment_method") as string;
  const bankReference = (formData.get("bank_reference") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  // Backstop: un socio no puede tener dos membresías activas a la vez.
  const existingActive = await getActiveMembership(memberId);
  if (existingActive) {
    throw new Error(
      `Este socio ya tiene una membresía activa (${existingActive.plan_name}, vence ${existingActive.end_date}). Gestiónala desde su ficha para agregar días, cambiar de plan o cancelarla.`
    );
  }

  // Get plan duration to calculate end_date
  const { data: plan, error: planError } = await supabase
    .from("membership_plans")
    .select("duration_days, price, name")
    .eq("id", planId)
    .single();

  if (planError || !plan) throw new Error("Plan no encontrado");

  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + plan.duration_days);
  const endDate = end.toISOString().split("T")[0];

  // Create membership
  const { data: membership, error: mError } = await supabase
    .from("memberships")
    .insert({
      member_id: memberId,
      plan_id: planId,
      start_date: startDate,
      end_date: endDate,
      paid_amount: paidAmount,
      notes,
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (mError || !membership) throw new Error(mError?.message ?? "Error al crear membresía");

  // La venta se registra HOY (día del pago), no en la fecha de inicio de la membresía.
  const saleDate = new Date().toISOString().split("T")[0];

  // Create sale record linked to this membership
  const { data: sale, error: sError } = await supabase
    .from("sales")
    .insert({
      member_id: memberId,
      sale_date: saleDate,
      total: paidAmount,
      payment_method: paymentMethod,
      bank_reference: bankReference,
      notes: `Membresía: ${plan.name}`,
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (sError || !sale) throw new Error(sError?.message ?? "Error al registrar venta");

  // Create sale item
  await supabase.from("sale_items").insert({
    sale_id: sale.id,
    item_type: "membership",
    membership_id: membership.id,
    description: `${plan.name} (${plan.duration_days} días)`,
    quantity: 1,
    unit_price: paidAmount,
  });

  revalidatePath("/admin/membresias");
  revalidatePath("/admin/ventas");
  revalidatePath("/admin");
}

export async function renewMembership(membershipId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get current membership + plan
  const { data: current, error } = await supabase
    .from("memberships")
    .select("member_id, plan_id, end_date, paid_amount, membership_plans(duration_days, name, price)")
    .eq("id", membershipId)
    .single();

  if (error || !current) throw new Error("Membresía no encontrada");

  const plan = current.membership_plans as unknown as { duration_days: number; name: string; price: number };
  const baseDate = new Date(current.end_date) > new Date()
    ? new Date(current.end_date)
    : new Date();
  const newStart = baseDate.toISOString().split("T")[0];
  const newEnd = new Date(baseDate.setDate(baseDate.getDate() + plan.duration_days))
    .toISOString()
    .split("T")[0];

  const { data: membership, error: mError } = await supabase
    .from("memberships")
    .insert({
      member_id: current.member_id,
      plan_id: current.plan_id,
      start_date: newStart,
      end_date: newEnd,
      paid_amount: plan.price,
      notes: `Renovación automática`,
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (mError || !membership) throw new Error(mError?.message ?? "Error al renovar");

  // Sale record — la venta se registra HOY (día del pago), no en la fecha de
  // inicio de la nueva membresía (que al renovar puede ser futura).
  const saleDate = new Date().toISOString().split("T")[0];
  const { data: sale } = await supabase
    .from("sales")
    .insert({
      member_id: current.member_id,
      sale_date: saleDate,
      total: plan.price,
      payment_method: "transfer",
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
      unit_price: plan.price,
    });
  }

  revalidatePath("/admin/membresias");
  revalidatePath("/admin/ventas");
  revalidatePath("/admin");
}

// ── Congelar / reanudar (pausa por viaje, lesión, etc.) ────────────────────────

export async function freezeMembership(membershipId: string) {
  const supabase = await createClient();

  const { data: current, error: readError } = await supabase
    .from("memberships")
    .select("status")
    .eq("id", membershipId)
    .single();

  if (readError || !current) throw new Error("Membresía no encontrada");
  if (current.status !== "active") {
    throw new Error("Solo se puede congelar una membresía activa");
  }

  const today = new Date().toISOString().split("T")[0];
  const { error } = await supabase
    .from("memberships")
    .update({ status: "frozen", frozen_at: today })
    .eq("id", membershipId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/membresias");
  revalidatePath("/admin/miembros");
  revalidatePath("/admin");
}

export async function resumeMembership(membershipId: string) {
  const supabase = await createClient();

  const { data: current, error: readError } = await supabase
    .from("memberships")
    .select("status, end_date, frozen_at, frozen_days")
    .eq("id", membershipId)
    .single();

  if (readError || !current) throw new Error("Membresía no encontrada");
  if (current.status !== "frozen" || !current.frozen_at) {
    throw new Error("La membresía no está congelada");
  }

  // Días que estuvo en pausa → se devuelven extendiendo la fecha de fin.
  const frozenSince = new Date(current.frozen_at + "T00:00:00");
  const daysFrozen = Math.max(
    0,
    Math.round((Date.now() - frozenSince.getTime()) / 86_400_000)
  );

  const newEnd = new Date(current.end_date + "T00:00:00");
  newEnd.setDate(newEnd.getDate() + daysFrozen);

  const { error } = await supabase
    .from("memberships")
    .update({
      status: "active",
      frozen_at: null,
      frozen_days: (current.frozen_days ?? 0) + daysFrozen,
      end_date: newEnd.toISOString().split("T")[0],
    })
    .eq("id", membershipId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/membresias");
  revalidatePath("/admin/miembros");
  revalidatePath("/admin");
}

export async function cancelMembership(membershipId: string, reason?: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("memberships")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason?.trim() || null,
    })
    .eq("id", membershipId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/membresias");
  revalidatePath("/admin/miembros");
  revalidatePath("/admin");
}

// ── Ajustar días de una membresía activa (agregar o restar) ────────────────────

export async function adjustMembershipDays(membershipId: string, days: number) {
  const supabase = await createClient();

  if (!Number.isFinite(days) || days === 0) {
    throw new Error("Indica cuántos días agregar o restar");
  }

  const { data: current, error: readError } = await supabase
    .from("memberships")
    .select("start_date, end_date, status")
    .eq("id", membershipId)
    .single();

  if (readError || !current) throw new Error("Membresía no encontrada");

  const end = new Date(current.end_date + "T00:00:00");
  end.setDate(end.getDate() + days);

  // La nueva fecha de fin no puede quedar antes del inicio.
  if (end < new Date(current.start_date + "T00:00:00")) {
    throw new Error("No puedes restar tantos días: la fecha de fin quedaría antes del inicio");
  }

  const { error } = await supabase
    .from("memberships")
    .update({ end_date: end.toISOString().split("T")[0] })
    .eq("id", membershipId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/membresias");
  revalidatePath("/admin/miembros");
  revalidatePath("/admin");
}

// ── Cambiar de plan: cancela la actual y crea una nueva con el nuevo plan ───────

export async function changeMembershipPlan(currentMembershipId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const memberId = formData.get("member_id") as string;
  const newPlanId = formData.get("plan_id") as string;
  const paidAmount = parseFloat(formData.get("paid_amount") as string) || 0;
  const paymentMethod = (formData.get("payment_method") as string) || "cash";
  const bankReference = (formData.get("bank_reference") as string) || null;

  const { data: plan, error: planError } = await supabase
    .from("membership_plans")
    .select("duration_days, name")
    .eq("id", newPlanId)
    .single();
  if (planError || !plan) throw new Error("Plan no encontrado");

  // 1. Cancelar la membresía actual (motivo: cambio de plan)
  const { error: cancelError } = await supabase
    .from("memberships")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: "Cambio de plan",
    })
    .eq("id", currentMembershipId);
  if (cancelError) throw new Error(cancelError.message);

  // 2. Crear la nueva membresía desde hoy
  const startDate = new Date().toISOString().split("T")[0];
  const end = new Date(startDate + "T00:00:00");
  end.setDate(end.getDate() + plan.duration_days);
  const endDate = end.toISOString().split("T")[0];

  const { data: membership, error: mError } = await supabase
    .from("memberships")
    .insert({
      member_id: memberId,
      plan_id: newPlanId,
      start_date: startDate,
      end_date: endDate,
      paid_amount: paidAmount,
      notes: "Cambio de plan",
      created_by: user?.id,
    })
    .select("id")
    .single();
  if (mError || !membership) throw new Error(mError?.message ?? "Error al crear la nueva membresía");

  // 3. Registrar la venta del nuevo plan (si hubo cobro)
  if (paidAmount > 0) {
    const { data: sale } = await supabase
      .from("sales")
      .insert({
        member_id: memberId,
        sale_date: startDate,
        total: paidAmount,
        payment_method: paymentMethod,
        bank_reference: bankReference,
        notes: `Cambio de plan: ${plan.name}`,
        created_by: user?.id,
      })
      .select("id")
      .single();

    if (sale) {
      await supabase.from("sale_items").insert({
        sale_id: sale.id,
        item_type: "membership",
        membership_id: membership.id,
        description: `${plan.name} (${plan.duration_days} días) — Cambio de plan`,
        quantity: 1,
        unit_price: paidAmount,
      });
    }
  }

  revalidatePath("/admin/membresias");
  revalidatePath("/admin/ventas");
  revalidatePath("/admin/miembros");
  revalidatePath("/admin");
}

// ── Editar fechas de una membresía existente ───────────────────────────────────

export async function updateMembership(
  membershipId: string,
  startDate: string,
  endDate: string
) {
  const supabase = await createClient();

  if (!startDate || !endDate) throw new Error("Las fechas son obligatorias");
  if (new Date(endDate) < new Date(startDate)) {
    throw new Error("La fecha de fin no puede ser anterior a la de inicio");
  }

  const { error } = await supabase
    .from("memberships")
    .update({ start_date: startDate, end_date: endDate })
    .eq("id", membershipId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/membresias");
  revalidatePath("/admin/miembros");
  revalidatePath("/admin");
}
