import { handle } from "@/lib/api/handler";
import { getDashboardStats } from "@/lib/supabase/queries";

// Resumen del día para el admin (mismos datos que /admin).
export async function GET(req: Request) {
  return handle(req, ["admin"], ({ supabase }) => getDashboardStats(supabase));
}
