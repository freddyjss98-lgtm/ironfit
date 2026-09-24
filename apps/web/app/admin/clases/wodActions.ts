"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Helpers deterministas (UTC) sobre "YYYY-MM-DD"
function toMonday(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0=Dom
  const back = dow === 0 ? 6 : dow - 1;
  dt.setUTCDate(dt.getUTCDate() - back);
  return dt.toISOString().split("T")[0];
}

function dowOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Guarda el WOD de un día concreto: resuelve el programa activo y crea la
// semana / el día automáticamente si no existen.
export async function saveDayPlan(dateStr: string, content: string) {
  const supabase = await createClient();

  // 1) Programa activo (o el primero; si no hay ninguno, crea "General")
  const { data: types } = await supabase
    .from("program_types")
    .select("id, is_active, sort_order")
    .order("sort_order");

  let typeId =
    (types ?? []).find((t) => t.is_active)?.id ?? (types ?? [])[0]?.id ?? null;

  if (!typeId) {
    const { data: created, error } = await supabase
      .from("program_types")
      .insert({ name: "General", is_active: true })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    typeId = created.id as string;
  }

  // 2) Semana (lunes) del día → crearla si no existe (+ 7 días)
  const monday = toMonday(dateStr);
  let weekId: string;
  const { data: existingWeek } = await supabase
    .from("weekly_programs")
    .select("id")
    .eq("type_id", typeId)
    .eq("week_start", monday)
    .maybeSingle();

  if (existingWeek) {
    weekId = existingWeek.id as string;
  } else {
    const { data: newWeek, error } = await supabase
      .from("weekly_programs")
      .insert({ type_id: typeId, week_start: monday })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    weekId = newWeek.id as string;
    const days = Array.from({ length: 7 }, (_, i) => ({ program_id: weekId, day_of_week: i }));
    await supabase.from("daily_workouts").insert(days);
  }

  // 3) El día (day_of_week) → crearlo si faltara
  const dow = dowOf(dateStr);
  let dayId: string;
  const { data: existingDay } = await supabase
    .from("daily_workouts")
    .select("id")
    .eq("program_id", weekId)
    .eq("day_of_week", dow)
    .maybeSingle();

  if (existingDay) {
    dayId = existingDay.id as string;
  } else {
    const { data: newDay, error } = await supabase
      .from("daily_workouts")
      .insert({ program_id: weekId, day_of_week: dow })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    dayId = newDay.id as string;
  }

  // 4) Guardar el WOD (un solo bloque de texto enriquecido)
  const { error: updErr } = await supabase
    .from("daily_workouts")
    .update({ content: content.trim() || null })
    .eq("id", dayId);
  if (updErr) throw new Error(updErr.message);

  revalidatePath("/admin/clases");
}
