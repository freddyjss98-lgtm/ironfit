"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createPlan(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.from("membership_plans").insert({
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    price: parseFloat(formData.get("price") as string),
    duration_days: parseInt(formData.get("duration_days") as string, 10),
    color: (formData.get("color") as string) || "#e84b1f",
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/planes");
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
      active: formData.get("active") === "true",
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/planes");
}

export async function togglePlanActive(id: string, currentActive: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("membership_plans")
    .update({ active: !currentActive })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/planes");
}
