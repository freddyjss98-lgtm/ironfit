"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function revalidate() {
  revalidatePath("/admin/productos");
  revalidatePath("/admin/planes");  // keeps old route fresh too
  revalidatePath("/admin/tienda");
  revalidatePath("/portal/renovar");
}

// ── Planes de Membresía ────────────────────────────────────────────────────────

export async function createPlan(formData: FormData): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("membership_plans")
    .insert({
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      price: parseFloat(formData.get("price") as string),
      duration_days: parseInt(formData.get("duration_days") as string, 10),
      color: (formData.get("color") as string) || "#e84b1f",
      iva_rate: parseFloat((formData.get("iva_rate") as string) || "15"),
      image_url: (formData.get("image_url") as string) || null,
      is_exclusive: formData.get("is_exclusive") === "true",
      active: true,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Error al crear el plan");
  revalidate();
  return { id: data.id as string };
}

export async function updatePlan(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("membership_plans")
    .update({
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      price: parseFloat(formData.get("price") as string),
      duration_days: parseInt(formData.get("duration_days") as string, 10),
      color: (formData.get("color") as string) || "#e84b1f",
      iva_rate: parseFloat((formData.get("iva_rate") as string) || "15"),
      image_url: (formData.get("image_url") as string) || null,
      is_exclusive: formData.get("is_exclusive") === "true",
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}

// Reemplaza la lista de socios con acceso a un plan exclusivo.
export async function setPlanMemberAccess(planId: string, memberIds: string[]) {
  const supabase = await createClient();

  const { error: delErr } = await supabase
    .from("plan_member_access")
    .delete()
    .eq("plan_id", planId);
  if (delErr) throw new Error(delErr.message);

  if (memberIds.length > 0) {
    const rows = memberIds.map((m) => ({ plan_id: planId, member_id: m }));
    const { error } = await supabase.from("plan_member_access").insert(rows);
    if (error) throw new Error(error.message);
  }
  revalidate();
}

export async function togglePlanActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("membership_plans")
    .update({ active: !active })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}

export async function deletePlan(id: string) {
  const supabase = await createClient();

  // Guard: reject if there are memberships using this plan
  const { count } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", id);

  if (count && count > 0) {
    throw new Error(
      `No se puede eliminar: hay ${count} membresía(s) usando este plan`
    );
  }

  const { error } = await supabase
    .from("membership_plans")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}

// ── Productos Físicos ──────────────────────────────────────────────────────────

export async function createProduct(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    category: (formData.get("category") as string) || null,
    price: parseFloat(formData.get("price") as string),
    stock: parseInt(formData.get("stock") as string, 10) || 0,
    iva_rate: parseFloat((formData.get("iva_rate") as string) || "15"),
    image_url: (formData.get("image_url") as string) || null,
    active: true,
  });
  if (error) throw new Error(error.message);
  revalidate();
}

export async function updateProduct(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      category: (formData.get("category") as string) || null,
      price: parseFloat(formData.get("price") as string),
      stock: parseInt(formData.get("stock") as string, 10) || 0,
      iva_rate: parseFloat((formData.get("iva_rate") as string) || "15"),
      image_url: (formData.get("image_url") as string) || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}

export async function toggleProductActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ active: !active })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}

export async function adjustStock(id: string, delta: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("stock")
    .eq("id", id)
    .single();
  const newStock = Math.max(0, (data?.stock ?? 0) + delta);
  const { error } = await supabase
    .from("products")
    .update({ stock: newStock })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}

export async function deleteProduct(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    if (error.code === "23503")
      throw new Error("No se puede eliminar: el producto tiene ventas asociadas");
    throw new Error(error.message);
  }
  revalidate();
}
