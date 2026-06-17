"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

function revalidateBoth() {
  revalidatePath("/admin/coaches");
  revalidatePath("/admin/clases");
}

export async function promoteMemberToCoach(memberId: string, specialty: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") throw new Error("No autorizado");

  const { data: member } = await supabase
    .from("members")
    .select("full_name, phone, email, user_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) throw new Error("Miembro no encontrado");
  if (!member.user_id) throw new Error("El miembro no tiene acceso al portal. Primero créale acceso en su ficha.");

  const { error: coachErr } = await supabase.from("coaches").insert({
    full_name: member.full_name,
    specialty: specialty.trim() || "Entrenamiento funcional",
    phone: member.phone,
    email: member.email,
    active: true,
  });
  if (coachErr && coachErr.code !== "23505") throw new Error(coachErr.message);

  const admin = createAdminClient();
  const { error: profileErr } = await admin.from("profiles").upsert({
    id: member.user_id,
    full_name: member.full_name,
    email: member.email,
    role: "coach",
  });
  if (profileErr) throw new Error(profileErr.message);

  revalidateBoth();
  revalidatePath(`/admin/miembros/${memberId}`);
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
