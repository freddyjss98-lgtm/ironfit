import { handle, readJson } from "@/lib/api/handler";
import { createCounterSale, type CounterSaleInput } from "@/lib/services/sales";

// Venta rápida en mostrador: productos y/o membresías.
export async function POST(req: Request) {
  return handle(req, ["admin"], async ({ supabase, user }) => {
    const input = await readJson<CounterSaleInput>(req);
    return createCounterSale({ supabase, userId: user.id }, input);
  });
}
