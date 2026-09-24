import { handle, readJson } from "@/lib/api/handler";
import { renewMembership, type RenewMembershipInput } from "@/lib/services/memberships";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, ["admin"], async ({ supabase, user }) => {
    const input = await readJson<RenewMembershipInput>(req);
    return renewMembership({ supabase, userId: user.id }, id, input);
  });
}
