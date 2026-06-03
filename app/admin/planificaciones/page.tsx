import { createClient } from "@/lib/supabase/server";
import PlanificacionesClient from "./PlanificacionesClient";

interface PageProps {
  searchParams: Promise<{ typeId?: string; programId?: string }>;
}

export default async function PlanificacionesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  // All program types
  const { data: types } = await supabase
    .from("program_types")
    .select("id, name, is_active, sort_order")
    .order("sort_order")
    .order("name");

  const allTypes = types ?? [];

  // Resolve selected type (URL param → active → first)
  const activeType = allTypes.find((t) => t.is_active) ?? allTypes[0] ?? null;
  const selectedTypeId = params.typeId ?? activeType?.id ?? null;

  // All weekly programs for the selected type
  const weeksData = selectedTypeId
    ? await supabase
        .from("weekly_programs")
        .select("id, week_start, notes")
        .eq("type_id", selectedTypeId)
        .order("week_start", { ascending: false })
    : { data: [] };

  const allWeeks = (weeksData.data ?? []).map((w) => ({
    id: w.id as string,
    week_start: w.week_start as string,
    notes: (w.notes ?? null) as string | null,
  }));

  // Resolve selected program (URL param → most recent)
  const selectedProgramId = params.programId ?? allWeeks[0]?.id ?? null;

  // Daily workouts for the selected program
  const workoutsData = selectedProgramId
    ? await supabase
        .from("daily_workouts")
        .select("id, day_of_week, warmup, strength, wod, accessories")
        .eq("program_id", selectedProgramId)
    : { data: [] };

  const workouts = (workoutsData.data ?? []).map((w) => ({
    id: w.id as string,
    day_of_week: w.day_of_week as number,
    warmup: (w.warmup ?? "") as string,
    strength: (w.strength ?? "") as string,
    wod: (w.wod ?? "") as string,
    accessories: (w.accessories ?? "") as string,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Planificación Semanal</h2>
        <p className="text-fg/40 text-sm mt-0.5">Programa de entrenamiento por semana</p>
      </div>
      <PlanificacionesClient
        types={allTypes.map((t) => ({
          id: t.id as string,
          name: t.name as string,
          is_active: t.is_active as boolean,
        }))}
        weeks={allWeeks}
        workouts={workouts}
        selectedTypeId={selectedTypeId}
        selectedProgramId={selectedProgramId}
      />
    </div>
  );
}
