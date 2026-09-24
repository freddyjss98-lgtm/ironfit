import { handle, readJson } from "@/lib/api/handler";
import { createMembership, type CreateMembershipInput } from "@/lib/services/memberships";

// Cobrar una membresía nueva (se encadena si el socio ya tiene una vigente).
export async function POST(req: Request) {
  return handle(req, ["admin"], async ({ supabase, user }) => {
    const input = await readJson<CreateMembershipInput>(req);
    return createMembership({ supabase, userId: user.id }, input);
  });
}
