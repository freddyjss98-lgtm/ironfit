import { handle } from "@/lib/api/handler";

// Quién es el usuario de la sesión: la app lo usa para elegir el modo
// (socio, coach o admin) al abrir.
export async function GET(req: Request) {
  return handle(req, ["admin", "coach", "member"], async ({ supabase, user, role }) => {
    const { data: member } = await supabase
      .from("members")
      .select("id, full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    return {
      userId: user.id,
      email: user.email ?? null,
      role,
      memberId: (member?.id as string | undefined) ?? null,
      fullName: (member?.full_name as string | undefined) ?? null,
      mustChangePassword: user.user_metadata?.must_change_password === true,
    };
  });
}
