import { createClient } from "@/lib/supabase/server";
import RenovacionesClient from "./RenovacionesClient";

export default async function RenovacionesPage() {
  const supabase = await createClient();

  const [{ data: requests }, { data: settings }] = await Promise.all([
    supabase
      .from("renewal_requests")
      .select(
        "id, amount, payment_method, receipt_url, member_note, admin_note, status, created_at, reviewed_at, members(full_name, phone), membership_plans(name, duration_days)"
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("gym_settings").select("*").eq("id", 1).maybeSingle(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = ((requests ?? []) as any[]).map((r) => ({
    id: r.id as string,
    amount: Number(r.amount ?? 0),
    payment_method: r.payment_method as string,
    receipt_url: (r.receipt_url ?? null) as string | null,
    member_note: (r.member_note ?? null) as string | null,
    admin_note: (r.admin_note ?? null) as string | null,
    status: r.status as string,
    created_at: r.created_at as string,
    reviewed_at: (r.reviewed_at ?? null) as string | null,
    member_name: (r.members?.full_name ?? "—") as string,
    member_phone: (r.members?.phone ?? "") as string,
    plan_name: (r.membership_plans?.name ?? "—") as string,
    plan_days: Number(r.membership_plans?.duration_days ?? 0),
  }));

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Renovaciones</h2>
        <p className="text-fg/40 text-sm mt-0.5">
          {pendingCount} solicitud{pendingCount !== 1 ? "es" : ""} pendiente
          {pendingCount !== 1 ? "s" : ""} de revisión
        </p>
      </div>

      <RenovacionesClient requests={rows} settings={settings ?? null} />
    </div>
  );
}
