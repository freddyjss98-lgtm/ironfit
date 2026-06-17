import { createClient } from "@/lib/supabase/server";
import ClasesClient from "./ClasesClient";

// Suma días a "YYYY-MM-DD" de forma determinista (UTC)
function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().split("T")[0];
}

export default async function ClasesPage() {
  const supabase = await createClient();

  const [{ data: schedulesRaw }, { data: coaches }, { data: types }] = await Promise.all([
    supabase
      .from("class_schedules")
      .select(
        "id, name, description, day_of_week, start_time, end_time, period, max_capacity, coach_id, active, coaches(full_name)"
      )
      .order("day_of_week")
      .order("start_time"),
    supabase
      .from("coaches")
      .select("id, full_name, specialty")
      .eq("active", true)
      .order("full_name"),
    supabase
      .from("program_types")
      .select("id, name, is_active, sort_order")
      .order("sort_order")
      .order("name"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schedules = (schedulesRaw ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    period: s.period,
    max_capacity: s.max_capacity,
    coach_id: s.coach_id,
    coach_name: s.coaches?.full_name ?? null,
    active: s.active,
  }));

  // ── WODs del programa activo, mapeados por fecha real ──────────────────────
  const allTypes = types ?? [];
  const activeType = allTypes.find((t) => t.is_active) ?? allTypes[0] ?? null;
  const wodByDate: Record<string, string> = {};

  if (activeType) {
    const { data: weeks } = await supabase
      .from("weekly_programs")
      .select("id, week_start")
      .eq("type_id", activeType.id);

    const weekStartById: Record<string, string> = {};
    for (const w of weeks ?? []) weekStartById[w.id as string] = w.week_start as string;
    const weekIds = Object.keys(weekStartById);

    if (weekIds.length > 0) {
      const { data: workouts } = await supabase
        .from("daily_workouts")
        .select("program_id, day_of_week, content")
        .in("program_id", weekIds);

      for (const w of workouts ?? []) {
        const ws = weekStartById[w.program_id as string];
        if (!ws) continue;
        const dow = w.day_of_week as number;
        const date = addDaysStr(ws, dow === 0 ? 6 : dow - 1);
        const c = (w.content ?? "") as string;
        if (c) wodByDate[date] = c;
      }
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Clases y planificación</h2>
        <p className="text-fg/40 text-sm mt-0.5">
          {schedules.filter((s) => s.active).length} clases activas · {coaches?.length ?? 0} coaches
          {activeType ? ` · Programa: ${activeType.name}` : ""}
        </p>
      </div>

      <ClasesClient schedules={schedules} coaches={coaches ?? []} wodByDate={wodByDate} />
    </div>
  );
}
