"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function revalidate() {
  revalidatePath("/admin/planificaciones");
}

// ── Program types ─────────────────────────────────────────────────────────────

export async function createProgramType(name: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("program_types")
    .insert({ name: name.trim() })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidate();
  return data.id as string;
}

export async function setActiveProgramType(id: string) {
  const supabase = await createClient();
  // Clear all active flags first, then set the target
  await supabase.from("program_types").update({ is_active: false }).neq("id", id);
  const { error } = await supabase
    .from("program_types")
    .update({ is_active: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}

export async function deleteProgramType(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("program_types").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}

// ── Weekly programs ───────────────────────────────────────────────────────────

/** Snaps any date string to the Monday of that week (YYYY-MM-DD) */
function toMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay(); // 0=Sun
  const daysBack = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().split("T")[0];
}

export async function createWeeklyProgram(typeId: string, anyDateInWeek: string) {
  const supabase = await createClient();
  const weekStart = toMonday(anyDateInWeek);

  const { data: program, error } = await supabase
    .from("weekly_programs")
    .insert({ type_id: typeId, week_start: weekStart })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("Ya existe una semana para esa fecha en este tipo");
    throw new Error(error.message);
  }

  // Pre-create all 7 daily workout rows (day 0=Sun … day 6=Sat)
  const days = Array.from({ length: 7 }, (_, i) => ({
    program_id: program.id,
    day_of_week: i,
  }));
  const { error: dayError } = await supabase.from("daily_workouts").insert(days);
  if (dayError) throw new Error(dayError.message);

  revalidate();
  return program.id as string;
}

export async function deleteWeeklyProgram(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("weekly_programs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}

// ── Daily workouts ────────────────────────────────────────────────────────────

export async function saveDayWorkout(
  id: string,
  data: { warmup: string; strength: string; wod: string; accessories: string }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_workouts")
    .update({
      warmup: data.warmup.trim() || null,
      strength: data.strength.trim() || null,
      wod: data.wod.trim() || null,
      accessories: data.accessories.trim() || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}

export async function clearDayWorkout(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_workouts")
    .update({ warmup: null, strength: null, wod: null, accessories: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}
