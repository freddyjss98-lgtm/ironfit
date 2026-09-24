// =============================================================================
// API de la app móvil (/api/app/*)
// =============================================================================
// La app no tiene cookies de sesión: manda el access token de Supabase en
// `Authorization: Bearer <jwt>`. Con ese token se crea un cliente que actúa
// COMO el usuario (el RLS aplica igual que en la web) y se valida el rol en
// `profiles` antes de ejecutar nada.
//
// A diferencia de las server actions del panel web — que confían en que el
// middleware esconda las páginas — aquí cada ruta declara quién puede usarla.
// =============================================================================

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export type Role = "admin" | "coach" | "member";

export type AppContext = {
  supabase: SupabaseClient;
  user: User;
  role: Role;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

function clientForToken(token: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }
  );
}

async function authenticate(req: Request): Promise<AppContext> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new ApiError(401, "Falta el token de sesión");

  const supabase = clientForToken(token);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) throw new ApiError(401, "Sesión inválida o vencida");

  // Mismo criterio que middleware.ts: solo 'admin' y 'coach' son staff; sin
  // fila en profiles (o con otro rol) se trata como socio.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role: Role =
    profile?.role === "admin" ? "admin" : profile?.role === "coach" ? "coach" : "member";

  return { supabase, user, role };
}

/**
 * Envuelve una ruta de la API: autentica, comprueba el rol y convierte el
 * resultado en JSON. Los errores de negocio (`throw new Error("...")` en los
 * servicios) llegan a la app con su mensaje y status 400.
 */
export async function handle<T>(
  req: Request,
  allowed: Role[],
  fn: (ctx: AppContext) => Promise<T>
): Promise<Response> {
  try {
    const ctx = await authenticate(req);
    if (!allowed.includes(ctx.role)) {
      throw new ApiError(403, "No tienes permiso para esta acción");
    }
    const data = await fn(ctx);
    return Response.json({ ok: true, data: data ?? null });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 400;
    const message = err instanceof Error ? err.message : "Error inesperado";
    if (status >= 500 || !(err instanceof Error)) console.error("[api/app]", err);
    return Response.json({ ok: false, error: message }, { status });
  }
}

/** Lee el cuerpo JSON; un cuerpo vacío o inválido es un 400 con mensaje claro. */
export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "El cuerpo de la petición no es JSON válido");
  }
}
