// Configuración de la app. Son los mismos valores públicos que usa la web
// (la clave "anon" de Supabase va dentro de cualquier app cliente por diseño:
// lo que protege los datos es el RLS). Se pueden sobreescribir con variables
// EXPO_PUBLIC_* para apuntar a otro entorno.

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://knygkpawixvacdiqpbwn.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_CPftdp6mka0jkVQHKxp5CA_zqj_qXLi";

/** Backend Next (API /api/app/*). */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://www.ironfitclub.org";

/** Panel web, para quien no es socio. */
export const WEB_URL = "https://www.ironfitclub.org";
