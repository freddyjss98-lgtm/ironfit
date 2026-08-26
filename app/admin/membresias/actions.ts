"use server";

import { createClient } from "@/lib/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { todayInEcuador } from "@/lib/date";
import { notifyMembershipActivated } from "@/lib/reminders/notifyActivation";

function dayAfter(dateStr: string): string {
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
async function nextMembershipStart(
  supabase: SupabaseClient,
  memberId: string,
  fallback?: string
): Promise<string> {
  const today = todayInEcuador();
  const base = fallback ?? today;
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

// Devuelve la membresía activa (vigente) del socio, si la tiene. Una membresía
// cuenta como activa si status='active' y su fecha de fin no ha pasado.
export async function getActiveMembership(memberId: string) {
  const supabase = await createClient();
  const today = todayInEcuador();
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

  // Get plan duration to calculate end_date
  const { data: plan, error: planError } = await supabase
    .from("membership_plans")
    .select("duration_days, price, name")
    .eq("id", planId)
    .single();

  if (planError || !plan) throw new Error("Plan no encontrado");

  // Si el socio ya tiene una membresía activa, la nueva se encadena: arranca el
  // día siguiente al vencimiento actual para no perder los días restantes.
  const effectiveStart = await nextMembershipStart(supabase, memberId, startDate);
  const start = new Date(effectiveStart + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + plan.duration_days);
  const endDate = end.toISOString().split("T")[0];

  // Create membership
  const { data: membership, error: mError } = await supabase
    .from("memberships")
    .insert({
      member_id: memberId,
      plan_id: planId,
      start_date: effectiveStart,
      end_date: endDate,
      paid_amount: paidAmount,
      notes,
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (mError || !membership) throw new Error(mError?.message ?? "Error al crear membresía");

  // La venta se registra HOY (día del pago), no en la fecha de inicio de la membresía.
  const saleDate = todayInEcuador();

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

  await notifyMembershipActivated(membership.id);

  revalidatePath("/admin/membresias");
  revalidatePath("/admin/ventas");
  revalidatePath("/admin");
}

export async function renewMembership(
  membershipId: string,
  opts?: { paidAmount?: number; paymentMethod?: string; bankReference?: string | null }
): Promise<{ newStart: string; newEnd: string }> {
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
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (mError || !membership) throw new Error(mError?.message ?? "Error al renovar");

  // Sale record — la venta se registra HOY (día del pago), no en la fecha de
  // inicio de la nueva membresía (que al renovar puede ser futura).
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
      unit_price: amount,
    });
  }

  await notifyMembershipActivated(membership.id);

  revalidatePath("/admin/membresias");
  revalidatePath("/admin/ventas");
  revalidatePath("/admin");
  return { newStart, newEnd };
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

  const today = todayInEcuador();
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

  await notifyMembershipActivated(membershipId);

  revalidatePath("/admin/membresias");
  revalidatePath("/admin/miembros");
  revalidatePath("/admin");
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
  membershipId: string
): Promise<MembershipSale | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

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
  membershipId: string,
  reason?: string,
  voidSale = false
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const finalReason = reason?.trim() || null;
  let voidedSaleId: string | null = null;

  if (voidSale) {
    const sale = await getMembershipSale(membershipId);
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
      .eq("id", user.id)
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
        voided_by: user.id,
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

  revalidatePath("/admin/membresias");
  revalidatePath("/admin/miembros");
  revalidatePath("/admin/ventas");
  revalidatePath("/admin/contabilidad");
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

  await notifyMembershipActivated(membershipId);

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
  const startDate = todayInEcuador();
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

  await notifyMembershipActivated(membership.id);

  revalidatePath("/admin/membresias");
  revalidatePath("/admin/ventas");
  revalidatePath("/admin/miembros");
  revalidatePath("/admin");
}

// ── Editar fechas de una membresía existente ───────────────────────────────────

export type UpdateMembershipInput = {
  startDate: string;
  endDate: string;
  planId: string;
  paidAmount: number;
  paymentMethod?: string;
  notes?: string | null;
};

/**
 * Corrige una membresía EN SITIO: plan, fechas, monto y notas.
 *
 * Es lo contrario de `changeMembershipPlan`. Aquí no se cancela nada ni se crea
 * una membresía nueva — esto es para cuando se registró mal (plan equivocado,
 * monto mal tecleado), no para un cambio comercial de plan. Por eso tampoco
 * genera una venta nueva: si el monto o el plan cambian, se AJUSTA la venta que
 * ya existe, para que Contabilidad no quede descuadrada ni duplicada.
 */
export async function updateMembership(
  membershipId: string,
  input: UpdateMembershipInput
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { startDate, endDate, planId, paidAmount, paymentMethod } = input;

  if (!startDate || !endDate) throw new Error("Las fechas son obligatorias");
  if (new Date(endDate) < new Date(startDate)) {
    throw new Error("La fecha de fin no puede ser anterior a la de inicio");
  }
  if (!planId) throw new Error("Elige un plan");
  if (!Number.isFinite(paidAmount) || paidAmount < 0) {
    throw new Error("El monto cobrado no es válido");
  }

  const { data: current, error: readError } = await supabase
    .from("memberships")
    .select("plan_id, paid_amount, start_date, end_date")
    .eq("id", membershipId)
    .single();
  if (readError || !current) throw new Error("Membresía no encontrada");

  const { data: plan, error: planError } = await supabase
    .from("membership_plans")
    .select("name, duration_days")
    .eq("id", planId)
    .single();
  if (planError || !plan) throw new Error("Plan no encontrado");

  const planChanged = planId !== current.plan_id;
  const amountChanged = Number(current.paid_amount) !== paidAmount;

  // ── Sincronizar la venta enlazada ──────────────────────────────────────────
  if (planChanged || amountChanged || paymentMethod) {
    const { data: item } = await supabase
      .from("sale_items")
      .select("id, sale_id, description, quantity")
      .eq("membership_id", membershipId)
      .maybeSingle();

    if (item?.sale_id) {
      const { data: sale } = await supabase
        .from("sales")
        .select("id, sale_date, payment_method, notes, voided_at")
        .eq("id", item.sale_id)
        .maybeSingle();

      // Una venta anulada ya no cuenta: se deja quieta.
      if (sale && !sale.voided_at) {
        const methodChanged = !!paymentMethod && paymentMethod !== sale.payment_method;

        if (amountChanged || methodChanged) {
          const { data: me } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          if (me?.role !== "admin") {
            throw new Error("Solo un admin puede corregir el cobro de una membresía");
          }

          const ym = (sale.sale_date as string).slice(0, 7);
          const { data: close } = await supabase
            .from("monthly_close")
            .select("is_closed")
            .eq("month", `${ym}-01`)
            .maybeSingle();
          if (close?.is_closed) {
            throw new Error(`El mes ${ym} ya está cerrado: reábrelo para corregir este cobro`);
          }
        }

        // El ítem conserva su sufijo (" — Renovación") si lo tenía.
        const desc = (item.description as string) ?? "";
        const sep = desc.indexOf(" — ");
        const suffix = sep >= 0 ? desc.slice(sep) : "";

        // `subtotal` NO se escribe: es una columna generada (quantity * unit_price).
        await supabase
          .from("sale_items")
          .update({
            description: `${plan.name} (${plan.duration_days} días)${suffix}`,
            unit_price: paidAmount,
          })
          .eq("id", item.id);

        // El total de la venta se recalcula desde sus ítems: así una venta mixta
        // (membresía + productos) queda bien sin tocar los otros cobros.
        const { data: allItems } = await supabase
          .from("sale_items")
          .select("quantity, unit_price")
          .eq("sale_id", sale.id);
        const newTotal = (allItems ?? []).reduce(
          (s, i) => s + (Number(i.quantity) || 1) * (Number(i.unit_price) || 0),
          0
        );

        const saleUpdate: Record<string, unknown> = { total: newTotal };
        if (methodChanged) saleUpdate.payment_method = paymentMethod;
        // "Membresía: X" / "Renovación: X" en la lista de Ventas debe seguir al plan.
        const saleNotes = (sale.notes as string | null) ?? "";
        const m = saleNotes.match(/^(Membresía|Renovación):\s/);
        if (m) saleUpdate.notes = `${m[1]}: ${plan.name}`;

        await supabase.from("sales").update(saleUpdate).eq("id", sale.id);
      }
    }
  }

  const { error } = await supabase
    .from("memberships")
    .update({
      start_date: startDate,
      end_date: endDate,
      plan_id: planId,
      paid_amount: paidAmount,
      notes: input.notes?.trim() || null,
    })
    .eq("id", membershipId);

  if (error) throw new Error(error.message);

  // Solo se avisa al socio si cambió algo que le afecta (su plan o su vencimiento),
  // no por corregir un monto o una nota interna.
  if (planChanged || endDate !== current.end_date) {
    await notifyMembershipActivated(membershipId);
  }

  revalidatePath("/admin/membresias");
  revalidatePath("/admin/miembros");
  revalidatePath("/admin/ventas");
  revalidatePath("/admin/contabilidad");
  revalidatePath("/admin");
}
