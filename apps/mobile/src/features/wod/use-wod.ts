// Resultado del WOD del día y pizarra del box (tabla wod_results + RPC wod_board).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import type { Score, ScoreType } from './score';
import type { PartScore } from './wod-parts';

export type MyResult = Score & { id: string; notes: string | null; workout_date: string; parts: PartScore[] };
export type BoardRow = Score & { display_name: string; is_me: boolean };

const toScore = <T extends Record<string, unknown>>(r: T) => ({
  ...r,
  load_kg: r.load_kg == null ? null : Number(r.load_kg),
});

export function useMyResult(memberId: string, date: string) {
  return useQuery({
    queryKey: ['wod-result', memberId, date],
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

export function useSaveResult(memberId: string, date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ResultInput) => {
      // Un resultado por día: si ya existe se corrige.
      const { error } = await supabase
        .from('wod_results')
        .upsert({ member_id: memberId, workout_date: date, ...input }, { onConflict: 'member_id,workout_date' });
      if (error) throw new Error(error.message);
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
  return useQuery({
    queryKey: ['wod-history', memberId],
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
