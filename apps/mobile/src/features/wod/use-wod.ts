// Resultado del WOD del día y pizarra del box (tabla wod_results + RPC wod_board).
// Sin internet el resultado queda en la bandeja de salida (uno por día: el
// último reemplaza al anterior) y se ve como si ya estuviera guardado.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { isLocalId, removeItem, sendOrQueue, usePending, type OutboxItem } from '@/lib/offline/outbox';
import { supabase } from '@/lib/supabase';

import type { Score, ScoreType } from './score';
import type { PartScore } from './wod-parts';

export type MyResult = Score & { id: string; notes: string | null; workout_date: string; parts: PartScore[] };
export type BoardRow = Score & { display_name: string; is_me: boolean };

const toScore = <T extends Record<string, unknown>>(r: T) => ({
  ...r,
  load_kg: r.load_kg == null ? null : Number(r.load_kg),
});

export type PendingWod = { date: string; input: ResultInput };

/** Un resultado pendiente de la bandeja con la forma de uno guardado. */
function localResult(item: OutboxItem<PendingWod>): MyResult {
  return { ...item.payload.input, id: item.id, workout_date: item.payload.date };
}

export function useMyResult(memberId: string, date: string) {
  const pending = usePending<PendingWod>('wod', memberId);
  const select = useCallback(
    (saved: MyResult | null) => {
      const mine = pending.find((p) => p.payload.date === date);
      return mine ? localResult(mine) : saved;
    },
    [pending, date]
  );
  return useQuery({
    queryKey: ['wod-result', memberId, date],
    select,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wod_results')
        .select('id, workout_date, score_type, time_seconds, capped, rounds, reps, load_kg, rx, notes, parts')
        .eq('member_id', memberId)
        .eq('workout_date', date)
        .maybeSingle();
      if (error) throw error;
      return data ? (toScore(data) as MyResult) : null;
    },
  });
}

export function useBoard(date: string, enabled: boolean) {
  return useQuery({
    queryKey: ['wod-board', date],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('wod_board', { p_date: date });
      if (error) throw error;
      return ((data ?? []) as BoardRow[]).map((r) => toScore(r) as BoardRow);
    },
  });
}

export type ResultInput = {
  score_type: ScoreType;
  time_seconds: number | null;
  capped: boolean;
  rounds: number | null;
  reps: number | null;
  load_kg: number | null;
  rx: boolean;
  notes: string | null;
  /** Resultados opcionales por parte (para la tarjeta). */
  parts: PartScore[];
};

/** Un resultado por día: si ya existe se corrige. */
export async function sendWodResult(memberId: string, { date, input }: PendingWod): Promise<void> {
  const { error } = await supabase
    .from('wod_results')
    .upsert({ member_id: memberId, workout_date: date, ...input }, { onConflict: 'member_id,workout_date' });
  if (error) throw new Error(error.message);
}

export function useSaveResult(memberId: string, date: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ResultInput): Promise<{ queued: boolean }> => {
      const r = await sendOrQueue('wod', { userId, memberId, payload: { date, input }, dedupeKey: date }, (p) =>
        sendWodResult(memberId, p)
      );
      return { queued: !!r.queued };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wod-result', memberId, date] });
      queryClient.invalidateQueries({ queryKey: ['wod-board', date] });
      queryClient.invalidateQueries({ queryKey: ['wod-history', memberId] });
    },
  });
}

export function useDeleteResult(memberId: string, date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isLocalId(id)) return removeItem(id);
      const { error } = await supabase.from('wod_results').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wod-result', memberId, date] });
      queryClient.invalidateQueries({ queryKey: ['wod-board', date] });
      queryClient.invalidateQueries({ queryKey: ['wod-history', memberId] });
    },
  });
}

/** Mis últimos resultados (historial en Progreso). */
export function useWodHistory(memberId: string) {
  const pending = usePending<PendingWod>('wod', memberId);
  const select = useCallback(
    (rows: MyResult[]) => {
      if (!pending.length) return rows;
      const local = pending.map(localResult);
      return [...local, ...rows.filter((r) => !local.some((l) => l.workout_date === r.workout_date))].sort((a, b) =>
        b.workout_date.localeCompare(a.workout_date)
      );
    },
    [pending]
  );
  return useQuery({
    queryKey: ['wod-history', memberId],
    select,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wod_results')
        .select('id, workout_date, score_type, time_seconds, capped, rounds, reps, load_kg, rx, notes, parts')
        .eq('member_id', memberId)
        .order('workout_date', { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []).map((r) => toScore(r) as MyResult);
    },
  });
}
