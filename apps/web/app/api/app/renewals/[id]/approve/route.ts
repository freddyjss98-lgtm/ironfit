import { handle } from "@/lib/api/handler";
import { approveRenewalRequest } from "@/lib/services/renewals";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, ["admin"], ({ supabase, user }) =>
    approveRenewalRequest({ supabase, userId: user.id }, id)
  );
}
