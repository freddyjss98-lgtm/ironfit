import { createClient } from "@/lib/supabase/server";
import AsistenciaClient from "./AsistenciaClient";

export const dynamic = "force-dynamic";

export default async function AsistenciaPage() {
  const supabase = await createClient();

  const [{ data: members }, { data: today }, { data: stats }] = await Promise.all([
    supabase
      .from("vw_members_with_active_membership")
      .select("id, full_name, phone, status, membership_status, current_end_date")
      .eq("status", "active")
      .order("full_name"),

    supabase
      .from("vw_attendance_today")
      .select("*"),

    supabase
      .from("vw_attendance_stats")
      .select("member_id, total_visits, visits_this_month, visits_last_7_days, last_visit"),
  ]);

  // Roster con stats de asistencia por atleta (incluye a quienes nunca han venido)
  const statsMap = new Map(
    ((stats ?? []) as {
      member_id: string;
      total_visits: number;
      visits_this_month: number;
      visits_last_7_days: number;
      last_visit: string | null;
    }[]).map((s) => [s.member_id, s])
  );
  const roster = (members ?? []).map((m) => {
    const s = statsMap.get(m.id);
    return {
      id: m.id,
      full_name: m.full_name,
      phone: m.phone,
      total_visits: s?.total_visits ?? 0,
      visits_this_month: s?.visits_this_month ?? 0,
      visits_last_7_days: s?.visits_last_7_days ?? 0,
      last_visit: s?.last_visit ?? null,
    };
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Asistencia</h2>
        <p className="text-fg/40 text-sm mt-0.5">
          Registra entradas al gym en tiempo real
        </p>
      </div>

      <AsistenciaClient
        members={members ?? []}
        todayAttendances={(today ?? []) as any}
        roster={roster}
      />
    </div>
  );
}
