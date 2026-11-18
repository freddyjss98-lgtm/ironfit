// Medidas corporales: mismas tablas y RPC que /portal/progreso (pestaña Cuerpo).

import { todayInEcuador } from '@ironfit/shared/date';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { isLocalId, removeItem, sendOrQueue, usePending } from '@/lib/offline/outbox';
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

type BodyData = { rows: Measurement[]; targetWeight: number | null; heightCm: number | null };

export function useBody(memberId: string, userId: string) {
  // Las medidas anotadas sin internet se ven mientras esperan en la bandeja.
  const pending = usePending<PendingMeasurement>('body', memberId);
  const select = useCallback(
    (d: BodyData): BodyData => {
      if (!pending.length) return d;
      const local = pending.map((i) => {
        const out: Record<string, unknown> = { id: i.id, measured_at: i.payload.date, notes: i.payload.notes, is_own: true };
        for (const m of METRICS) out[m.key] = i.payload.values[m.key] ?? null;
        return out as Measurement;
      });
      return { ...d, rows: [...local, ...d.rows].sort((a, b) => b.measured_at.localeCompare(a.measured_at)) };
    },
    [pending]
  );
  return useQuery({
    queryKey: ['body', memberId],
    select,
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

export type PendingMeasurement = { values: Partial<Record<MetricKey, number>>; notes: string | null; date: string };

export async function sendMeasurement(memberId: string, userId: string, v: PendingMeasurement): Promise<void> {
  const { error } = await supabase
    .from('member_progress')
    .insert({ member_id: memberId, created_by: userId, measured_at: v.date, notes: v.notes, ...v.values });
  if (error) throw new Error(error.message);
}

export function useAddMeasurement(memberId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: PendingMeasurement) => {
      if (!Object.values(v.values).some((x) => x != null)) throw new Error('Ingresa al menos un dato (peso o una medida).');
      if (v.date > todayInEcuador()) throw new Error('La fecha no puede ser futura.');
      const r = await sendOrQueue('body', { userId, memberId, payload: v }, (p) => sendMeasurement(memberId, userId, p));
      return { queued: !!r.queued };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['body', memberId] });
      queryClient.invalidateQueries({ queryKey: ['latest-weight', memberId] });
    },
  });
}

export function useDeleteMeasurement(memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isLocalId(id)) return removeItem(id);
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
