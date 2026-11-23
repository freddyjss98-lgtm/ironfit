import { createClient } from "@supabase/supabase-js";
import { ApiError, readJson } from "@/lib/api/handler";
import { registerAppUser, type AppSignupInput } from "@/lib/services/registration";

// Registro abierto desde la app (v1.1, membresía digital). Sin token: quien se
// registra aún no tiene cuenta. /api/app/register queda igual para la app 1.0
// que ya está en las tiendas (registro de socio del gimnasio, con cédula).
export async function POST(req: Request) {
  try {
    const input = await readJson<AppSignupInput>(req);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    );
    const { session } = await registerAppUser(supabase, input);
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
