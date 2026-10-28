import { handle, readJson } from "@/lib/api/handler";
import { pushToAdmins } from "@/lib/push/expo";
import { createAdminClient } from "@/lib/supabase/admin";

// La app ya guardó el reporte con la RPC report_post; esta ruta solo avisa a
// los admins por push para que lo revisen a tiempo (Apple pide < 24 h). Se
// confirma que el reporte existe y es de este socio para no mandar avisos falsos.
export async function POST(req: Request) {
  return handle(req, ["member"], async ({ supabase }) => {
    const { postId } = await readJson<{ postId?: string }>(req);
    if (!postId) throw new Error("Falta la publicación");

    const { data: memberId } = await supabase.rpc("current_member_id");
    if (!memberId) throw new Error("Perfil de miembro no encontrado");

    const { data: report } = await createAdminClient()
      .from("post_reports")
      .select("id")
      .eq("post_id", postId)
      .eq("member_id", memberId)
      .is("resolved_at", null)
      .maybeSingle();
    if (!report) throw new Error("No hay un reporte pendiente de esa publicación");

    await pushToAdmins({
      title: "⚠ Publicación reportada",
      body: "Un socio reportó una publicación de la comunidad. Revísala en Retos y comunidad.",
      data: { screen: "retos" },
    });
    return null;
  });
}
