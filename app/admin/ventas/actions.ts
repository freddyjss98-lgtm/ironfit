"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { todayInEcuador } from "@/lib/date";

function dayAfter(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

type SaleItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export async function createProductSale(params: {
  memberId: string | null;
  saleDate: string;
  paymentMethod: string;
  bankReference: string | null;
  notes: string | null;
  items: SaleItem[];
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { memberId, saleDate, paymentMethod, bankReference, notes, items } = params;

  if (items.length === 0) throw new Error("Agrega al menos un producto");

  const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  const { data: sale, error } = await supabase
    .from("sales")
    .insert({
      member_id: memberId,
      sale_date: saleDate,
      total,
      payment_method: paymentMethod,
      bank_reference: bankReference,
      notes: notes || "Venta de productos",
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error || !sale) throw new Error(error?.message ?? "Error al registrar venta");

  for (const item of items) {
    await supabase.from("sale_items").insert({
      sale_id: sale.id,
      item_type: "product",
      product_id: item.productId,
      description: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    });

    const { data: prod } = await supabase
      .from("products")
      .select("stock")
      .eq("id", item.productId)
      .single();

    await supabase
      .from("products")
      .update({ stock: Math.max(0, (prod?.stock ?? 0) - item.quantity) })
      .eq("id", item.productId);
  }

  revalidatePath("/admin/ventas");
  revalidatePath("/admin/tienda");
  revalidatePath("/admin");
}

// ── Venta de mostrador: productos y/o membresías (con activación) ───────────────

type CartItem = {
  type: "product" | "plan";
  refId: string; // product_id o plan_id
  name: string;
  quantity: number;
  unitPrice: number;
  durationDays?: number; // solo planes
};

export async function createCounterSale(params: {
  memberId: string | null;
  paymentMethod: string;
  bankReference: string | null;
  notes: string | null;
  items: CartItem[];
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { memberId, paymentMethod, bankReference, notes, items } = params;

  if (items.length === 0) throw new Error("Agrega al menos un ítem");

  const hasPlan = items.some((i) => i.type === "plan");
  if (hasPlan && !memberId) {
    throw new Error("Selecciona un cliente para vender una membresía");
  }

  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const saleDate = todayInEcuador();
  let membershipStartsAt: string | null = null; // fecha de inicio si se encadenó

  const { data: sale, error } = await supabase
    .from("sales")
    .insert({
      member_id: memberId,
      sale_date: saleDate,
      total,
      payment_method: paymentMethod,
      bank_reference: bankReference,
      notes: notes || "Venta de mostrador",
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error || !sale) throw new Error(error?.message ?? "Error al registrar venta");

  // Para encadenar membresías: si el socio ya tiene una activa vigente, la nueva
  // arranca el día siguiente a su vencimiento (no pierde los días restantes).
  const today = todayInEcuador();
  let chainEnd: string | null = null;
  if (hasPlan && memberId) {
    const { data: active } = await supabase
      .from("memberships")
      .select("end_date")
      .eq("member_id", memberId)
      .eq("status", "active")
      .gte("end_date", today)
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    chainEnd = (active?.end_date as string) ?? null;
  }

  for (const item of items) {
    if (item.type === "product") {
      await supabase.from("sale_items").insert({
        sale_id: sale.id,
        item_type: "product",
        product_id: item.refId,
        description: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      });

      const { data: prod } = await supabase
        .from("products")
        .select("stock")
        .eq("id", item.refId)
        .single();

      await supabase
        .from("products")
        .update({ stock: Math.max(0, (prod?.stock ?? 0) - item.quantity) })
        .eq("id", item.refId);
    } else {
      // Membresía: encadenar si ya hay una vigente (o tras un ítem previo del carrito).
      const startStr = chainEnd && chainEnd >= today ? dayAfter(chainEnd) : today;
      const start = new Date(startStr + "T00:00:00");
      const end = new Date(start);
      end.setDate(end.getDate() + (item.durationDays ?? 30));
      const endStr = end.toISOString().split("T")[0];

      const { data: membership } = await supabase
        .from("memberships")
        .insert({
          member_id: memberId,
          plan_id: item.refId,
          start_date: startStr,
          end_date: endStr,
          paid_amount: item.unitPrice * item.quantity,
          notes: "Venta de mostrador",
          created_by: user?.id,
        })
        .select("id")
        .single();

      // Si la membresía no arranca hoy (se encadenó), lo reportamos al cajero.
      if (startStr > today && !membershipStartsAt) membershipStartsAt = startStr;

      // El siguiente ítem de membresía (si lo hay) se encadena tras este.
      chainEnd = endStr;

      await supabase.from("sale_items").insert({
        sale_id: sale.id,
        item_type: "membership",
        membership_id: membership?.id ?? null,
        description: `${item.name}${item.durationDays ? ` (${item.durationDays} días)` : ""}`,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      });
    }
  }

  revalidatePath("/admin/ventas");
  revalidatePath("/admin/tienda");
  revalidatePath("/admin/membresias");
  revalidatePath("/admin/miembros");
  revalidatePath("/admin");

  return { membershipStartsAt };
}

export async function createSale(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const memberId = (formData.get("member_id") as string) || null;
  const saleDate = formData.get("sale_date") as string;
  const total = parseFloat(formData.get("total") as string);
  const paymentMethod = formData.get("payment_method") as string;
  const bankReference = (formData.get("bank_reference") as string) || null;
  const description = formData.get("description") as string;
  const notes = (formData.get("notes") as string) || null;

  const { data: sale, error } = await supabase
    .from("sales")
    .insert({
      member_id: memberId,
      sale_date: saleDate,
      total,
      payment_method: paymentMethod,
      bank_reference: bankReference,
      notes: [description, notes].filter(Boolean).join(" — "),
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error || !sale) throw new Error(error?.message ?? "Error al registrar venta");

  revalidatePath("/admin/ventas");
  revalidatePath("/admin");
}
