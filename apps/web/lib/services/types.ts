import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lo que necesita un servicio para actuar: el cliente del usuario (con su RLS)
 * y quién es. Lo arman las server actions (cookies) y la API de la app (token).
 */
export type ServiceCtx = {
  supabase: SupabaseClient;
  userId: string | null;
};
