"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateMyAdminProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const full_name = ((formData.get("full_name") as string) ?? "").trim() || null;
  const phone = ((formData.get("phone") as string) ?? "").trim() || null;

  const { error } = await supabase
    .from("profiles")
    .update({ full_name, phone, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/cuenta");
}

export async function changeAdminPassword(newPassword: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  if (!newPassword || newPassword.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres");
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
