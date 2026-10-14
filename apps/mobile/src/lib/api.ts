// Cliente de la API del backend (/api/app/* en el Next de ironfitclub.org).
// Responde { ok: true, data } o { ok: false, error } con el mensaje ya en español.

import { API_URL } from './config';
import { supabase } from './supabase';

type Options = {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  /** false para las rutas sin sesión (registro). */
  auth?: boolean;
};

export async function api<T>(path: string, { method = 'GET', body, auth = true }: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error('Tu sesión terminó. Vuelve a iniciar sesión.');
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('No hay conexión. Revisa tu internet e inténtalo de nuevo.');
  }

  const json = (await res.json().catch(() => null)) as { ok: boolean; data?: T; error?: string } | null;
  if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Error del servidor (${res.status})`);
  return json.data as T;
}
