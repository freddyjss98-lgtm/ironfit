// Grabación de actividades con el GPS del teléfono.
//
// La ubicación llega a una tarea de expo-task-manager, que sigue corriendo con
// la pantalla apagada: en Android como servicio en primer plano (notificación
// fija "Iron Fit está grabando") y en iOS con el modo de fondo "location". En
// los dos basta el permiso "mientras se usa la app": no se pide "siempre".
//
// La grabación se guarda en AsyncStorage en cada lote de puntos, así que
// sobrevive si el sistema cierra la app. La tarea se define al importar este
// archivo, que se importa desde app/_layout.tsx (tiene que estar en el ámbito
// global para que el sistema la encuentre al despertar la app).

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import type { Sport } from '@/features/sports/sports';

import { haversine, type GpsPoint } from './geo';

export const GPS_TASK = 'ironfit-gps-recording';
const KEY = 'ironfit:gps-recording';

/** Precisión peor que esto (m) se descarta: suele ser el GPS "buscando". */
const MAX_ACCURACY = 35;
/** Movimientos menores (m) son ruido de estar quieto. */
const MIN_STEP = 4;
/** Más rápido que esto (m/s, ~180 km/h) es un salto del GPS. */
const MAX_SPEED = 50;

export type Recording = {
  sport: Sport;
  startedAt: number;
  status: 'recording' | 'paused' | 'finished';
  /** Total de tiempo en pausa (ms). */
  pausedMs: number;
  pausedAt: number | null;
  endedAt: number | null;
  seg: number;
  points: GpsPoint[];
  /** Precisión del último fix recibido (aunque se descarte), para el indicador de señal. */
  lastAccuracy: number | null;
  /** Saltos imposibles seguidos (ver appendLocations). */
  jumps?: number;
};

type Listener = (r: Recording | null) => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Las escrituras (la tarea y los botones) van en fila para no pisarse.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function load(): Promise<Recording | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Recording) : null;
  } catch {
    return null;
  }
}

async function store(r: Recording | null) {
  if (r) await AsyncStorage.setItem(KEY, JSON.stringify(r));
  else await AsyncStorage.removeItem(KEY);
  listeners.forEach((fn) => fn(r));
}

export function getRecording(): Promise<Recording | null> {
  return serial(load);
}

/** Tiempo en movimiento (ms): sin las pausas. */
export function elapsedMs(r: Recording, now = Date.now()): number {
  const end = r.endedAt ?? (r.status === 'paused' && r.pausedAt ? r.pausedAt : now);
  return Math.max(0, end - r.startedAt - r.pausedMs);
}

function appendLocations(locations: Location.LocationObject[]) {
  return serial(async () => {
    const r = await load();
    if (!r || r.status !== 'recording') return;
    for (const l of [...locations].sort((a, b) => a.timestamp - b.timestamp)) {
      const acc = l.coords.accuracy ?? null;
      r.lastAccuracy = acc;
      if (acc != null && acc > MAX_ACCURACY) continue;
      // Redondeo (~10 cm) para que la grabación guardada no crezca de más.
      const p: GpsPoint = {
        lat: Math.round(l.coords.latitude * 1e6) / 1e6,
        lng: Math.round(l.coords.longitude * 1e6) / 1e6,
        alt: l.coords.altitude == null ? null : Math.round(l.coords.altitude),
        t: l.timestamp,
        seg: r.seg,
      };
      const last = r.points[r.points.length - 1];
      if (last && last.seg === p.seg) {
        if (p.t <= last.t) continue;
        const d = haversine(last.lat, last.lng, p.lat, p.lng);
        if (d < MIN_STEP) continue;
        if (d / ((p.t - last.t) / 1000) > MAX_SPEED) {
          // Un salto suelto se ignora. Si los puntos siguientes siguen "lejos",
          // el que estaba mal era el anterior (p. ej. el primer fix al salir
          // de un edificio): se empieza un tramo nuevo desde aquí, sin sumar
          // la distancia del salto.
          r.jumps = (r.jumps ?? 0) + 1;
          if (r.jumps < 3) continue;
          r.seg += 1;
          p.seg = r.seg;
        }
      }
      r.jumps = 0;
      r.points.push(p);
    }
    await store(r);
  });
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(GPS_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  await appendLocations(data.locations);
});

const ACTIVITY_TYPE: Partial<Record<Sport, Location.LocationActivityType>> = {
  run: Location.LocationActivityType.Fitness,
  walk: Location.LocationActivityType.Fitness,
  hike: Location.LocationActivityType.Fitness,
  bike: Location.LocationActivityType.OtherNavigation,
};

async function startUpdates(sport: Sport) {
  if (await Location.hasStartedLocationUpdatesAsync(GPS_TASK).catch(() => false)) return;
  await Location.startLocationUpdatesAsync(GPS_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 2000,
    distanceInterval: 3,
    activityType: ACTIVITY_TYPE[sport] ?? Location.LocationActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Iron Fit está grabando tu actividad',
      notificationBody: 'Toca para ver tu tiempo y distancia.',
      notificationColor: '#e84b1f',
      killServiceOnDestroy: false,
    },
  });
}

async function stopUpdates() {
  if (await Location.hasStartedLocationUpdatesAsync(GPS_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(GPS_TASK).catch(() => {});
  }
}

/** Pide permiso (solo "mientras se usa") y revisa que el GPS esté encendido. */
export async function ensureLocationReady(): Promise<void> {
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new Error('Activa la ubicación (GPS) del teléfono para grabar.');
  }
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Iron Fit necesita tu ubicación para medir la distancia. Actívala en los ajustes del teléfono.');
  }
}

export function startRecording(sport: Sport) {
  return serial(async () => {
    await ensureLocationReady();
    const now = Date.now();
    await store({ sport, startedAt: now, status: 'recording', pausedMs: 0, pausedAt: null, endedAt: null, seg: 0, points: [], lastAccuracy: null });
    try {
      await startUpdates(sport);
    } catch (e) {
      await store(null);
      throw e;
    }
  });
}

/** Si el sistema cerró la app a mitad de la grabación, vuelve a pedir ubicación. */
export function resumeTrackingIfNeeded() {
  return serial(async () => {
    const r = await load();
    if (r?.status === 'recording') await startUpdates(r.sport).catch(() => {});
  });
}

export function pauseRecording() {
  return serial(async () => {
    const r = await load();
    if (!r || r.status !== 'recording') return;
    await stopUpdates();
    await store({ ...r, status: 'paused', pausedAt: Date.now() });
  });
}

export function resumeRecording() {
  return serial(async () => {
    const r = await load();
    if (!r || r.status !== 'paused') return;
    await ensureLocationReady();
    await store({ ...r, status: 'recording', pausedMs: r.pausedMs + (Date.now() - (r.pausedAt ?? Date.now())), pausedAt: null, seg: r.seg + 1 });
    await startUpdates(r.sport);
  });
}

export function finishRecording() {
  return serial(async () => {
    const r = await load();
    if (!r) return null;
    await stopUpdates();
    const now = Date.now();
    const done: Recording = {
      ...r,
      status: 'finished',
      pausedMs: r.status === 'paused' && r.pausedAt ? r.pausedMs + (now - r.pausedAt) : r.pausedMs,
      pausedAt: null,
      endedAt: now,
    };
    await store(done);
    return done;
  });
}

/** Descartar o, después de guardarla, limpiar. */
export function clearRecording() {
  return serial(async () => {
    await stopUpdates();
    await store(null);
  });
}
