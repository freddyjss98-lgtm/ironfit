"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayInEcuador } from "@/lib/date";

const MUSCLES = [
  "pectoral", "triceps", "pierna", "pantorrilla", "espalda", "biceps", "hombro", "otros",
] as const;

export type SessionEntry = {
  exerciseId: string;
  sets: { weight: number; reps: number }[];
};
export type SaveSessionInput = {
  memberId?: string | null; // si viene, es un coach registrando por el socio
  sessionDate: string;
  notes?: string;
  entries: SessionEntry[];
};

async function resolveContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const [{ data: ownMember }, { data: staff }] = await Promise.all([
    supabase.from("members").select("id").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("id").eq("id", user.id).maybeSingle(),
  ]);
  return { supabase, user, ownMemberId: ownMember?.id ?? null, isStaff: !!staff };
}

function refresh() {
  revalidatePath("/portal/progreso");
  revalidatePath("/admin/miembros", "layout");
}

/** Guarda una sesión de entrenamiento con sus series. */
export async function saveWorkoutSession(input: SaveSessionInput) {
  const { supabase, user, ownMemberId, isStaff } = await resolveContext();

  const memberId = input.memberId ?? ownMemberId;
  if (!memberId) throw new Error("No se encontró el socio");
  if (input.memberId && input.memberId !== ownMemberId && !isStaff) {
    throw new Error("No autorizado para registrar por otro socio");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.sessionDate)) throw new Error("Fecha inválida");
  if (input.sessionDate > todayInEcuador()) throw new Error("La fecha no puede ser futura");

  // Series válidas: reps > 0 (el peso puede ser 0 en peso corporal). Si el mismo
  // ejercicio viene repetido en el formulario, se fusionan sus series para no
  // duplicar la numeración (set 1, set 1…).
  const merged = new Map<string, { weight: number; reps: number }[]>();
  for (const e of input.entries) {
    if (!e.exerciseId) continue;
    const sets = e.sets.filter((s) => s.reps > 0);
    if (sets.length === 0) continue;
    if (!merged.has(e.exerciseId)) merged.set(e.exerciseId, []);
    merged.get(e.exerciseId)!.push(...sets);
  }
  const entries = Array.from(merged, ([exerciseId, sets]) => ({ exerciseId, sets }));

  if (entries.length === 0) throw new Error("Agrega al menos una serie con repeticiones");
  const totalSets = entries.reduce((a, e) => a + e.sets.length, 0);
  if (totalSets > 200) throw new Error("Demasiadas series en una sola sesión");

  const { data: session, error: sErr } = await supabase
    .from("workout_sessions")
    .insert({
      member_id: memberId,
      session_date: input.sessionDate,
      notes: input.notes?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (sErr || !session) throw new Error(sErr?.message ?? "No se pudo crear la sesión");

  const rows = entries.flatMap((e) =>
    e.sets.map((s, i) => ({
      session_id: session.id,
      exercise_id: e.exerciseId,
      set_number: i + 1,
      weight_kg: Math.max(0, Math.round(s.weight * 100) / 100),
      reps: Math.max(0, Math.round(s.reps)),
    }))
  );

  const { error: setErr } = await supabase.from("workout_sets").insert(rows);
  if (setErr) {
    // Deshace la sesión si fallan las series (evita sesiones vacías).
    await supabase.from("workout_sessions").delete().eq("id", session.id);
    throw new Error(setErr.message);
  }

  refresh();
}

/** Elimina una sesión completa (con sus series). */
export async function deleteWorkoutSession(sessionId: string) {
  const { supabase } = await resolveContext();
  const { error } = await supabase.from("workout_sessions").delete().eq("id", sessionId);
  if (error) throw new Error(error.message);
  refresh();
}

/** Crea un ejercicio personal para un socio. */
export async function createPersonalExercise(
  name: string,
  muscleGroup: string,
  memberId?: string | null
) {
  const { supabase, user, ownMemberId, isStaff } = await resolveContext();

  const target = memberId ?? ownMemberId;
  if (!target) throw new Error("No se encontró el socio");
  if (memberId && memberId !== ownMemberId && !isStaff) throw new Error("No autorizado");

  const clean = name.trim();
  if (!clean) throw new Error("Escribe el nombre del ejercicio");
  if (!MUSCLES.includes(muscleGroup as (typeof MUSCLES)[number])) {
    throw new Error("Grupo muscular inválido");
  }

  // Evitar duplicados: mismo nombre en el catálogo global o en los propios del socio.
  const pattern = clean.replace(/[%_\\]/g, "\\$&");
  const { data: dupe } = await supabase
    .from("exercises")
    .select("id")
    .eq("muscle_group", muscleGroup)
    .ilike("name", pattern)
    .or(`is_global.eq.true,member_id.eq.${target}`)
    .limit(1)
    .maybeSingle();
  if (dupe) throw new Error("Ese ejercicio ya existe en el catálogo");

  const { data, error } = await supabase
    .from("exercises")
    .insert({
      name: clean,
      muscle_group: muscleGroup,
      is_global: false,
      member_id: target,
      created_by: user.id,
    })
    .select("id, name, muscle_group, is_global")
    .single();
  if (error) throw new Error(error.message);

  refresh();
  return data;
}

// ── Rutinas (plantillas) ──────────────────────────────────────────────────────

export type RoutineInput = {
  memberId?: string | null;
  name: string;
  notes?: string;
  exercises: { exerciseId: string; targetSets?: number | null; targetReps?: number | null }[];
};

/** Crea una rutina (plantilla) para un socio, con sus ejercicios. */
export async function createRoutine(input: RoutineInput) {
  const { supabase, user, ownMemberId, isStaff } = await resolveContext();

  const memberId = input.memberId ?? ownMemberId;
  if (!memberId) throw new Error("No se encontró el socio");
  if (input.memberId && input.memberId !== ownMemberId && !isStaff) throw new Error("No autorizado");

  const name = input.name.trim();
  if (!name) throw new Error("Ponle un nombre a la rutina");
  const exercises = input.exercises.filter((e) => e.exerciseId);
  if (exercises.length === 0) throw new Error("Agrega al menos un ejercicio a la rutina");

  const { data: routine, error } = await supabase
    .from("routines")
    .insert({ member_id: memberId, name, notes: input.notes?.trim() || null, created_by: user.id })
    .select("id")
    .single();
  if (error || !routine) throw new Error(error?.message ?? "No se pudo crear la rutina");

  const rows = exercises.map((e, i) => ({
    routine_id: routine.id,
    exercise_id: e.exerciseId,
    position: i,
    target_sets: e.targetSets && e.targetSets > 0 ? e.targetSets : null,
    target_reps: e.targetReps && e.targetReps > 0 ? e.targetReps : null,
  }));
  const { error: reErr } = await supabase.from("routine_exercises").insert(rows);
  if (reErr) {
    await supabase.from("routines").delete().eq("id", routine.id);
    throw new Error(reErr.message);
  }

  refresh();
}

export async function deleteRoutine(routineId: string) {
  const { supabase } = await resolveContext();
  const { error } = await supabase.from("routines").delete().eq("id", routineId);
  if (error) throw new Error(error.message);
  refresh();
}
