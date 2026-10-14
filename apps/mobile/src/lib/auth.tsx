// Sesión y "quién soy" de la app. La app es solo para socios: una cuenta sin
// ficha en `members` (staff que no entrena) ve un aviso de que su panel está
// en la web.

import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

export type Member = { id: string; full_name: string };

export type AuthStatus =
  | 'loading'
  | 'signedOut'
  /** Acceso creado por el admin con contraseña temporal: debe cambiarla antes de seguir. */
  | 'mustChangePassword'
  | 'noMember'
  | 'offline'
  | 'member';

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  member: Member | null;
  retry: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setRestored(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
  const memberQuery = useQuery({
    queryKey: ['member', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Member | null> => {
      const { data, error } = await supabase
        .from('members')
        .select('id, full_name')
        .eq('user_id', userId!)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      return data as Member | null;
    },
  });

  const status: AuthStatus = !restored
    ? 'loading'
    : !session
      ? 'signedOut'
      : session.user.user_metadata?.must_change_password === true
        ? 'mustChangePassword'
        : memberQuery.isPending
          ? 'loading'
          : memberQuery.isError
            ? 'offline'
            : memberQuery.data
              ? 'member'
              : 'noMember';

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      member: memberQuery.data ?? null,
      retry: () => void memberQuery.refetch(),
      signOut,
    }),
    [status, session, memberQuery, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

/** Traduce los errores de Supabase Auth que puede ver un socio. */
export function authErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(message)) return 'Confirma tu correo antes de entrar (revisa tu bandeja).';
  if (/network|fetch/i.test(message)) return 'No hay conexión. Revisa tu internet e inténtalo de nuevo.';
  if (/password should be at least/i.test(message)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/same password|different from the old/i.test(message)) return 'La nueva contraseña debe ser distinta de la actual.';
  return message;
}
