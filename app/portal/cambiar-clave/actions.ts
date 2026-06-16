"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function updatePassword(formData: FormData) {
  const password = formData.get("password") as string;
  const confirm = formData.get("confirm") as string;

  if (!password || password.length < 6) {
    redirect(
      `/portal/cambiar-clave?error=${encodeURIComponent("La contraseña debe tener al menos 6 caracteres")}`
    );
  }
  if (password !== confirm) {
    redirect(
      `/portal/cambiar-clave?error=${encodeURIComponent("Las contraseñas no coinciden")}`
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { error } = await supabase.auth.updateUser({
    password,
    data: { must_change_password: false },
  });

  if (error) {
    redirect(`/portal/cambiar-clave?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/portal");
}
