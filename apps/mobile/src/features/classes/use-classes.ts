// Datos y acciones de "Entrenar": mismas consultas que
// apps/web/app/portal/clases/page.tsx. Reservar y cancelar van por las RPC
// book_class / cancel_my_booking (las reglas viven en la base).

import { addDays, todayInEcuador } from '@ironfit/shared/date';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type Schedule = {
  id: string;
  name: string;
  description: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_capacity: number;
  coach_name: string | null;
};

export type MyBooking = {
  id: string;
  schedule_id: string;
  booking_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
};

export type ClassesData = {
  today: string;
  dates: string[];
  schedules: Schedule[];
  myBookings: MyBooking[];
  /** "scheduleId|fecha|HH:MM:SS" → reservas ocupadas. */
  bookingCounts: Record<string, number>;
  hasActiveMembership: boolean;
  /** Fecha → HTML de la planificación (WOD). */
  wodByDate: Record<string, string>;
  /** Fecha → motivo, para los días que el gym no abre. */
  closedDays: Record<string, string>;
};

/** Día de la semana (0=Dom) de 'YYYY-MM-DD', sin depender de la zona del teléfono. */
export function dowOf(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function toMonday(ymd: string): string {
  const dow = dowOf(ymd);
  return addDays(ymd, dow === 0 ? -6 : -(dow - 1));
}

export function useClasses(memberId: string) {
  return useQuery({
    queryKey: ['classes', memberId],
    queryFn: async (): Promise<ClassesData> => {
      const today = todayInEcuador();
      const windowEnd = addDays(today, 6); // hoy + 6 días
      const monday = toMonday(today);

      const [schedulesRes, closuresRes, bookingsRes, countsRes, membershipRes, typesRes] = await Promise.all([
        supabase
          .from('class_schedules')
          .select('id, name, description, day_of_week, start_time, end_time, max_capacity, coaches(full_name)')
          .eq('active', true)
          .order('day_of_week')
          .order('start_time'),
        supabase.from('gym_closures').select('closure_date, reason').gte('closure_date', today).lte('closure_date', windowEnd),
        supabase
          .from('class_bookings')
          .select('id, schedule_id, booking_date, start_time, end_time, status')
          .eq('member_id', memberId)
          .gte('booking_date', today)
          .lte('booking_date', windowEnd)
          .neq('status', 'cancelled'),
        supabase.rpc('get_class_booking_counts', { date_from: today, date_to: windowEnd }),
        supabase
          .from('memberships')
          .select('id')
          .eq('member_id', memberId)
          .eq('status', 'active')
          .gte('end_date', today)
          .limit(1)
          .maybeSingle(),
        supabase.from('program_types').select('id, is_active, sort_order').order('sort_order'),
      ]);
      const failed = [schedulesRes, closuresRes, bookingsRes, countsRes, membershipRes].find((r) => r.error);
      if (failed?.error) throw failed.error;

      const bookingCounts: Record<string, number> = {};
      for (const r of (countsRes.data ?? []) as { schedule_id: string; booking_date: string; start_time: string; booked_count: number }[]) {
        bookingCounts[`${r.schedule_id}|${r.booking_date}|${r.start_time}`] = Number(r.booked_count);
      }

      const closedDays: Record<string, string> = {};
      for (const c of closuresRes.data ?? []) closedDays[c.closure_date as string] = c.reason as string;

      // Planificación (WOD) del programa activo para las semanas visibles.
      const wodByDate: Record<string, string> = {};
      const types = typesRes.data ?? [];
      const activeType = types.find((t) => t.is_active) ?? types[0] ?? null;
      if (activeType) {
        const { data: weeks } = await supabase
          .from('weekly_programs')
          .select('id, week_start')
          .eq('type_id', activeType.id)
          .gte('week_start', monday)
          .lte('week_start', addDays(monday, 21));
        const weekStartById: Record<string, string> = {};
        for (const w of weeks ?? []) weekStartById[w.id as string] = w.week_start as string;
        const weekIds = Object.keys(weekStartById);
        if (weekIds.length > 0) {
          const { data: workouts } = await supabase
            .from('daily_workouts')
            .select('program_id, day_of_week, content')
            .in('program_id', weekIds);
          for (const w of workouts ?? []) {
            const ws = weekStartById[w.program_id as string];
            const dow = w.day_of_week as number;
            const content = (w.content ?? '') as string;
            if (ws && content) wodByDate[addDays(ws, dow === 0 ? 6 : dow - 1)] = content;
          }
        }
      }

      type RawSchedule = Omit<Schedule, 'coach_name'> & { coaches: { full_name: string } | null };
      return {
        today,
        dates: Array.from({ length: 7 }, (_, i) => addDays(today, i)),
        schedules: ((schedulesRes.data ?? []) as unknown as RawSchedule[]).map(({ coaches, ...s }) => ({
          ...s,
          coach_name: coaches?.full_name ?? null,
        })),
        myBookings: (bookingsRes.data ?? []) as MyBooking[],
        bookingCounts,
        hasActiveMembership: !!membershipRes.data,
        wodByDate,
        closedDays,
      };
    },
  });
}

function useRefreshAfter(memberId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['classes', memberId] });
  };
}

export function useBookClass(memberId: string) {
  const refresh = useRefreshAfter(memberId);
  return useMutation({
    mutationFn: async (v: { scheduleId: string; date: string; start: string; end: string }) => {
      const { error } = await supabase.rpc('book_class', {
        p_schedule_id: v.scheduleId,
        p_booking_date: v.date,
        p_start_time: v.start,
        p_end_time: v.end,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: refresh,
  });
}

export function useCancelBooking(memberId: string) {
  const refresh = useRefreshAfter(memberId);
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.rpc('cancel_my_booking', { p_booking_id: bookingId });
      if (error) throw new Error(error.message);
    },
    onSettled: refresh,
  });
}
