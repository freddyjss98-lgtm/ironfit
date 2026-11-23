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

export type AppSignupInput = { fullName: string; email: string; password: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Registro desde la app (v1.1): cualquiera puede crear su cuenta para usar la
 * app con la membresía digital. Solo pide lo necesario (nombre, correo y
 * contraseña; las tiendas piden no exigir datos que la función no usa). El
 * trigger `handle_new_user` crea la ficha como `kind = 'app'`, ya revisada:
 * no es un socio nuevo que recepción deba atender, así que no se avisa al
 * staff. Si después compra en el gimnasio, su primera membresía la pasa a 'gym'.
 */
export async function registerAppUser(
  supabase: SupabaseClient,
  raw: AppSignupInput
): Promise<{ session: Session | null }> {
  const fullName = raw.fullName?.trim().replace(/\s+/g, " ");
  const email = raw.email?.trim().toLowerCase();
  const password = raw.password;

  if (!fullName || !email || !password) throw new Error("Completa tu nombre, correo y contraseña");
  if (fullName.length > 80) throw new Error("El nombre es demasiado largo");
  if (!EMAIL_RE.test(email)) throw new Error("El correo no es válido");
  if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, is_app_signup: true } },
  });
  if (error) {
    if (/already registered|already been registered/i.test(error.message)) {
      throw new Error("Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.");
    }
    throw new Error(error.message);
  }
  // Con la confirmación de correo activa, Supabase no avisa si el correo ya
  // existía: devuelve un usuario sin identidades.
  if (data.user && data.user.identities?.length === 0) {
    throw new Error("Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.");
  }

  return { session: data.session };
}
