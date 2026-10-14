// Datos de la pantalla de inicio: mismas consultas que apps/web/app/portal/page.tsx.

import { addDays, todayInEcuador } from '@ironfit/shared/date';
import { computeAttendanceStats, type AttendanceStats } from '@ironfit/shared/portal/stats';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type MembershipRow = {
  id: string;
  start_date: string;
  end_date: string;
  effective_status: string;
  days_until_expiry: number;
  membership_plans: { name: string; duration_days: number; color: string; is_exclusive: boolean } | null;
};

export type UpcomingClosure = {
  date: string;
  reason: string;
  /** Ya se le sumó ese día a la membresía del socio. */
  credited: boolean;
};

export type HomeData = {
  today: string;
  membership: MembershipRow | null;
  stats: AttendanceStats;
  closures: UpcomingClosure[];
};

export function useHome(memberId: string) {
  return useQuery({
    queryKey: ['home', memberId],
    queryFn: async (): Promise<HomeData> => {
      const today = todayInEcuador();
      const [membershipRes, checkInsRes, closuresRes, creditsRes] = await Promise.all([
        supabase
          .from('vw_memberships_status')
          .select(
            'id, start_date, end_date, effective_status, days_until_expiry, membership_plans(name, duration_days, color, is_exclusive)'
          )
          .eq('member_id', memberId)
          .in('status', ['active', 'frozen', 'expired']) // cancelled/suspended: no
          .order('end_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('attendances')
          .select('checked_in_date, checked_in_at')
          .eq('member_id', memberId)
          .order('checked_in_at', { ascending: false })
          .limit(400),
        supabase
          .from('gym_closures')
          .select('id, closure_date, reason')
          .gte('closure_date', today)
          .lte('closure_date', addDays(today, 30))
          .order('closure_date'),
        supabase.from('gym_closure_credits').select('closure_id').eq('member_id', memberId).eq('kind', 'extended'),
      ]);

      const failed = [membershipRes, checkInsRes, closuresRes, creditsRes].find((r) => r.error);
      if (failed?.error) throw failed.error;

      const credited = new Set((creditsRes.data ?? []).map((c) => c.closure_id as string));
      return {
        today,
        membership: membershipRes.data as unknown as MembershipRow | null,
        stats: computeAttendanceStats(checkInsRes.data ?? []),
        closures: (closuresRes.data ?? []).map((c) => ({
          date: c.closure_date as string,
          reason: c.reason as string,
          credited: credited.has(c.id as string),
        })),
      };
    },
  });
}
