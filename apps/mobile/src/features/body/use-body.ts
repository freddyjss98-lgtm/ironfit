// Medidas corporales: mismas tablas y RPC que /portal/progreso (pestaña Cuerpo).

import { todayInEcuador } from '@ironfit/shared/date';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export const METRICS = [
  { key: 'weight', label: 'Peso', unit: 'kg', goodDir: 'down' },
  { key: 'body_fat', label: '% Grasa', unit: '%', goodDir: 'down' },
  { key: 'muscle_mass', label: 'Músculo', unit: 'kg', goodDir: 'up' },
  { key: 'chest_cm', label: 'Pecho', unit: 'cm', goodDir: 'up' },
  { key: 'waist_cm', label: 'Cintura', unit: 'cm', goodDir: 'down' },
  { key: 'hips_cm', label: 'Cadera', unit: 'cm', goodDir: 'down' },
  { key: 'arm_cm', label: 'Brazo', unit: 'cm', goodDir: 'up' },
  { key: 'leg_cm', label: 'Pierna', unit: 'cm', goodDir: 'up' },
] as const;

export type MetricKey = (typeof METRICS)[number]['key'];

export type Measurement = { id: string; measured_at: string; notes: string | null; is_own: boolean } & Record<
  MetricKey,
  number | null
>;

export function useBody(memberId: string, userId: string) {
  return useQuery({
    queryKey: ['body', memberId],
    queryFn: async () => {
      const [progress, member] = await Promise.all([
        supabase
          .from('member_progress')
          .select('id, measured_at, weight, body_fat, muscle_mass, chest_cm, waist_cm, hips_cm, arm_cm, leg_cm, notes, created_by')
          .eq('member_id', memberId)
          .order('measured_at', { ascending: false }),
        supabase.from('members').select('target_weight, height_cm').eq('id', memberId).single(),
      ]);
      if (progress.error) throw progress.error;
      const rows = (progress.data ?? []).map((p) => {
        const out: Record<string, unknown> = { id: p.id, measured_at: p.measured_at, notes: p.notes, is_own: p.created_by === userId };
        for (const m of METRICS) out[m.key] = p[m.key] == null ? null : Number(p[m.key]);
        return out as Measurement;
      });
      return {
        rows,
        targetWeight: member.data?.target_weight == null ? null : Number(member.data.target_weight),
        heightCm: member.data?.height_cm == null ? null : Number(member.data.height_cm),
      };
    },
  });
}

export function useAddMeasurement(memberId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { values: Partial<Record<MetricKey, number>>; notes: string | null; date: string }) => {
      if (!Object.values(v.values).some((x) => x != null)) throw new Error('Ingresa al menos un dato (peso o una medida).');
      if (v.date > todayInEcuador()) throw new Error('La fecha no puede ser futura.');
      const { error } = await supabase
        .from('member_progress')
        .insert({ member_id: memberId, created_by: userId, measured_at: v.date, notes: v.notes, ...v.values });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['body', memberId] }),
  });
}

export function useDeleteMeasurement(memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('member_progress').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['body', memberId] }),
  });
}

export function useSetGoal(memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (target: number | null) => {
      const { error } = await supabase.rpc('set_my_weight_goal', { target });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['body', memberId] }),
  });
}
