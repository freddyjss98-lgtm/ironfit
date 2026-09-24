import { handle, readJson } from "@/lib/api/handler";
import { checkInMember } from "@/lib/services/attendance";

// Registrar la entrada de un socio desde recepción (admin o coach).
export async function POST(req: Request) {
  return handle(req, ["admin", "coach"], async ({ supabase, user }) => {
    const { memberId } = await readJson<{ memberId: string }>(req);
    return checkInMember({ supabase, userId: user.id }, memberId);
  });
}
