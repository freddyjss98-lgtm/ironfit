"use server";

import { randomInt } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { isValidCedula, normalizeCedula } from "@/lib/cedula";
import type { ActionResult } from "@/lib/result";

type CredentialsResult =
  | { ok: true; credentials: AccessCredentials }
  | { ok: false; error: string };

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
): Promise<CredentialsResult> {
  try {
    const { supabase } = await assertAdmin();

    const fullName = (formData.get("full_name") as string)?.trim();
    const email = (formData.get("email") as string)?.trim();
    const cedula = normalizeCedula((formData.get("cedula") as string) || "");

    if (!fullName) return { ok: false, error: "El nombre completo es obligatorio" };
    if (!email) return { ok: false, error: "El correo es obligatorio para crear el acceso al portal" };
    if (!cedula) return { ok: false, error: "La cédula es obligatoria" };
    if (!isValidCedula(cedula)) return { ok: false, error: "La cédula ingresada no es válida" };

    const { data: member, error } = await supabase
      .from("members")
      .insert({
        full_name: fullName,
        phone: (formData.get("phone") as string) || "",
        email,
        cedula,
        birthday: (formData.get("birthday") as string) || null,
        gender: (formData.get("gender") as string) || null,
        photo_url: (formData.get("photo_url") as string) || null,
        emergency_contact_name: (formData.get("emergency_contact_name") as string) || null,
        emergency_contact_phone: (formData.get("emergency_contact_phone") as string) || null,
        notes: (formData.get("notes") as string) || null,
      })
      .select("id")
      .single();

    if (error || !member) {
      if (error?.code === "23505") return { ok: false, error: "Esa cédula ya está registrada en otro socio" };
      return { ok: false, error: error?.message ?? "No se pudo crear el socio" };
    }

    try {
      const creds = await provisionAccess(member.id, email, fullName);
      revalidatePath("/admin/miembros");
      return { ok: true, credentials: creds };
    } catch (e) {
      // Si falló la creación del acceso, deshacemos el socio recién insertado
      // para que el admin pueda reintentar limpio.
      const admin = createAdminClient();
      await admin.from("members").delete().eq("id", member.id);
      return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear el acceso" };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

// ── Crear acceso para un socio que ya existe (desde la ficha) ────────────────────

export async function createMemberAccess(
  memberId: string,
  email: string,
  fullName: string
): Promise<CredentialsResult> {
  try {
    await assertAdmin();
    const clean = email?.trim();
    if (!clean) return { ok: false, error: "El correo es obligatorio para crear el acceso" };

    const creds = await provisionAccess(memberId, clean, fullName);
    revalidatePath(`/admin/miembros/${memberId}`);
    revalidatePath("/admin/miembros");
    return { ok: true, credentials: creds };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

// ── Resetear la contraseña (genera una nueva temporal) ───────────────────────────

export async function resetMemberPassword(
  memberId: string,
  userId: string
): Promise<{ ok: true; tempPassword: string } | { ok: false; error: string }> {
  try {
    await assertAdmin();

    const admin = createAdminClient();
    const tempPassword = generateTempPassword();

    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: tempPassword,
      user_metadata: { is_member: true, must_change_password: true },
    });

    if (error) return { ok: false, error: error.message };

    revalidatePath(`/admin/miembros/${memberId}`);
    return { ok: true, tempPassword };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

// ── Revocar acceso: elimina el usuario de auth y desvincula al socio ─────────────

export async function revokeMemberAccess(memberId: string, userId: string): Promise<ActionResult> {
  try {
    await assertAdmin();

    const admin = createAdminClient();

    const { error: delError } = await admin.auth.admin.deleteUser(userId);
    // 404 = el usuario ya no existe en auth; seguimos para desvincular igual.
    if (delError && !delError.message.toLowerCase().includes("not found")) {
      return { ok: false, error: delError.message };
    }

    const { error } = await admin
      .from("members")
      .update({ user_id: null })
      .eq("id", memberId);

    if (error) return { ok: false, error: error.message };

    revalidatePath(`/admin/miembros/${memberId}`);
    revalidatePath("/admin/miembros");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
