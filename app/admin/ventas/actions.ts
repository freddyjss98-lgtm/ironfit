"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
  const saleDate = new Date().toISOString().split("T")[0];

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
      // Membresía: crear el periodo (inicio hoy, fin según el plan) + ítem de venta
      const start = new Date();
      const end = new Date(start);
      end.setDate(end.getDate() + (item.durationDays ?? 30));

      const { data: membership } = await supabase
        .from("memberships")
        .insert({
          member_id: memberId,
          plan_id: item.refId,
          start_date: start.toISOString().split("T")[0],
          end_date: end.toISOString().split("T")[0],
          paid_amount: item.unitPrice * item.quantity,
          notes: "Venta de mostrador",
          created_by: user?.id,
        })
        .select("id")
        .single();

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
