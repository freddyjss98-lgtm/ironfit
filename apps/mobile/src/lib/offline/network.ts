// ¿Hay internet? Lo decide el onlineManager de React Query: sin conexión, las
// consultas se pausan con los últimos datos guardados en vez de fallar, y la
// bandeja de salida (outbox.ts) espera para enviar.
//
// Dos fuentes:
//  - expo-network avisa al instante cuando el teléfono pierde la red. Es un
//    módulo nativo que solo existe desde el build que lo incluye; en los
//    builds anteriores (que reciben este código por OTA) no está, y se sigue
//    sin él.
//  - Cuando una petición falla por red se marca "sin conexión" y se sondea el
//    servidor cada pocos segundos hasta que responda.

import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';

export const OFFLINE_MESSAGE = 'Sin conexión. Esto necesita internet: inténtalo cuando vuelvas a tener señal.';

const PROBE_EVERY_MS = 15_000;
const PROBE_TIMEOUT_MS = 8_000;

/** Errores de "no llegó al servidor" (no los que responde el servidor). */
export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { message?: unknown; name?: unknown; details?: unknown };
  const text = `${String(e.name ?? '')} ${String(e.message ?? '')} ${String(e.details ?? '')}`;
  return /network request failed|failed to fetch|fetch failed|load failed|networkerror|network error|AuthRetryableFetchError|No hay conexión/i.test(
    text
  );
}

let timer: ReturnType<typeof setInterval> | null = null;
let probing = false;

/** Una petición barata a Supabase: cualquier respuesta, aunque sea un error HTTP, es que hay red. */
async function probe(): Promise<void> {
  if (probing || onlineManager.isOnline()) return;
  probing = true;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_ANON_KEY }, signal: ctrl.signal });
    setOnline();
  } catch {
    // Sigue sin conexión.
  } finally {
    clearTimeout(t);
    probing = false;
  }
}

function setOnline() {
  if (timer) clearInterval(timer);
  timer = null;
  onlineManager.setOnline(true);
}

/** Se llama cuando una petición falla por red. */
export function reportOffline() {
  if (onlineManager.isOnline()) onlineManager.setOnline(false);
  if (!timer) timer = setInterval(probe, PROBE_EVERY_MS);
}

/** Probar ya (al volver a la app o al tocar "Reintentar"). */
export function checkConnection() {
  void probe();
}

const subscribeOnline = (cb: () => void) => onlineManager.subscribe(cb);

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => onlineManager.isOnline());
}

let started = false;

export function startNetworkWatch() {
  if (started) return;
  started = true;

  AppState.addEventListener('change', (state) => {
    if (state === 'active') checkConnection();
  });

  try {
    // require y no import: en un build sin el módulo nativo, importarlo lanza.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Network = require('expo-network') as typeof import('expo-network');
    const apply = (s: { isConnected?: boolean; isInternetReachable?: boolean }) => {
      if (s.isConnected === false || s.isInternetReachable === false) reportOffline();
      else checkConnection();
    };
    Network.addNetworkStateListener(apply);
    Network.getNetworkStateAsync().then(apply).catch(() => {});
  } catch {
    // Build anterior a expo-network: solo se detecta por peticiones fallidas.
  }
}
