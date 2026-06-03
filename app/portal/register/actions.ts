"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function registerMember(formData: FormData) {
  const fullName = formData.get("full_name") as string;
  const phone = formData.get("phone") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone: phone,
        is_self_register: true,
      },
    },
  });

  if (error) {
    redirect(
      `/portal/register?error=${encodeURIComponent(error.message)}`
    );
  }

  // Si hay sesión activa (confirmación de email desactivada) → directo al portal
  if (data.session) {
    redirect("/portal");
  }

  // Si requiere confirmación de email
  redirect("/portal/register?confirm=1");
}
