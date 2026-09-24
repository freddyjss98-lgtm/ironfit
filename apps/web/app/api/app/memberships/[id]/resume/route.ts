import { handle } from "@/lib/api/handler";
import { resumeMembership } from "@/lib/services/memberships";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, ["admin"], ({ supabase, user }) =>
    resumeMembership({ supabase, userId: user.id }, id)
  );
}
