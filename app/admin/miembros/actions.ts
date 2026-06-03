"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createMember(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.from("members").insert({
    full_name: formData.get("full_name") as string,
    phone: formData.get("phone") as string,
    email: (formData.get("email") as string) || null,
    birthday: (formData.get("birthday") as string) || null,
    gender: (formData.get("gender") as string) || null,
    emergency_contact_name: (formData.get("emergency_contact_name") as string) || null,
    emergency_contact_phone: (formData.get("emergency_contact_phone") as string) || null,
    notes: (formData.get("notes") as string) || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/miembros");
}

export async function updateMember(id: string, formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("members")
    .update({
      full_name: formData.get("full_name") as string,
      phone: formData.get("phone") as string,
      email: (formData.get("email") as string) || null,
      birthday: (formData.get("birthday") as string) || null,
      gender: (formData.get("gender") as string) || null,
      emergency_contact_name: (formData.get("emergency_contact_name") as string) || null,
      emergency_contact_phone: (formData.get("emergency_contact_phone") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/miembros");
}

export async function toggleMemberStatus(id: string, currentStatus: string) {
  const supabase = await createClient();
  const newStatus = currentStatus === "active" ? "inactive" : "active";

  const { error } = await supabase
    .from("members")
    .update({ status: newStatus })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/miembros");
}
