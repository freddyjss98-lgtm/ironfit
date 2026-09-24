"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { registerMember as register } from "@/lib/services/registration";

export async function registerMember(formData: FormData) {
  const supabase = await createClient();

  let hasSession = false;
  let error: string | null = null;
  try {
    const { session } = await register(supabase, {
      fullName: (formData.get("full_name") as string) ?? "",
      phone: (formData.get("phone") as string) ?? "",
      email: (formData.get("email") as string) ?? "",
      password: (formData.get("password") as string) ?? "",
      birthday: (formData.get("birthday") as string) ?? "",
      gender: (formData.get("gender") as string) ?? "",
      cedula: (formData.get("cedula") as string) ?? "",
    });
    hasSession = !!session;
  } catch (err) {
    error = err instanceof Error ? err.message : "No se pudo crear la cuenta";
  }

  // redirect() lanza una excepción propia de Next: va fuera del try.
  if (error) redirect(`/portal/register?error=${encodeURIComponent(error)}`);

  // Si hay sesión activa (confirmación de email desactivada) → directo al portal
  if (hasSession) redirect("/portal");

  // Si requiere confirmación de email
  redirect("/portal/register?confirm=1");
}
