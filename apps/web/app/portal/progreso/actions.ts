"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const NUMERIC_FIELDS = [
  "weight",
  "body_fat",
  "muscle_mass",
  "chest_cm",
  "waist_cm",
  "hips_cm",
  "arm_cm",
  "leg_cm",
] as const;

function num(fd: FormData, key: string): number | null {
  const v = fd.get(key) as string | null;
  if (!v || v.trim() === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// El socio registra su propia medición (solo números, sin fotos).
export async function addMyProgress(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: member, error: mErr } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (mErr || !member) throw new Error("Perfil de miembro no encontrado");

  const hasValue = NUMERIC_FIELDS.some((k) => num(formData, k) !== null);
  if (!hasValue) throw new Error("Ingresa al menos un dato (peso o una medida)");

  const measured_at =
    (formData.get("measured_at") as string) ||
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });

  const { error } = await supabase.from("member_progress").insert({
    member_id: member.id,
    created_by: user.id,
    measured_at,
    weight: num(formData, "weight"),
    body_fat: num(formData, "body_fat"),
    muscle_mass: num(formData, "muscle_mass"),
    chest_cm: num(formData, "chest_cm"),
    waist_cm: num(formData, "waist_cm"),
    hips_cm: num(formData, "hips_cm"),
    arm_cm: num(formData, "arm_cm"),
    leg_cm: num(formData, "leg_cm"),
    notes: (formData.get("notes") as string) || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/portal/progreso");
}

// Borrar solo una medición propia (RLS impide tocar las del gym).
export async function deleteMyProgress(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("member_progress").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/portal/progreso");
}

// Fijar / actualizar la meta de peso (vía RPC acotada a esa columna).
export async function setMyWeightGoal(target: number | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.rpc("set_my_weight_goal", { target });
  if (error) throw new Error(error.message);
  revalidatePath("/portal/progreso");
  revalidatePath("/portal");
}

// El socio registra su asistencia de hoy: 1 vez al día, requiere membresía activa.
export async function addMyAttendance() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: member, error: mErr } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (mErr || !member) throw new Error("Perfil de miembro no encontrado");

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
  const { data: activeMembership } = await supabase
    .from("memberships")
    .select("id")
    .eq("member_id", member.id)
    .eq("status", "active")
    .gte("end_date", today)
    .limit(1)
    .maybeSingle();
  if (!activeMembership) {
    throw new Error("Necesitas una membresía activa para registrar tu asistencia.");
  }

  const { error } = await supabase.from("attendances").insert({
    member_id: member.id,
    membership_id: activeMembership.id,
    checked_in_by: user.id,
  });

  if (error) {
    if (error.code === "23505") throw new Error("Ya registraste tu asistencia hoy");
    throw new Error(error.message);
  }

  revalidatePath("/portal/progreso");
  revalidatePath("/portal");
}
