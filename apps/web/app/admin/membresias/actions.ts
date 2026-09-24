"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { todayInEcuador } from "@ironfit/shared/date";
import { notifyMembershipActivated } from "@/lib/reminders/notifyActivation";
import * as memberships from "@/lib/services/memberships";
import type { ServiceCtx } from "@/lib/services/types";

export type { MembershipSale } from "@/lib/services/memberships";

async function ctx(): Promise<ServiceCtx> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
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
  await memberships.createMembership(await ctx(), {
    memberId: formData.get("member_id") as string,
    planId: formData.get("plan_id") as string,
    startDate: formData.get("start_date") as string,
    paidAmount: parseFloat(formData.get("paid_amount") as string),
    paymentMethod: formData.get("payment_method") as string,
    bankReference: (formData.get("bank_reference") as string) || null,
    notes: (formData.get("notes") as string) || null,
  });

  revalidatePath("/admin/membresias");
  revalidatePath("/admin/ventas");
  revalidatePath("/admin");
}

export async function renewMembership(
  membershipId: string,
  opts?: memberships.RenewMembershipInput
): Promise<{ newStart: string; newEnd: string }> {
  const result = await memberships.renewMembership(await ctx(), membershipId, opts);

  revalidatePath("/admin/membresias");
  revalidatePath("/admin/ventas");
  revalidatePath("/admin");
  return result;
}

// ── Congelar / reanudar (pausa por viaje, lesión, etc.) ────────────────────────

export async function freezeMembership(membershipId: string) {
  await memberships.freezeMembership(await ctx(), membershipId);

  revalidatePath("/admin/membresias");
  revalidatePath("/admin/miembros");
  revalidatePath("/admin");
}

export async function resumeMembership(membershipId: string) {
  await memberships.resumeMembership(await ctx(), membershipId);

  revalidatePath("/admin/membresias");
  revalidatePath("/admin/miembros");
  revalidatePath("/admin");
}

// ── Cancelar (opcionalmente anulando el cobro) ────────────────────────────────

export async function getMembershipSale(
  membershipId: string
): Promise<memberships.MembershipSale | null> {
  const c = await ctx();
  if (!c.userId) throw new Error("No autenticado");
  return memberships.getMembershipSale(c, membershipId);
}

export async function cancelMembership(
  membershipId: string,
  reason?: string,
  voidSale = false
) {
  await memberships.cancelMembership(await ctx(), membershipId, reason, voidSale);

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
