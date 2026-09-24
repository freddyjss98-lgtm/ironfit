// Auto-registro de socios (portal web y app).

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { isValidCedula, normalizeCedula } from "@ironfit/shared/cedula";
import { pushToAdmins } from "@/lib/push/expo";

export type RegisterInput = {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  birthday: string;
  gender: string;
  cedula: string;
};

/**
 * Crea la cuenta del socio. El trigger `handle_new_user` crea la ficha en
 * `members` a partir de los metadatos (`is_self_register`).
 * Devuelve la sesión si la confirmación de email está desactivada.
 */
export async function registerMember(
  supabase: SupabaseClient,
  raw: RegisterInput
): Promise<{ session: Session | null }> {
  const fullName = raw.fullName?.trim();
  const phone = raw.phone?.trim();
  const email = raw.email?.trim();
  const password = raw.password;
  const birthday = raw.birthday || "";
  const gender = raw.gender || "";
  const cedula = normalizeCedula(raw.cedula || "");

  if (!fullName || !phone || !email || !password || !birthday || !gender || !cedula) {
    throw new Error("Completa todos los campos obligatorios");
  }
  if (!isValidCedula(cedula)) throw new Error("La cédula ingresada no es válida");

  // La cédula es única: avisar antes de crear la cuenta si ya está registrada.
  const { data: disponible } = await supabase.rpc("cedula_disponible", { p_cedula: cedula });
  if (disponible === false) throw new Error("Esa cédula ya está registrada");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
        birthday,
        gender,
        cedula,
        is_self_register: true,
      },
    },
  });
  if (error) throw new Error(error.message);

  await pushToAdmins({
    title: "Nuevo socio registrado",
    body: fullName,
    data: { screen: "members" },
  });

  return { session: data.session };
}
