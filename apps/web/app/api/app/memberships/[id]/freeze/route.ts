import { handle } from "@/lib/api/handler";
import { freezeMembership } from "@/lib/services/memberships";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, ["admin"], ({ supabase, user }) =>
    freezeMembership({ supabase, userId: user.id }, id)
  );
}
