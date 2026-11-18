// Sesión y "quién soy" de la app. La app es solo para socios: una cuenta sin
// ficha en `members` (staff que no entrena) ve un aviso de que su panel está
// en la web.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { SUPABASE_URL } from './config';
import { checkConnection } from './offline/network';
import { clearOutbox } from './offline/outbox';
import { unregisterPush } from './push';
import { supabase } from './supabase';

/** La sesión tal como supabase-js la guarda en el teléfono (clave sb-<ref>-auth-token). */
async function storedSession(): Promise<Session | null> {
  try {
    const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
    const raw = await AsyncStorage.getItem(`sb-${ref}-auth-token`);
    const s = raw ? (JSON.parse(raw) as Session) : null;
    return s?.refresh_token && s.user?.id ? s : null;
  } catch {
    return null;
  }
}

export type Member = { id: string; full_name: string; birthday: string | null; photo_url: string | null };

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
  signOut: (opts?: { accountDeleted?: boolean }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data, error }) => {
      // El token dura una hora: si venció y no hay internet para renovarlo,
      // getSession no devuelve sesión aunque siga guardada. Se usa la guardada
      // para entrar con los datos del teléfono; al volver la señal, Supabase la
      // renueva solo y avisa con TOKEN_REFRESHED.
      const offline = !data.session && error && isAuthRetryableFetchError(error);
      setSession(data.session ?? (offline ? await storedSession() : null));
      setRestored(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // Sin red, el INITIAL_SESSION llega vacío: no debe borrar la guardada.
      if (!next && event !== 'SIGNED_OUT') return;
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
  const memberQuery = useQuery({
    queryKey: ['member', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Member | null> => {
      const { data, error } = await supabase
        .from('members')
        .select('id, full_name, birthday, photo_url')
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
          ? // Sin internet y sin nada guardado en el teléfono, la consulta
            // queda en pausa: se muestra "Sin conexión" en vez del splash.
            memberQuery.fetchStatus === 'paused'
            ? 'offline'
            : 'loading'
          : memberQuery.isError
            ? 'offline'
            : memberQuery.data
              ? 'member'
              : 'noMember';

  const signOut = useCallback(
    async (opts?: { accountDeleted?: boolean }) => {
      const userId = session?.user.id;
      if (opts?.accountDeleted) {
        // El usuario ya no existe en el servidor: solo se limpia el teléfono.
        await supabase.auth.signOut({ scope: 'local' });
      } else {
        await unregisterPush(); // antes del signOut: la API necesita la sesión
        // Sin internet el cierre en el servidor falla y la sesión seguiría
        // guardada: se cierra al menos en el teléfono.
        const { error } = await supabase.auth.signOut();
        if (error) await supabase.auth.signOut({ scope: 'local' });
      }
      if (userId) await clearOutbox(userId);
      queryClient.clear();
      // Si se cerró sin red no llega SIGNED_OUT de inmediato.
      setSession(null);
    },
    [queryClient, session]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      member: memberQuery.data ?? null,
      retry: () => {
        checkConnection();
        void memberQuery.refetch();
      },
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
