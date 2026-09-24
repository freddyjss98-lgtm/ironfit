import { handle } from "@/lib/api/handler";
import { deleteMemberAccount } from "@/lib/services/account";

// El socio elimina su cuenta desde la app (Apple 5.1.1(v) / Google Play).
// El staff no: su cuenta la gestiona el admin desde el panel.
export async function DELETE(req: Request) {
  return handle(req, ["member"], ({ user }) => deleteMemberAccount(user.id));
}
