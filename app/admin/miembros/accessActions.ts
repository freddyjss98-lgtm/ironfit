"use server";

import { randomInt } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type AccessCredentials = {
  email: string;
  tempPassword: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

// Caracteres sin ambigüedad (sin O/0/I/l/1) para que el socio pueda teclearla.
const PWD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generateTempPassword(length = 10): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PWD_ALPHABET[randomInt(PWD_ALPHABET.length)];
  }
  return out;
}

/**
 * Verifica que quien ejecuta la acción es staff (tiene fila en profiles).
 * Imprescindible: estas acciones usan el service role (omite RLS), así que
 * NO pueden quedar expuestas a un socio autenticado.
 */
async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) throw new Error("No autorizado");
  return { supabase, user };
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already") || m.includes("registered") || m.includes("exists")) {
    return "Ese correo ya tiene una cuenta. Usa otro correo o resetea la contraseña desde la ficha del socio.";
  }
  return message;
}

/**
 * Crea el usuario de auth con contraseña temporal y lo vincula al socio.
 * `must_change_password` obliga a cambiarla en el primer ingreso (lo aplica el
 * middleware del portal).
 */
async function provisionAccess(
  memberId: string,
  email: string,
  fullName: string
): Promise<AccessCredentials> {
  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      is_member: true,
      must_change_password: true,
    },
  });

  if (error || !data.user) {
    throw new Error(friendlyAuthError(error?.message ?? "No se pudo crear el acceso"));
  }

  const { error: linkError } = await admin
    .from("members")
    .update({ user_id: data.user.id, email })
    .eq("id", memberId);

  if (linkError) {
    // Rollback del usuario de auth para no dejar credenciales huérfanas.
    await admin.auth.admin.deleteUser(data.user.id);
    throw new Error(linkError.message);
  }

  return { email, tempPassword };
}

// ── Crear socio + acceso al portal en un solo paso (formulario "Nuevo usuario") ──

export async function createMemberWithAccess(
  formData: FormData
): Promise<AccessCredentials> {
  const { supabase } = await assertAdmin();

  const fullName = (formData.get("full_name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();

  if (!fullName) throw new Error("El nombre completo es obligatorio");
  if (!email) throw new Error("El correo es obligatorio para crear el acceso al portal");

  const { data: member, error } = await supabase
    .from("members")
    .insert({
      full_name: fullName,
      phone: (formData.get("phone") as string) || "",
      email,
      birthday: (formData.get("birthday") as string) || null,
      gender: (formData.get("gender") as string) || null,
      photo_url: (formData.get("photo_url") as string) || null,
      emergency_contact_name: (formData.get("emergency_contact_name") as string) || null,
      emergency_contact_phone: (formData.get("emergency_contact_phone") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .select("id")
    .single();

  if (error || !member) throw new Error(error?.message ?? "No se pudo crear el socio");

  try {
    const creds = await provisionAccess(member.id, email, fullName);
    revalidatePath("/admin/miembros");
    return creds;
  } catch (e) {
    // Si falló la creación del acceso, deshacemos el socio recién insertado
    // para que el admin pueda reintentar limpio.
    const admin = createAdminClient();
    await admin.from("members").delete().eq("id", member.id);
    throw e;
  }
}

// ── Crear acceso para un socio que ya existe (desde la ficha) ────────────────────

export async function createMemberAccess(
  memberId: string,
  email: string,
  fullName: string
): Promise<AccessCredentials> {
  await assertAdmin();
  const clean = email?.trim();
  if (!clean) throw new Error("El correo es obligatorio para crear el acceso");

  const creds = await provisionAccess(memberId, clean, fullName);
  revalidatePath(`/admin/miembros/${memberId}`);
  revalidatePath("/admin/miembros");
  return creds;
}

// ── Resetear la contraseña (genera una nueva temporal) ───────────────────────────

export async function resetMemberPassword(
  memberId: string,
  userId: string
): Promise<{ tempPassword: string }> {
  await assertAdmin();

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
    user_metadata: { is_member: true, must_change_password: true },
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/miembros/${memberId}`);
  return { tempPassword };
}

// ── Revocar acceso: elimina el usuario de auth y desvincula al socio ─────────────

export async function revokeMemberAccess(memberId: string, userId: string) {
  await assertAdmin();

  const admin = createAdminClient();

  const { error: delError } = await admin.auth.admin.deleteUser(userId);
  // 404 = el usuario ya no existe en auth; seguimos para desvincular igual.
  if (delError && !delError.message.toLowerCase().includes("not found")) {
    throw new Error(delError.message);
  }

  const { error } = await admin
    .from("members")
    .update({ user_id: null })
    .eq("id", memberId);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/miembros/${memberId}`);
  revalidatePath("/admin/miembros");
}
