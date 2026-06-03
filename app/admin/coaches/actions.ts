"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function revalidateBoth() {
  revalidatePath("/admin/coaches");
  revalidatePath("/admin/clases");
}

export async function createCoach(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("coaches").insert({
    full_name: formData.get("full_name") as string,
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    specialty: (formData.get("specialty") as string) || null,
  });
  if (error) throw new Error(error.message);
  revalidateBoth();
}

export async function updateCoach(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("coaches")
    .update({
      full_name: formData.get("full_name") as string,
      phone: (formData.get("phone") as string) || null,
      email: (formData.get("email") as string) || null,
      specialty: (formData.get("specialty") as string) || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateBoth();
}

export async function toggleCoachActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("coaches")
    .update({ active: !active })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateBoth();
}

export async function deleteCoach(id: string) {
  const supabase = await createClient();
  // Check if coach has active classes assigned
  const { count } = await supabase
    .from("class_schedules")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", id)
    .eq("active", true);
  if ((count ?? 0) > 0) {
    throw new Error("Este coach tiene clases activas asignadas. Reasigna las clases antes de eliminar.");
  }
  const { error } = await supabase.from("coaches").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateBoth();
}
