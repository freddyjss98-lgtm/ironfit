// Lógica de membresías compartida por el panel web (server actions) y la app
// móvil (/api/app). No revalida rutas: eso es cosa de quien la llama.

import type { SupabaseClient } from "@supabase/supabase-js";
import { todayInEcuador } from "@ironfit/shared/date";
import { notifyMembershipActivated } from "@/lib/reminders/notifyActivation";
import type { ServiceCtx } from "./types";

export function dayAfter(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

/**
 * Calcula desde qué fecha debe correr una NUEVA membresía para un socio:
 * si ya tiene una activa vigente, arranca el día siguiente a su vencimiento
 * (así el socio no pierde los días que le quedan). Si no, arranca en `fallback`
 * (hoy por defecto).
 */
export async function nextMembershipStart(
  supabase: SupabaseClient,
  memberId: string,
  fallback?: string
): Promise<string> {
  const today = todayInEcuador();
  const base = fallback || today;
  const { data } = await supabase
    .from("memberships")
    .select("end_date")
    .eq("member_id", memberId)
    .eq("status", "active")
    .gte("end_date", today)
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data?.end_date) {
    const stacked = dayAfter(data.end_date as string);
    // Usa la fecha más tardía entre la solicitada y la encadenada.
    return stacked > base ? stacked : base;
  }
  return base;
}

// ── Alta ─────────────────────────────────────────────────────────────────────

export type CreateMembershipInput = {
  memberId: string;
  planId: string;
  /** Fecha de inicio pedida (YYYY-MM-DD). Vacía = hoy. */
  startDate?: string | null;
  paidAmount: number;
  paymentMethod: string;
  bankReference?: string | null;
  notes?: string | null;
};

