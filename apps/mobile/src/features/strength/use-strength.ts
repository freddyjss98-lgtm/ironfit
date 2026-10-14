// Registro de fuerza (sesiones con series, ejercicios propios y rutinas).
// Mismas tablas y reglas que apps/web/app/_actions/workout.ts.

import { todayInEcuador } from '@ironfit/shared/date';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export const MUSCLES = [
  { key: 'pectoral', label: 'Pectoral' },
  { key: 'espalda', label: 'Espalda' },
  { key: 'pierna', label: 'Pierna' },
  { key: 'hombro', label: 'Hombro' },
  { key: 'biceps', label: 'Bíceps' },
  { key: 'triceps', label: 'Tríceps' },
  { key: 'pantorrilla', label: 'Pantorrilla' },
  { key: 'otros', label: 'Otros' },
] as const;

export const muscleLabel = (k: string) => MUSCLES.find((m) => m.key === k)?.label ?? k;

export type Exercise = { id: string; name: string; muscle_group: string; is_global: boolean };
export type WorkoutSet = { exercise_id: string; set_number: number; weight_kg: number; reps: number };
export type Session = { id: string; session_date: string; notes: string | null; sets: WorkoutSet[] };
export type Routine = {
  id: string;
  name: string;
  exercises: { exercise_id: string; position: number; target_sets: number | null; target_reps: number | null }[];
};

export function useStrength(memberId: string) {
  return useQuery({
    queryKey: ['strength', memberId],
    queryFn: async () => {
      const [ex, sessions, routines] = await Promise.all([
        supabase
          .from('exercises')
          .select('id, name, muscle_group, is_global')
          .or(`is_global.eq.true,member_id.eq.${memberId}`)
          .order('name'),
        supabase
          .from('workout_sessions')
          .select('id, session_date, notes, workout_sets(exercise_id, set_number, weight_kg, reps)')
          .eq('member_id', memberId)
          .order('session_date', { ascending: false }),
        supabase
          .from('routines')
          .select('id, name, routine_exercises(exercise_id, position, target_sets, target_reps)')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false }),
      ]);
      const failed = [ex, sessions, routines].find((r) => r.error);
      if (failed?.error) throw failed.error;
      return {
        exercises: (ex.data ?? []) as Exercise[],
        sessions: (sessions.data ?? []).map((s) => ({
          id: s.id as string,
          session_date: s.session_date as string,
          notes: (s.notes ?? null) as string | null,
          sets: ((s.workout_sets ?? []) as WorkoutSet[]).map((x) => ({
            ...x,
            weight_kg: Number(x.weight_kg) || 0,
            reps: Number(x.reps) || 0,
          })),
        })) as Session[],
        routines: (routines.data ?? []).map((r) => ({
          id: r.id as string,
          name: r.name as string,
          exercises: ((r.routine_exercises ?? []) as Routine['exercises']).sort((a, b) => a.position - b.position),
        })) as Routine[],
      };
    },
  });
}

/** 1RM estimado (Epley), como en la web. */
export const est1RM = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30));

export type Entry = { exerciseId: string; sets: { weight: string; reps: string }[] };

function useInvalidate(memberId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['strength', memberId] });
}

