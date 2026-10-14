// ¿El socio tiene membresía activa hoy? Las herramientas de entrenamiento son
// exclusivas de clientes activos (la base también lo exige por RLS; esto es
// solo para mostrar la pantalla correcta en vez de un error).

import { todayInEcuador } from '@ironfit/shared/date';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export function useActiveMembership(memberId: string) {
  return useQuery({
    queryKey: ['active', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('id')
        .eq('member_id', memberId)
        .eq('status', 'active')
        .gte('end_date', todayInEcuador())
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}
