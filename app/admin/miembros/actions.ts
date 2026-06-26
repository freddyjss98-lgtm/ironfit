"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isValidCedula, normalizeCedula } from "@/lib/cedula";
import type { ActionResult } from "@/lib/result";

export async function createMember(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const cedula = normalizeCedula((formData.get("cedula") as string) || "");
  if (!cedula) return { ok: false, error: "La cédula es obligatoria" };
  if (!isValidCedula(cedula)) return { ok: false, error: "La cédula ingresada no es válida" };

  const { error } = await supabase.from("members").insert({
    full_name: formData.get("full_name") as string,
    phone: formData.get("phone") as string,
    email: (formData.get("email") as string) || null,
    cedula,
    birthday: (formData.get("birthday") as string) || null,
    gender: (formData.get("gender") as string) || null,
    photo_url: (formData.get("photo_url") as string) || null,
    emergency_contact_name: (formData.get("emergency_contact_name") as string) || null,
    emergency_contact_phone: (formData.get("emergency_contact_phone") as string) || null,
    notes: (formData.get("notes") as string) || null,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Esa cédula ya está registrada en otro socio" };
    return { ok: false, error: error.message };
  }
  revalidatePath("/admin/miembros");
  return { ok: true };
}

export async function updateMember(id: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("members")
    .update({
      full_name: formData.get("full_name") as string,
      phone: formData.get("phone") as string,
      email: (formData.get("email") as string) || null,
      birthday: (formData.get("birthday") as string) || null,
      gender: (formData.get("gender") as string) || null,
      photo_url: (formData.get("photo_url") as string) || null,
      emergency_contact_name: (formData.get("emergency_contact_name") as string) || null,
      emergency_contact_phone: (formData.get("emergency_contact_phone") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/miembros");
  return { ok: true };
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

// ── Subir foto del atleta al bucket member-photos ──────────────────────────────
// memberId es opcional: al crear un miembro nuevo aún no existe el id.

export async function uploadMemberPhoto(file: File, memberId?: string) {
  const supabase = await createClient();

  const prefix = memberId ?? "new";
  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${prefix}-${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from("member-photos")
    .upload(fileName, file, { upsert: true });

  if (error) throw new Error(error.message);

  const { data: { publicUrl } } = supabase.storage
    .from("member-photos")
    .getPublicUrl(data.path);

  return publicUrl;
}

// ── Archivar (soft-delete) y restaurar miembros ────────────────────────────────

export async function archiveMember(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("members")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/miembros");
}

export async function restoreMember(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("members")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/miembros");
}
