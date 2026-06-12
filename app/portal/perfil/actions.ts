"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// El socio sube su propia foto (bucket member-photos permite insert a autenticados).
export async function uploadMyPhoto(file: File): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${user.id}-${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from("member-photos")
    .upload(fileName, file, { upsert: true });
  if (error) throw new Error(error.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from("member-photos").getPublicUrl(data.path);
  return publicUrl;
}

export async function updateMyProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const str = (k: string) => {
    const v = formData.get(k) as string | null;
    return v && v.trim() !== "" ? v.trim() : null;
  };
  const num = (k: string) => {
    const v = formData.get(k) as string | null;
    if (!v || v.trim() === "") return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };

  const { error } = await supabase.rpc("update_my_profile", {
    p_full_name: (formData.get("full_name") as string) ?? "",
    p_phone: (formData.get("phone") as string) ?? "",
    p_email: str("email"),
    p_birthday: str("birthday"),
    p_gender: str("gender"),
    p_height_cm: num("height_cm"),
    p_goal: str("goal"),
    p_emergency_contact_name: str("emergency_contact_name"),
    p_emergency_contact_phone: str("emergency_contact_phone"),
    p_photo_url: str("photo_url"),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/portal/perfil");
  revalidatePath("/portal");
}

export async function changeMyPassword(newPassword: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  if (!newPassword || newPassword.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres");
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
