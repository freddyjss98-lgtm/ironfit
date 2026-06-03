import { createClient } from "@/lib/supabase/server";
import RecordatoriosClient from "./RecordatoriosClient";

export const dynamic = "force-dynamic";

export default async function RecordatoriosPage() {
  const supabase = await createClient();

  const [membersRes, attendanceRes] = await Promise.all([
    supabase
      .from("vw_members_with_active_membership")
      .select(
        "id, full_name, phone, birthday, current_end_date, current_plan_name, membership_status, status, created_at"
      )
      .eq("status", "active")
      .order("full_name"),
    supabase.from("vw_attendance_stats").select("member_id, last_visit"),
  ]);

  // Merge days-since-last-visit into each member (for inactivity detection)
  const lastVisit = new Map<string, string>();
  for (const r of (attendanceRes.data ?? []) as { member_id: string; last_visit: string | null }[]) {
    if (r.last_visit) lastVisit.set(r.member_id, r.last_visit);
  }
  const todayMs = Date.now();
  const members = (membersRes.data ?? []).map((m) => {
    const last = lastVisit.get(m.id);
    const days_since_visit = last
      ? Math.round((todayMs - new Date(last + "T00:00:00").getTime()) / 86_400_000)
      : null;
    return { ...m, days_since_visit };
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">
          Recordatorios
        </h2>
        <p className="text-fg/40 text-sm mt-0.5">
          Mensajes WhatsApp para membresías, cumpleaños e inactividad
        </p>
      </div>

      <RecordatoriosClient members={members} />
    </div>
  );
}
