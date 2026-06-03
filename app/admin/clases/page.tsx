import { createClient } from "@/lib/supabase/server";
import ClasesClient from "./ClasesClient";

export default async function ClasesPage() {
  const supabase = await createClient();

  const [{ data: schedulesRaw }, { data: coaches }] = await Promise.all([
    supabase
      .from("class_schedules")
      .select("id, name, description, day_of_week, start_time, end_time, period, max_capacity, coach_id, active, coaches(full_name)")
      .order("day_of_week")
      .order("start_time"),

    supabase
      .from("coaches")
      .select("id, full_name, specialty")
      .eq("active", true)
      .order("full_name"),
  ]);

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

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Clases</h2>
        <p className="text-fg/40 text-sm mt-0.5">
          {schedules.filter((s) => s.active).length} activas · {coaches?.length ?? 0} coaches
        </p>
      </div>

      <ClasesClient schedules={schedules} coaches={coaches ?? []} />
    </div>
  );
}
