import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPortalMember } from "@/lib/portal/get-member";
import PreviewBanner from "../_components/PreviewBanner";

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function PortalAsistenciaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { member, isPreview } = await getPortalMember(supabase, user.id);
  if (!member) redirect("/portal");

  const [{ data: attendances }, { data: stats }] = await Promise.all([
    supabase
      .from("attendances")
      .select("id, checked_in_at, checked_in_date")
      .eq("member_id", member.id)
      .order("checked_in_at", { ascending: false })
      .limit(60),
    supabase
      .from("vw_attendance_stats")
      .select("total_visits, visits_this_month, visits_last_7_days, last_visit")
      .eq("member_id", member.id)
      .maybeSingle(),
  ]);

  // Build 30-day heatmap
  const today = new Date();
  const days: { date: string; visited: boolean }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({
      date: dateStr,
      visited: attendances?.some((a) => a.checked_in_date === dateStr) ?? false,
    });
  }

  const visitCount = attendances?.length ?? 0;

  return (
    <div className="space-y-6">
      {isPreview && <PreviewBanner memberName={member.full_name} />}
      <div>
        <h1 className="font-display text-2xl uppercase tracking-tight">
          Mi Asistencia
        </h1>
        <p className="text-fg/40 text-sm mt-0.5">
          Historial de visitas al gimnasio
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/5 border border-line rounded-xl p-4">
          <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">
            Total visitas
          </p>
          <p className="font-display text-2xl">{stats?.total_visits ?? 0}</p>
        </div>
        <div className="bg-white/5 border border-line rounded-xl p-4">
          <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">
            Este mes
          </p>
          <p className="font-display text-2xl text-accent">
            {stats?.visits_this_month ?? 0}
          </p>
        </div>
        <div className="bg-white/5 border border-line rounded-xl p-4">
          <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">
            Últimos 7 días
          </p>
          <p className="font-display text-2xl">{stats?.visits_last_7_days ?? 0}</p>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-white/5 border border-line rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-fg/50 text-xs uppercase tracking-widest">
            Últimos 30 días
          </h2>
          <span className="text-fg/30 text-xs">
            {days.filter((d) => d.visited).length} días asistidos
          </span>
        </div>
        <div className="grid grid-cols-15 gap-1.5">
          {days.map((d) => (
            <div
              key={d.date}
              title={`${d.date}${d.visited ? " · Asististe" : ""}`}
              className={`aspect-square rounded-sm ${
                d.visited
                  ? "bg-accent"
                  : "bg-white/5 border border-line/40"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-fg/30">
          <div className="w-3 h-3 rounded-sm bg-white/5 border border-line/40" />
          <span>Sin visita</span>
          <div className="w-3 h-3 rounded-sm bg-accent ml-2" />
          <span>Asististe</span>
        </div>
      </div>

      {/* History list */}
      <div className="bg-white/5 border border-line rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="text-fg/50 text-xs uppercase tracking-widest">
            Historial reciente ({visitCount} registros)
          </h2>
        </div>
        {!attendances || attendances.length === 0 ? (
          <p className="text-fg/30 text-sm text-center py-12">
            Sin asistencias registradas
          </p>
        ) : (
          <div className="divide-y divide-line/40">
            {attendances.map((a) => (
              <div
                key={a.id}
                className="px-5 py-3 flex items-center justify-between text-sm"
              >
                <span>{fmtDate(a.checked_in_date)}</span>
                <span className="text-fg/40 text-xs">
                  {new Date(a.checked_in_at).toLocaleTimeString("es-EC", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
