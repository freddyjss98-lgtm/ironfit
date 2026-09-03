import { createClient } from "@/lib/supabase/server";
import { todayInEcuador } from "@/lib/date";
import RecordatoriosClient from "./RecordatoriosClient";

export const dynamic = "force-dynamic";

export default async function RecordatoriosPage() {
  const supabase = await createClient();

  // Ventana del historial: 30 días. Son unas cientos de filas en un gimnasio,
  // así que se mandan enteras al cliente y los filtros son instantáneos.
  const desde = new Date();
  desde.setDate(desde.getDate() - 30);

  const [membersRes, attendanceRes, plansRes, logsRes] = await Promise.all([
    supabase
      .from("vw_members_with_active_membership")
      .select(
        "id, full_name, phone, birthday, current_end_date, current_plan_name, membership_status, status, created_at"
      )
      .eq("status", "active")
      .order("full_name"),
    supabase.from("vw_attendance_stats").select("member_id, last_visit"),
    supabase
      .from("membership_plans")
      .select("id, name, price, duration_days, color")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("reminder_log")
      .select(
        "id, created_at, reminder_type, status, to_phone, error, error_code, delivered_at, members(full_name)"
      )
      .gte("created_at", desde.toISOString())
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  // Merge days-since-last-visit into each member (for inactivity detection)
  const lastVisit = new Map<string, string>();
  for (const r of (attendanceRes.data ?? []) as { member_id: string; last_visit: string | null }[]) {
    if (r.last_visit) lastVisit.set(r.member_id, r.last_visit);
  }
  // Se ancla al día de Ecuador, no a la hora UTC del servidor: si no, después
  // de las 19:00 locales los "días sin venir" salían corridos en uno.
  const todayMs = new Date(todayInEcuador() + "T00:00:00").getTime();
  const members = (membersRes.data ?? []).map((m) => {
    const last = lastVisit.get(m.id);
    const days_since_visit = last
      ? Math.round((todayMs - new Date(last + "T00:00:00").getTime()) / 86_400_000)
      : null;
    return { ...m, days_since_visit };
  });

  // PostgREST devuelve la relación to-one a veces como objeto y a veces como array.
  const logs = (logsRes.data ?? []).map((l) => {
    const rel = l.members as { full_name?: string } | { full_name?: string }[] | null;
    const m = Array.isArray(rel) ? rel[0] : rel;
    return {
      id: l.id as string,
      created_at: l.created_at as string,
      reminder_type: l.reminder_type as string,
      status: l.status as string,
      to_phone: (l.to_phone ?? null) as string | null,
      error: (l.error ?? null) as string | null,
      error_code: (l.error_code ?? null) as number | null,
      delivered_at: (l.delivered_at ?? null) as string | null,
      member_name: m?.full_name ?? null,
    };
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

      <RecordatoriosClient members={members} plans={plansRes.data ?? []} logs={logs} />
    </div>
  );
}
