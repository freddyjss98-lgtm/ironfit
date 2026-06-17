"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

function revalidateBoth() {
  revalidatePath("/admin/coaches");
  revalidatePath("/admin/clases");
  revalidatePath("/admin/miembros");
}

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") throw new Error("No autorizado");
  return { supabase };
}

// ─── Promover miembro existente a coach ────────────────────────────────────────
// Este es el único punto de entrada para hacer coach a alguien.
// Crea/vincula la fila en coaches (con user_id) + profiles.role='coach'.

export async function promoteMemberToCoach(memberId: string, specialty: string) {
  const { supabase } = await assertAdmin();

  const { data: member } = await supabase
    .from("members")
    .select("full_name, phone, email, user_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) throw new Error("Miembro no encontrado");
  if (!member.user_id) throw new Error("El miembro no tiene acceso al portal. Primero créale acceso en su ficha.");

  // Si ya existe una fila en coaches con este email → vincular user_id.
  // Si no existe → insertar nuevo registro.
  const { data: existing } = await supabase
    .from("coaches")
    .select("id")
    .eq("email", member.email ?? "")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("coaches")
      .update({
        user_id: member.user_id,
        specialty: specialty.trim() || undefined,
        active: true,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("coaches").insert({
      full_name: member.full_name,
      specialty: specialty.trim() || "Entrenamiento funcional",
      phone: member.phone,
      email: member.email,
      active: true,
      user_id: member.user_id,
    });
    if (error) throw new Error(error.message);
  }

  // Dar acceso al panel con role='coach'
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

// ─── Quitar acceso al panel (pero el coach sigue en la lista) ──────────────────

export async function revokeCoachPanelAccess(coachId: string, userId: string) {
  await assertAdmin();
  const admin = createAdminClient();

  // Borrar perfil (quita el acceso al panel)
  const { error: pErr } = await admin.from("profiles").delete().eq("id", userId);
  if (pErr) throw new Error(pErr.message);

  // Desvincular user_id del coach (pero mantiene la fila del coach para scheduling)
  const { error: cErr } = await admin
    .from("coaches")
    .update({ user_id: null })
    .eq("id", coachId);
  if (cErr) throw new Error(cErr.message);

  revalidateBoth();
}

// ─── Editar datos del coach ────────────────────────────────────────────────────

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

// ─── Activar / Desactivar coach ────────────────────────────────────────────────

export async function toggleCoachActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("coaches").update({ active: !active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateBoth();
}

// ─── Eliminar coach (borra profiles si está vinculado) ─────────────────────────

export async function deleteCoach(id: string) {
  const supabase = await createClient();

  const { count } = await supabase
    .from("class_schedules")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", id)
    .eq("active", true);
  if ((count ?? 0) > 0) {
    throw new Error("Este coach tiene clases activas asignadas. Reasigna las clases antes de eliminar.");
  }

  // Si tiene user_id vinculado, borrar también el perfil (quita acceso al panel)
  const { data: coach } = await supabase.from("coaches").select("user_id").eq("id", id).maybeSingle();
  if (coach?.user_id) {
    const admin = createAdminClient();
    await admin.from("profiles").delete().eq("id", coach.user_id);
  }

  const { error } = await supabase.from("coaches").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateBoth();
}
