import { ApiError, handle, readJson } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";

type Body = { token?: string; platform?: string };

function validToken(token: string | undefined): token is string {
  return !!token && /^(Exponent|Expo)PushToken\[.+\]$/.test(token);
}

// Registra el token push del dispositivo para el usuario de la sesión. Va por
// el servidor (service role) porque un mismo teléfono puede cambiar de cuenta:
// el token pasa al usuario actual, y eso el RLS no se lo permite al cliente.
export async function POST(req: Request) {
  return handle(req, ["admin", "coach", "member"], async ({ user }) => {
    const { token, platform } = await readJson<Body>(req);
    if (!validToken(token)) throw new ApiError(400, "Token push inválido");
    if (platform !== "ios" && platform !== "android") throw new ApiError(400, "Plataforma inválida");

    const { error } = await createAdminClient()
      .from("push_tokens")
      .upsert({ token, platform, user_id: user.id }, { onConflict: "token" });
    if (error) throw new Error(error.message);
  });
}

// Al cerrar sesión: el teléfono deja de recibir avisos de esa cuenta.
export async function DELETE(req: Request) {
  return handle(req, ["admin", "coach", "member"], async ({ user }) => {
    const { token } = await readJson<Body>(req);
    if (!validToken(token)) throw new ApiError(400, "Token push inválido");

    const { error } = await createAdminClient()
      .from("push_tokens")
      .delete()
      .eq("token", token)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  });
}
