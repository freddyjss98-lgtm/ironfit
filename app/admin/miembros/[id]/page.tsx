import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import MemberDetailClient from "./MemberDetailClient";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!member) notFound();

  // Rol del staff que mira la ficha (para ocultar info sensible a coaches)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const role: "admin" | "coach" = me?.role === "coach" ? "coach" : "admin";

  const [
    { data: memberships },
    { data: attendances },
    { data: progress },
    { data: sales },
    { data: stats },
  ] = await Promise.all([
    supabase
      .from("vw_memberships_status")
      .select("id, start_date, end_date, paid_amount, status, effective_status, days_until_expiry, membership_plans(name, color)")
      .eq("member_id", id)
      .order("end_date", { ascending: false }),

    supabase
      .from("attendances")
      .select("id, checked_in_at, checked_in_date")
      .eq("member_id", id)
      .order("checked_in_at", { ascending: false })
      .limit(60),

    supabase
      .from("member_progress")
      .select("*")
      .eq("member_id", id)
      .order("measured_at", { ascending: false }),

    supabase
      .from("sales")
      .select("id, sale_date, total, payment_method, bank_reference, notes")
      .eq("member_id", id)
      .order("sale_date", { ascending: false })
      .limit(30),

    supabase
      .from("vw_attendance_stats")
      .select("*")
      .eq("member_id", id)
      .maybeSingle(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/miembros"
          className="text-fg/40 hover:text-fg text-sm transition-colors"
        >
          ← Miembros
        </Link>
      </div>

      <MemberDetailClient
        member={member}
        memberships={(memberships ?? []).map((m: any) => ({
          id: m.id,
          start_date: m.start_date,
          end_date: m.end_date,
          paid_amount: m.paid_amount,
          status: m.status,
          effective_status: m.effective_status,
          days_until_expiry: m.days_until_expiry,
          plan_name: m.membership_plans?.name ?? "—",
          plan_color: m.membership_plans?.color ?? "#999",
        }))}
        attendances={attendances ?? []}
        progress={progress ?? []}
        sales={sales ?? []}
        stats={stats ?? null}
        role={role}
      />
    </div>
  );
}