export function useSaveSession(memberId: string, userId: string) {
  const invalidate = useInvalidate(memberId);
  return useMutation({
    mutationFn: async ({ date, notes, entries }: { date: string; notes: string; entries: Entry[] }) => {
      if (date > todayInEcuador()) throw new Error('La fecha no puede ser futura.');
      // Series válidas: reps > 0 (el peso puede ser 0 en peso corporal). El mismo
      // ejercicio repetido se fusiona para no duplicar la numeración.
      const merged = new Map<string, { weight: number; reps: number }[]>();
      for (const e of entries) {
        if (!e.exerciseId) continue;
        const sets = e.sets
          .map((s) => ({ weight: Number(s.weight.replace(',', '.')) || 0, reps: Math.round(Number(s.reps) || 0) }))
          .filter((s) => s.reps > 0);
        if (!sets.length) continue;
        merged.set(e.exerciseId, [...(merged.get(e.exerciseId) ?? []), ...sets]);
      }
      if (merged.size === 0) throw new Error('Agrega al menos una serie con repeticiones.');

      const { data: session, error } = await supabase
        .from('workout_sessions')
        .insert({ member_id: memberId, session_date: date, notes: notes.trim() || null, created_by: userId })
        .select('id')
        .single();
      if (error || !session) throw new Error(error?.message ?? 'No se pudo crear la sesión.');

      const rows = Array.from(merged).flatMap(([exerciseId, sets]) =>
        sets.map((s, i) => ({
          session_id: session.id,
          exercise_id: exerciseId,
          set_number: i + 1,
          weight_kg: Math.max(0, Math.round(s.weight * 100) / 100),
          reps: s.reps,
        }))
      );
      const { error: setErr } = await supabase.from('workout_sets').insert(rows);
      if (setErr) {
        // Sin series no debe quedar una sesión vacía.
        await supabase.from('workout_sessions').delete().eq('id', session.id);
        throw new Error(setErr.message);
      }
    },
    onSuccess: invalidate,
  });
}

export function useDeleteSession(memberId: string) {
  const invalidate = useInvalidate(memberId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workout_sessions').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useCreateExercise(memberId: string, userId: string) {
  const invalidate = useInvalidate(memberId);
  return useMutation({
    mutationFn: async ({ name, muscle }: { name: string; muscle: string }): Promise<Exercise> => {
      const clean = name.trim();
      if (!clean) throw new Error('Escribe el nombre del ejercicio.');
      const pattern = clean.replace(/[%_\\]/g, '\\$&');
      const { data: dupe } = await supabase
        .from('exercises')
        .select('id')
        .eq('muscle_group', muscle)
        .ilike('name', pattern)
        .or(`is_global.eq.true,member_id.eq.${memberId}`)
        .limit(1)
        .maybeSingle();
      if (dupe) throw new Error('Ese ejercicio ya existe en el catálogo.');
      const { data, error } = await supabase
        .from('exercises')
        .insert({ name: clean, muscle_group: muscle, is_global: false, member_id: memberId, created_by: userId })
        .select('id, name, muscle_group, is_global')
        .single();
      if (error) throw new Error(error.message);
      return data as Exercise;
    },
    onSuccess: invalidate,
  });
}

export function useCreateRoutine(memberId: string, userId: string) {
  const invalidate = useInvalidate(memberId);
  return useMutation({
    mutationFn: async ({
      name,
      exercises,
    }: {
      name: string;
      exercises: { exerciseId: string; targetSets: number | null; targetReps: number | null }[];
    }) => {
      if (!name.trim()) throw new Error('Ponle un nombre a la rutina.');
      const list = exercises.filter((e) => e.exerciseId);
      if (!list.length) throw new Error('Agrega al menos un ejercicio a la rutina.');
      const { data: routine, error } = await supabase
        .from('routines')
        .insert({ member_id: memberId, name: name.trim(), created_by: userId })
        .select('id')
        .single();
      if (error || !routine) throw new Error(error?.message ?? 'No se pudo crear la rutina.');
      const { error: reErr } = await supabase.from('routine_exercises').insert(
        list.map((e, i) => ({
          routine_id: routine.id,
          exercise_id: e.exerciseId,
          position: i,
          target_sets: e.targetSets && e.targetSets > 0 ? e.targetSets : null,
          target_reps: e.targetReps && e.targetReps > 0 ? e.targetReps : null,
        }))
      );
      if (reErr) {
        await supabase.from('routines').delete().eq('id', routine.id);
        throw new Error(reErr.message);
      }
    },
    onSuccess: invalidate,
  });
}

export function useDeleteRoutine(memberId: string) {
  const invalidate = useInvalidate(memberId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('routines').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}
