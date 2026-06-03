"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

  // Create sale record linked to this membership
  const { data: sale, error: sError } = await supabase
    .from("sales")
    .insert({
      member_id: memberId,
      sale_date: startDate,
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

  // Sale record
  const { data: sale } = await supabase
    .from("sales")
    .insert({
      member_id: current.member_id,
      sale_date: newStart,
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

export async function cancelMembership(membershipId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("memberships")
    .update({ status: "cancelled" })
    .eq("id", membershipId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/membresias");
}
