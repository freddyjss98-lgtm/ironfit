import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con service role — omite RLS.
 *
 * SOLO para uso en el servidor (cron, tareas de fondo) donde no hay sesión de
 * usuario. Nunca debe exponerse al navegador. La clave vive en
 * SUPABASE_SERVICE_ROLE_KEY (no en una variable NEXT_PUBLIC_*).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
