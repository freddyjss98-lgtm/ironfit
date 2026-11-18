// Bandeja de salida: lo que el socio registra sin internet (actividades, WOD,
// sesiones de fuerza, medidas) se guarda aquí, en el teléfono, y se envía solo
// cuando vuelve la señal, en el orden en que se anotó.
//
// Cada tipo registra cómo se envía (senders.ts). Mientras esperan, los hooks
// de cada tipo mezclan los pendientes con lo que vino del servidor, así que el
// socio los ve en su historial (con id "local-…") y hasta puede compartirlos.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { useMemo, useSyncExternalStore } from 'react';
import { Alert, AppState } from 'react-native';

import { supabase } from '../supabase';
import { isNetworkError, reportOffline } from './network';

export type OutboxKind = 'activity' | 'wod' | 'strength' | 'body';

export type OutboxItem<P = unknown> = {
  id: string;
  kind: OutboxKind;
  userId: string;
  memberId: string;
  createdAt: number;
  payload: P;
  /** Para reemplazar en vez de duplicar (p. ej. el WOD de un mismo día). */
  dedupeKey: string | null;
  attempts: number;
  /** Último error del servidor (no de red). */
  error: string | null;
};

type Sender = {
  send: (item: OutboxItem) => Promise<unknown>;
  invalidate: (item: OutboxItem) => QueryKey[];
  /** Después de enviarse (p. ej. avisar de un reto cumplido). */
  after?: (item: OutboxItem, result: unknown) => void;
};

const KEY = 'ironfit:outbox';
/** Tras estos fallos del servidor deja de reintentarse solo; el socio decide. */
export const MAX_ATTEMPTS = 5;
export const LOCAL_PREFIX = 'local-';

export const isLocalId = (id: string | null | undefined) => !!id && id.startsWith(LOCAL_PREFIX);

let items: OutboxItem[] = [];
const listeners = new Set<() => void>();
const senders: Partial<Record<OutboxKind, Sender>> = {};
let queryClient: QueryClient | null = null;
let loaded: Promise<void> | null = null;

function emit() {
  for (const l of listeners) l();
}

async function save(next: OutboxItem[]) {
  items = next;
  emit();
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

function load(): Promise<void> {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      // Lo que se haya encolado mientras cargaba va después de lo guardado.
      const stored = raw ? (JSON.parse(raw) as OutboxItem[]) : [];
      items = [...stored, ...items.filter((i) => !stored.some((s) => s.id === i.id))];
      emit();
    })
    .catch(() => {});
  return loaded;
}

export function registerSender(kind: OutboxKind, sender: Sender) {
  senders[kind] = sender;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useOutbox(): OutboxItem[] {
  return useSyncExternalStore(subscribe, () => items);
}

/** Pendientes de un tipo y un socio (para mezclarlos con lo del servidor). */
export function usePending<P>(kind: OutboxKind, memberId: string): OutboxItem<P>[] {
  const all = useOutbox();
  // Misma referencia mientras la bandeja no cambie: se usa en los `select`.
  return useMemo(
    () => all.filter((i) => i.kind === kind && i.memberId === memberId) as OutboxItem<P>[],
    [all, kind, memberId]
  );
}

export async function enqueue<P>(
  kind: OutboxKind,
  v: { userId: string; memberId: string; payload: P; dedupeKey?: string }
): Promise<OutboxItem<P>> {
  await load();
  const item: OutboxItem<P> = {
    id: `${LOCAL_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    userId: v.userId,
    memberId: v.memberId,
    createdAt: Date.now(),
    payload: v.payload,
    dedupeKey: v.dedupeKey ?? null,
    attempts: 0,
    error: null,
  };
  const rest = item.dedupeKey ? items.filter((i) => !(i.kind === kind && i.dedupeKey === item.dedupeKey)) : items;
  await save([...rest, item as OutboxItem]);
  return item;
}

export async function removeItem(id: string) {
  await load();
  await save(items.filter((i) => i.id !== id));
}

/** Al cerrar sesión: lo pendiente de esa cuenta se descarta. */
export async function clearOutbox(userId: string) {
  await load();
  await save(items.filter((i) => i.userId !== userId));
}

/**
 * Intenta enviar ya; si no hay red, lo deja en la bandeja.
 * @returns lo que devolvió el servidor, o `{ queued }` con el pendiente creado.
 */
export async function sendOrQueue<P, R>(
  kind: OutboxKind,
  v: { userId: string; memberId: string; payload: P; dedupeKey?: string },
  send: (payload: P) => Promise<R>
): Promise<{ sent: R; queued: null } | { sent: null; queued: OutboxItem<P> }> {
  if (onlineManager.isOnline()) {
    try {
      return { sent: await send(v.payload), queued: null };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      reportOffline();
    }
  }
  return { sent: null, queued: await enqueue(kind, v) };
}

/** Aviso al socio cuando lo que guardó quedó esperando señal. */
export function alertQueued(extra?: string) {
  Alert.alert('Guardado sin conexión', `Se enviará solo cuando vuelvas a tener señal.${extra ? ` ${extra}` : ''}`);
}

let flushing: Promise<void> | null = null;

export function flushOutbox(opts: { includeFailed?: boolean } = {}): Promise<void> {
  flushing ??= runFlush(opts).finally(() => {
    flushing = null;
  });
  return flushing;
}

async function runFlush({ includeFailed = false }: { includeFailed?: boolean }) {
  await load();
  if (!items.length || !onlineManager.isOnline()) return;
  // Sin sesión válida (p. ej. el token no se pudo renovar) se espera: enviar
  // sin sesión daría un error de permisos y el registro quedaría marcado.
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;

  for (const item of [...items]) {
    if (item.userId !== userId) continue;
    if (!includeFailed && item.attempts >= MAX_ATTEMPTS) continue;
    const sender = senders[item.kind];
    if (!sender) continue;
    // Pudo descartarse mientras se enviaba el anterior.
    if (!items.some((i) => i.id === item.id)) continue;
    try {
      const result = await sender.send(item);
      await save(items.filter((i) => i.id !== item.id));
      for (const key of sender.invalidate(item)) void queryClient?.invalidateQueries({ queryKey: key });
      sender.after?.(item, result);
    } catch (err) {
      if (isNetworkError(err)) {
        reportOffline();
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      await save(items.map((i) => (i.id === item.id ? { ...i, attempts: i.attempts + 1, error: message } : i)));
    }
  }
}

let started = false;

export function startOutbox(client: QueryClient) {
  queryClient = client;
  if (started) return;
  started = true;
  void load().then(() => flushOutbox());
  onlineManager.subscribe((online) => {
    if (online) void flushOutbox();
  });
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void flushOutbox();
  });
}
