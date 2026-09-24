import { createClient } from "@supabase/supabase-js";
import { ApiError, readJson } from "@/lib/api/handler";
import { registerMember, type RegisterInput } from "@/lib/services/registration";

// Auto-registro desde la app. Es la única ruta sin token: quien se registra aún
// no tiene cuenta. Devuelve la sesión para que la app entre directo (si la
// confirmación de email está desactivada, igual que en el portal web).
export async function POST(req: Request) {
  try {
    const input = await readJson<RegisterInput>(req);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    );
    const { session } = await registerMember(supabase, input);
    return Response.json({
      ok: true,
      data: {
        needsConfirmation: !session,
        session: session
          ? { access_token: session.access_token, refresh_token: session.refresh_token }
          : null,
      },
    });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 400;
    const message = err instanceof Error ? err.message : "No se pudo crear la cuenta";
    return Response.json({ ok: false, error: message }, { status });
  }
}
