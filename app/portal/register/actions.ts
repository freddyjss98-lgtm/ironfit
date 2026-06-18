"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isValidCedula, normalizeCedula } from "@/lib/cedula";

export async function registerMember(formData: FormData) {
  const fullName = (formData.get("full_name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const birthday = (formData.get("birthday") as string) || "";
  const gender = (formData.get("gender") as string) || "";
  const cedula = normalizeCedula((formData.get("cedula") as string) || "");

  if (!fullName || !phone || !email || !password || !birthday || !gender || !cedula) {
    redirect(
      `/portal/register?error=${encodeURIComponent("Completa todos los campos obligatorios")}`
    );
  }

  if (!isValidCedula(cedula)) {
    redirect(
      `/portal/register?error=${encodeURIComponent("La cédula ingresada no es válida")}`
    );
  }

  const supabase = await createClient();

  // La cédula es única: avisar antes de crear la cuenta si ya está registrada.
  const { data: disponible } = await supabase.rpc("cedula_disponible", {
    p_cedula: cedula,
  });
  if (disponible === false) {
    redirect(
      `/portal/register?error=${encodeURIComponent("Esa cédula ya está registrada")}`
    );
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone: phone,
        birthday: birthday,
        gender: gender,
        cedula: cedula,
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
