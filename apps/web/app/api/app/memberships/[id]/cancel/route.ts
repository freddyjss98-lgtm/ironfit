import { handle, readJson } from "@/lib/api/handler";
import { cancelMembership, getMembershipSale } from "@/lib/services/memberships";

// Cobro ligado a la membresía: la app lo muestra para ofrecer anularlo al cancelar.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, ["admin"], ({ supabase, user }) =>
    getMembershipSale({ supabase, userId: user.id }, id)
  );
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, ["admin"], async ({ supabase, user }) => {
    const body = await readJson<{ reason?: string | null; voidSale?: boolean }>(req);
    await cancelMembership({ supabase, userId: user.id }, id, body.reason, body.voidSale === true);
  });
}
