"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createProduct(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.from("products").insert({
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    category: (formData.get("category") as string) || null,
    price: parseFloat(formData.get("price") as string),
    stock: parseInt(formData.get("stock") as string, 10),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/tienda");
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
      stock: parseInt(formData.get("stock") as string, 10),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/tienda");
}

export async function toggleProductActive(id: string, active: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .update({ active: !active })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/tienda");
}

export async function adjustStock(id: string, delta: number) {
  const supabase = await createClient();

  // Read current stock first
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
  revalidatePath("/admin/tienda");
}
