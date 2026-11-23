// ¿Puede el socio usar las herramientas de la app? Sí con membresía activa del
// gimnasio o con la suscripción digital (Iron Fit Online). Lo decide la base
// (my_app_access / member_has_app_access), que también lo exige por RLS; esto
// es solo para mostrar la pantalla correcta en vez de un error.

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type AppSubscription = {
  status: 'active' | 'trial' | 'cancelled' | 'billing_issue' | 'paused' | 'expired';
  period_type: string | null;
  expires_at: string | null;
  will_renew: boolean;
  store: string | null;
  product_id: string | null;
  active: boolean;
};

export type AppAccess = {
  /** Puede usar las herramientas (gimnasio o suscripción). */
  access: boolean;
  /** Tiene membresía activa del gimnasio (reservas, check-in). */
  gym: boolean;
  kind: 'gym' | 'app' | null;
  subscription: AppSubscription | null;
};

async function fetchAccess(): Promise<AppAccess> {
  const { data, error } = await supabase.rpc('my_app_access');
  if (error) throw error;
  return data as AppAccess;
}

export function useAppAccess(memberId: string) {
  return useQuery({
    queryKey: ['app-access', memberId],
    queryFn: fetchAccess,
  });
}

const selectAccess = (a: AppAccess) => a.access;

/** true/false cuando ya se sabe; mientras carga, undefined (no bloquear). */
export function useActiveMembership(memberId: string) {
  return useQuery({
    queryKey: ['app-access', memberId],
    queryFn: fetchAccess,
    select: selectAccess,
  });
}
