"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "admin") throw new Error("No autorizado");
  return { supabase, user };
}

// ── Edición completa del miembro (todos los campos) ───────────────────────────

export async function updateMemberFull(memberId: string, formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("members")
    .update({
      full_name: (formData.get("full_name") as string).trim(),
      phone: (formData.get("phone") as string).trim(),
      email: (formData.get("email") as string) || null,
      birthday: (formData.get("birthday") as string) || null,
      gender: (formData.get("gender") as string) || null,
      height_cm: formData.get("height_cm") ? parseFloat(formData.get("height_cm") as string) : null,
      goal: (formData.get("goal") as string) || null,
      status: (formData.get("status") as string) || "active",
      emergency_contact_name: (formData.get("emergency_contact_name") as string) || null,
      emergency_contact_phone: (formData.get("emergency_contact_phone") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", memberId);

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/miembros/${memberId}`);
  revalidatePath("/admin/miembros");
}

// ── Cambiar rol: promover a Coach ──────────────────────────────────────────────

export async function promoteToCoach(memberId: string, data: {
  user_id: string | null;
  full_name: string;
  specialty: string;
  phone: string;
  email: string | null;
}) {
  const { supabase } = await assertAdmin();

  if (!data.user_id) {
    throw new Error(
      "El miembro no tiene acceso al panel. Primero créale el acceso (usuario y contraseña) en la tarjeta 'Acceso al portal', luego promuévelo a coach."
    );
  }

  // 1. Ficha de coach (para la lista de Coaches). Si ya existe, no es error.
  const { error } = await supabase.from("coaches").insert({
    full_name: data.full_name,
    specialty: data.specialty || "Entrenamiento funcional",
    phone: data.phone,
    email: data.email,
    active: true,
  });
  if (error && error.code !== "23505") throw new Error(error.message);

  // 2. Login con rol coach. Se usa el service role porque la RLS de profiles
  //    solo permite insertar el perfil propio; aquí creamos el de otro usuario.
  const admin = createAdminClient();
  const { error: pErr } = await admin.from("profiles").upsert({
    id: data.user_id,
    full_name: data.full_name,
    email: data.email,
    role: "coach",
  });
  if (pErr) throw new Error(pErr.message);

  revalidatePath(`/admin/miembros/${memberId}`);
  revalidatePath("/admin/coaches");
}

// ── Cambiar rol: promover a Admin ──────────────────────────────────────────────

// ── Quitar permisos: vuelve a ser usuario del portal sin rol de staff ──────────

export async function demoteToMember(memberId: string, userId: string) {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").delete().eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/miembros/${memberId}`);
  revalidatePath("/admin/miembros");
  revalidatePath("/admin/coaches");
}

// ── Cambiar rol: promover a Admin ──────────────────────────────────────────────

export async function promoteToAdmin(memberId: string, data: {
  user_id: string | null;
  full_name: string;
  email: string | null;
}) {
  if (!data.user_id) {
    throw new Error(
      "El miembro no tiene acceso al panel. Primero créale el acceso en la tarjeta 'Acceso al portal'."
    );
  }

  await assertAdmin();

  // Service role: la RLS de profiles solo permite el perfil propio.
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").upsert({
    id: data.user_id,
    full_name: data.full_name,
    email: data.email,
    role: "admin",
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/miembros/${memberId}`);
}

export async function addProgress(memberId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const parse = (key: string) => {
    const v = formData.get(key) as string;
    return v && v.trim() !== "" ? parseFloat(v) : null;
  };

  const { error } = await supabase.from("member_progress").insert({
    member_id: memberId,
    measured_at: (formData.get("measured_at") as string) || new Date().toISOString().split("T")[0],
    weight: parse("weight"),
    body_fat: parse("body_fat"),
    muscle_mass: parse("muscle_mass"),
    chest_cm: parse("chest_cm"),
    waist_cm: parse("waist_cm"),
    hips_cm: parse("hips_cm"),
    arm_cm: parse("arm_cm"),
    leg_cm: parse("leg_cm"),
    notes: (formData.get("notes") as string) || null,
    photo_url: (formData.get("photo_url") as string) || null,
    created_by: user?.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/miembros/${memberId}`);
}

export async function deleteProgress(progressId: string, memberId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("member_progress").delete().eq("id", progressId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/miembros/${memberId}`);
}

export async function updateMemberProfile(memberId: string, formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("members")
    .update({
      height_cm: formData.get("height_cm") ? parseFloat(formData.get("height_cm") as string) : null,
      gender: (formData.get("gender") as string) || null,
      goal: (formData.get("goal") as string) || null,
      photo_url: (formData.get("photo_url") as string) || null,
    })
    .eq("id", memberId);

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/miembros/${memberId}`);
}

export async function uploadMemberPhoto(file: File, memberId: string) {
  const supabase = await createClient();

  const fileName = `${memberId}-${Date.now()}.${file.name.split(".").pop()}`;
  const { data, error } = await supabase.storage
    .from("member-photos")
    .upload(fileName, file, { upsert: true });

  if (error) throw new Error(error.message);

  const { data: { publicUrl } } = supabase.storage
    .from("member-photos")
    .getPublicUrl(data.path);

  return publicUrl;
}

export async function uploadProgressPhoto(file: File, memberId: string) {
  const supabase = await createClient();

  const fileName = `${memberId}-${Date.now()}.${file.name.split(".").pop()}`;
  const { data, error } = await supabase.storage
    .from("progress-photos")
    .upload(fileName, file, { upsert: false });

  if (error) throw new Error(error.message);

  const { data: { publicUrl } } = supabase.storage
    .from("progress-photos")
    .getPublicUrl(data.path);

  return publicUrl;
}