export async function createMembership(
  { supabase, userId }: ServiceCtx,
  input: CreateMembershipInput
): Promise<{ membershipId: string; startDate: string; endDate: string }> {
  const { memberId, planId, paidAmount, paymentMethod } = input;
  if (!memberId) throw new Error("Selecciona un socio");
  if (!planId) throw new Error("Selecciona un plan");
  if (!Number.isFinite(paidAmount) || paidAmount < 0) {
    throw new Error("El monto cobrado no es válido");
  }

  const { data: plan, error: planError } = await supabase
    .from("membership_plans")
    .select("duration_days, price, name")
    .eq("id", planId)
    .single();

  if (planError || !plan) throw new Error("Plan no encontrado");

  // Si el socio ya tiene una membresía activa, la nueva se encadena: arranca el
  // día siguiente al vencimiento actual para no perder los días restantes.
  const effectiveStart = await nextMembershipStart(supabase, memberId, input.startDate ?? undefined);
  const start = new Date(effectiveStart + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + plan.duration_days);
  const endDate = end.toISOString().split("T")[0];

  const { data: membership, error: mError } = await supabase
    .from("memberships")
    .insert({
      member_id: memberId,
      plan_id: planId,
      start_date: effectiveStart,
      end_date: endDate,
      paid_amount: paidAmount,
      notes: input.notes || null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (mError || !membership) throw new Error(mError?.message ?? "Error al crear membresía");

  // La venta se registra HOY (día del pago), no en la fecha de inicio de la membresía.
  const saleDate = todayInEcuador();

  const { data: sale, error: sError } = await supabase
    .from("sales")
    .insert({
      member_id: memberId,
      sale_date: saleDate,
      total: paidAmount,
      payment_method: paymentMethod,
      bank_reference: input.bankReference || null,
      notes: `Membresía: ${plan.name}`,
      created_by: userId,
    })
    .select("id")
    .single();

  if (sError || !sale) throw new Error(sError?.message ?? "Error al registrar venta");

  await supabase.from("sale_items").insert({
    sale_id: sale.id,
    item_type: "membership",
    membership_id: membership.id,
    description: `${plan.name} (${plan.duration_days} días)`,
    quantity: 1,
    unit_price: paidAmount,
  });

  await notifyMembershipActivated(membership.id);

  return { membershipId: membership.id as string, startDate: effectiveStart, endDate };
}

// ── Renovación ───────────────────────────────────────────────────────────────

export type RenewMembershipInput = {
  paidAmount?: number;
  paymentMethod?: string;
  bankReference?: string | null;
};

export async function renewMembership(
  { supabase, userId }: ServiceCtx,
  membershipId: string,
  opts?: RenewMembershipInput
): Promise<{ newStart: string; newEnd: string }> {
  const { data: current, error } = await supabase
    .from("memberships")
    .select("member_id, plan_id, end_date, paid_amount, membership_plans(duration_days, name, price)")
    .eq("id", membershipId)
    .single();

  if (error || !current) throw new Error("Membresía no encontrada");

  const plan = current.membership_plans as unknown as { duration_days: number; name: string; price: number };
  const today = todayInEcuador();
  // Si aún está vigente, la renovación arranca el día siguiente al vencimiento
  // (no pierde días); si ya venció, arranca hoy.
  const newStart = current.end_date >= today ? dayAfter(current.end_date) : today;
  const startD = new Date(newStart + "T00:00:00");
  const newEnd = new Date(startD.setDate(startD.getDate() + plan.duration_days))
    .toISOString()
    .split("T")[0];

  const amount = opts?.paidAmount ?? plan.price;
  const method = opts?.paymentMethod ?? "transfer";
  const bankRef = opts?.bankReference ?? null;

  const { data: membership, error: mError } = await supabase
    .from("memberships")
    .insert({
      member_id: current.member_id,
      plan_id: current.plan_id,
      start_date: newStart,
      end_date: newEnd,
      paid_amount: amount,
      notes: `Renovación`,
      created_by: userId,
    })
    .select("id")
    .single();

  if (mError || !membership) throw new Error(mError?.message ?? "Error al renovar");

  // La venta se registra HOY (día del pago), no en la fecha de inicio de la
  // nueva membresía (que al renovar puede ser futura).
  const saleDate = todayInEcuador();
  const { data: sale } = await supabase
    .from("sales")
    .insert({
      member_id: current.member_id,
      sale_date: saleDate,
      total: amount,
      payment_method: method,
      bank_reference: bankRef,
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
      unit_price: amount,
    });
  }

  await notifyMembershipActivated(membership.id);

  return { newStart, newEnd };
}

// ── Congelar / reanudar (pausa por viaje, lesión, etc.) ────────────────────────

export async function freezeMembership({ supabase }: ServiceCtx, membershipId: string) {
  const { data: current, error: readError } = await supabase
    .from("memberships")
    .select("status")
    .eq("id", membershipId)
    .single();

  if (readError || !current) throw new Error("Membresía no encontrada");
  if (current.status !== "active") {
    throw new Error("Solo se puede congelar una membresía activa");
  }

  const today = todayInEcuador();
  const { error } = await supabase
    .from("memberships")
    .update({ status: "frozen", frozen_at: today })
    .eq("id", membershipId);

  if (error) throw new Error(error.message);
}

export async function resumeMembership({ supabase }: ServiceCtx, membershipId: string) {
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

  await notifyMembershipActivated(membershipId);
}

// ── Cancelar (opcionalmente anulando el cobro) ────────────────────────────────

export type MembershipSale = {
  id: string;
  sale_date: string;
  total: number;
  payment_method: string;
  /** Ítems de la venta. Si es > 1 la venta trae también productos. */
  item_count: number;
};

/**
 * Venta ligada a una membresía, vía `sale_items.membership_id`. Devuelve null si
 * no hay cobro registrado o si ya está anulado — en ambos casos no hay nada que
 * ofrecer al cancelar.
 */
export async function getMembershipSale(
  { supabase }: ServiceCtx,
  membershipId: string
): Promise<MembershipSale | null> {
  const { data: item } = await supabase
    .from("sale_items")
    .select("sale_id")
    .eq("membership_id", membershipId)
    .maybeSingle();
  if (!item?.sale_id) return null;

  const { data: sale } = await supabase
    .from("sales")
    .select("id, sale_date, total, payment_method, voided_at")
    .eq("id", item.sale_id)
    .maybeSingle();
  if (!sale || sale.voided_at) return null;

  const { count } = await supabase
    .from("sale_items")
    .select("id", { count: "exact", head: true })
    .eq("sale_id", sale.id);

  return {
    id: sale.id as string,
    sale_date: sale.sale_date as string,
    total: Number(sale.total) || 0,
    payment_method: sale.payment_method as string,
    item_count: count ?? 1,
  };
}

/**
 * Cancela una membresía y, si `voidSale` es true, anula su cobro.
 *
 * La venta NO se borra: se marca anulada (quién, cuándo, por qué) y las vistas
 * `vw_daily_sales` / `vw_monthly_sales` la ignoran, que es lo que la saca de
 * Contabilidad. Ver 20260827000000_sales_void.sql.
 *
 * Se valida todo ANTES de escribir, y si la cancelación falla se revierte la
 * anulación: nunca debe quedar plata anulada con la membresía viva.
 */
export async function cancelMembership(
  ctx: ServiceCtx,
  membershipId: string,
  reason?: string | null,
  voidSale = false
) {
  const { supabase, userId } = ctx;
  if (!userId) throw new Error("No autenticado");

  const finalReason = reason?.trim() || null;
  let voidedSaleId: string | null = null;

  if (voidSale) {
    const sale = await getMembershipSale(ctx, membershipId);
    if (!sale) throw new Error("Esta membresía no tiene un cobro por anular");
    if (sale.item_count > 1) {
      throw new Error(
        "La venta incluye otros productos: anúlala desde Ventas para no borrar cobros buenos"
      );
    }

    // Anular es mover plata: solo admin (el RLS de `sales` también lo exige).
    const { data: me } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (me?.role !== "admin") {
      throw new Error("Solo un admin puede anular un cobro");
    }

    // Un mes cerrado tiene los totales congelados: no se toca por detrás.
    const ym = sale.sale_date.slice(0, 7);
    const { data: close } = await supabase
      .from("monthly_close")
      .select("is_closed")
      .eq("month", `${ym}-01`)
      .maybeSingle();
    if (close?.is_closed) {
      throw new Error(`El mes ${ym} ya está cerrado: reábrelo para anular este cobro`);
    }

    const { data: voided, error: voidError } = await supabase
      .from("sales")
      .update({
        voided_at: new Date().toISOString(),
        voided_by: userId,
        void_reason: `Membresía cancelada: ${finalReason ?? "sin motivo"}`,
      })
      .eq("id", sale.id)
      .is("voided_at", null)
      .select("id");

    if (voidError) throw new Error(voidError.message);
    if (!voided?.length) throw new Error("No se pudo anular el cobro");
    voidedSaleId = sale.id;
  }

  const { error } = await supabase
    .from("memberships")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: finalReason,
    })
    .eq("id", membershipId);

  if (error) {
    if (voidedSaleId) {
      // Deshacer la anulación: la membresía sigue viva, su cobro también debe.
      await supabase
        .from("sales")
        .update({ voided_at: null, voided_by: null, void_reason: null })
        .eq("id", voidedSaleId);
    }
    throw new Error(error.message);
  }
}
