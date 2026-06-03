import { createClient } from "@/lib/supabase/server";
import MembresiasList from "./MembresiasList";

export default async function MembresiasPage() {
  const supabase = await createClient();

  const [{ data: memberships }, { data: members }, { data: plans }] =
    await Promise.all([
      supabase
        .from("vw_memberships_status")
        .select(
          "id, member_id, plan_id, start_date, end_date, paid_amount, status, effective_status, days_until_expiry, members(full_name, phone), membership_plans(name, color, duration_days)"
        )
        .order("end_date", { ascending: false }),

      supabase
        .from("members")
        .select("id, full_name, phone")
        .eq("status", "active")
        .order("full_name"),

      supabase
        .from("membership_plans")
        .select("id, name, price, duration_days, color")
        .eq("active", true)
        .order("sort_order"),
    ]);

  // Flatten joined fields
  const rows = (memberships ?? []).map((m: any) => ({
    id: m.id,
    member_id: m.member_id,
    plan_id: m.plan_id,
    full_name: m.members?.full_name ?? "—",
    phone: m.members?.phone ?? "—",
    plan_name: m.membership_plans?.name ?? "—",
    plan_color: m.membership_plans?.color ?? "#555",
    plan_duration_days: m.membership_plans?.duration_days ?? 30,
    start_date: m.start_date,
    end_date: m.end_date,
    paid_amount: m.paid_amount ?? 0,
    status: m.status,
    effective_status: m.effective_status,
    days_until_expiry: m.days_until_expiry ?? 0,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Membresías</h2>
        <p className="text-fg/40 text-sm mt-0.5">{rows.length} registros</p>
      </div>

      <MembresiasList
        memberships={rows}
        members={members ?? []}
        plans={plans ?? []}
      />
    </div>
  );
}
