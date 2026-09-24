import { handle, readJson } from "@/lib/api/handler";
import { createRenewalRequest, type CreateRenewalInput } from "@/lib/services/renewals";

// El socio envía su solicitud con la ruta del comprobante ya subido a
// `payment-receipts` (la app lo sube directo a storage con su sesión).
export async function POST(req: Request) {
  return handle(req, ["member"], async ({ supabase, user }) => {
    const input = await readJson<CreateRenewalInput>(req);
    return createRenewalRequest({ supabase, userId: user.id }, input);
  });
}
