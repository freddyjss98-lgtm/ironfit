// La planificación de un día concreto (puede ser de la semana pasada: el
// registro y la tarjeta aceptan hasta 7 días atrás) y los récords de ese día.

import { addDays } from '@ironfit/shared/date';
import { useQuery } from '@tanstack/react-query';

import { dowOf } from '@/features/classes/use-classes';
import { liftName } from '@/features/records/lifts';
import { supabase } from '@/lib/supabase';

/** HTML de la planificación del programa activo para esa fecha, o null. */
export function useDayWod(date: string) {
  return useQuery({
    queryKey: ['day-wod', date],
    queryFn: async () => {
      const dow = dowOf(date);
      const monday = addDays(date, dow === 0 ? -6 : -(dow - 1));
      const { data: types } = await supabase.from('program_types').select('id, is_active, sort_order').order('sort_order');
      const active = (types ?? []).find((t) => t.is_active) ?? (types ?? [])[0];
      if (!active) return null;
      const { data: week } = await supabase
        .from('weekly_programs')
        .select('id')
        .eq('type_id', active.id)
        .eq('week_start', monday)
        .maybeSingle();
      if (!week) return null;
      const { data: day } = await supabase
        .from('daily_workouts')
        .select('content')
        .eq('program_id', week.id)
        .eq('day_of_week', dow)
        .maybeSingle();
      return (day?.content as string | null) || null;
    },
  });
}

/** Récords (1RM) registrados ese día, con su nombre en español. */
export function useDayRecords(memberId: string, date: string) {
  return useQuery({
    queryKey: ['day-records', memberId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lift_records')
        .select('lift, weight_kg')
        .eq('member_id', memberId)
        .eq('recorded_on', date);
      if (error) throw error;
      // Uno por levantamiento: el más alto del día.
      const best = new Map<string, number>();
      for (const r of data ?? []) best.set(r.lift, Math.max(best.get(r.lift) ?? 0, Number(r.weight_kg)));
      return [...best].map(([lift, kg]) => ({ name: liftName(lift), kg }));
    },
  });
}
