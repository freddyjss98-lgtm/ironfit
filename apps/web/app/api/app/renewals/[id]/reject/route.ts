import { handle, readJson } from "@/lib/api/handler";
import { rejectRenewalRequest } from "@/lib/services/renewals";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, ["admin"], async ({ supabase, user }) => {
    const body = await readJson<{ reason?: string | null }>(req);
    await rejectRenewalRequest({ supabase, userId: user.id }, id, body.reason?.trim() || null);
  });
}
