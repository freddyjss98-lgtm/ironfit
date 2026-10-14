// Levantamientos con récord (1RM). Las claves coinciden con el check de
// lift_records.lift en la base.

import { todayInEcuador } from '@ironfit/shared/date';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export const LIFTS = [
  { key: 'back_squat', name: 'Sentadilla trasera' },
  { key: 'front_squat', name: 'Sentadilla frontal' },
  { key: 'deadlift', name: 'Peso muerto' },
  { key: 'bench_press', name: 'Press de banca' },
  { key: 'strict_press', name: 'Press estricto' },
  { key: 'push_press', name: 'Push press' },
  { key: 'push_jerk', name: 'Push jerk' },
  { key: 'clean', name: 'Clean' },
  { key: 'power_clean', name: 'Power clean' },
  { key: 'clean_and_jerk', name: 'Clean & jerk' },
  { key: 'snatch', name: 'Snatch' },
  { key: 'power_snatch', name: 'Power snatch' },
  { key: 'thruster', name: 'Thruster' },
] as const;

export type LiftKey = (typeof LIFTS)[number]['key'];

export const liftName = (key: string) => LIFTS.find((l) => l.key === key)?.name ?? key;

export type LiftRecord = { id: string; lift: LiftKey; weight_kg: number; recorded_on: string; notes: string | null };

export function useLiftRecords(memberId: string) {
  return useQuery({
    queryKey: ['lifts', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lift_records')
        .select('id, lift, weight_kg, recorded_on, notes')
        .eq('member_id', memberId)
        .order('recorded_on', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, weight_kg: Number(r.weight_kg) })) as LiftRecord[];
    },
  });
}

/** Mejor marca por levantamiento. */
export function bestByLift(records: LiftRecord[]): Map<LiftKey, LiftRecord> {
  const best = new Map<LiftKey, LiftRecord>();
  for (const r of records) {
    const cur = best.get(r.lift);
    if (!cur || r.weight_kg > cur.weight_kg) best.set(r.lift, r);
  }
  return best;
}

export function useAddLift(memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { lift: LiftKey; weight_kg: number; notes: string | null }) => {
      const { error } = await supabase
        .from('lift_records')
        .insert({ member_id: memberId, lift: v.lift, weight_kg: v.weight_kg, notes: v.notes, recorded_on: todayInEcuador() });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lifts', memberId] }),
  });
}

export function useDeleteLift(memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lift_records').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lifts', memberId] }),
  });
}

/** Kilos para un % del 1RM, redondeados al 0,5 kg más cercano (discos de 0,25 por lado). */
export function percentOf(oneRm: number, pct: number): number {
  return Math.round(((oneRm * pct) / 100) * 2) / 2;
}
