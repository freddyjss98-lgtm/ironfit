// Deportes fuera del box: tipos, formatos (km, tiempo, ritmo) y la estimación
// de calorías cuando el socio no las trae de un reloj.

export type Sport = 'run' | 'walk' | 'bike' | 'swim' | 'hike' | 'other';

export const SPORTS: { key: Sport; label: string; emoji: string }[] = [
  { key: 'run', label: 'Correr', emoji: '🏃' },
  { key: 'bike', label: 'Bici', emoji: '🚴' },
  { key: 'swim', label: 'Natación', emoji: '🏊' },
  { key: 'hike', label: 'Montaña', emoji: '⛰️' },
  { key: 'walk', label: 'Caminar', emoji: '🚶' },
  { key: 'other', label: 'Otro', emoji: '💪' },
];

const BY_KEY = new Map(SPORTS.map((s) => [s.key, s]));

export function sportLabel(key: string | null | undefined): string {
  return (key && BY_KEY.get(key as Sport)?.label) || 'Actividad';
}

export function sportEmoji(key: string | null | undefined): string {
  return (key && BY_KEY.get(key as Sport)?.emoji) || '💪';
}

/** Natación se mide en metros; el resto en km. */
export function fmtDistance(meters: number | null | undefined, sport?: string | null): string | null {
  if (!meters) return null;
  if (sport === 'swim' && meters < 10000) return `${meters} m`;
  const km = meters / 1000;
  return `${km >= 100 ? km.toFixed(0) : km.toFixed(2).replace(/\.?0+$/, '')} km`;
}

/** 5400 → "1 h 30 min"; 1475 → "24:35". */
export function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return m ? `${h} h ${m} min` : `${h} h`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Cronómetro: 125 → "2:05"; 3725 → "1:02:05". */
export function fmtClock(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Deportes que se pueden grabar con GPS (en la piscina no sirve). */
export const GPS_SPORTS = SPORTS.filter((s) => s.key !== 'swim');

/** Ritmo por km (correr/caminar/montaña) o velocidad (bici). */
export function fmtPace(sport: string, seconds: number, meters: number | null | undefined): string | null {
  if (!meters || meters < 100 || seconds <= 0) return null;
  if (sport === 'bike') return `${((meters / 1000) / (seconds / 3600)).toFixed(1)} km/h`;
  if (sport === 'swim') {
    const per100 = Math.round(seconds / (meters / 100));
    return `${Math.floor(per100 / 60)}:${String(per100 % 60).padStart(2, '0')} /100 m`;
  }
  const perKm = Math.round(seconds / (meters / 1000));
  return `${Math.floor(perKm / 60)}:${String(perKm % 60).padStart(2, '0')} /km`;
}

/**
 * Calorías ≈ MET × peso (kg) × horas (Compendium of Physical Activities).
 * Correr y bici dependen de la velocidad; el resto usa un valor medio.
 */
export function estimateCalories(sport: Sport, seconds: number, meters: number | null, weightKg: number | null): number | null {
  if (!weightKg || seconds <= 0) return null;
  const hours = seconds / 3600;
  const kmh = meters ? meters / 1000 / hours : 0;
  let met: number;
  switch (sport) {
    case 'run':
      met = kmh ? Math.min(Math.max(kmh * 1.0, 6), 16) : 9.8;
      break;
    case 'bike':
      met = !kmh ? 7.5 : kmh < 16 ? 4 : kmh < 19 ? 6.8 : kmh < 22 ? 8 : kmh < 26 ? 10 : 12;
      break;
    case 'swim':
      met = 7;
      break;
    case 'hike':
      met = 6.5;
      break;
    case 'walk':
      met = kmh > 5.5 ? 5 : 3.5;
      break;
    default:
      met = 5;
  }
  return Math.round(met * weightKg * hours);
}

/** "5,2" o "5.2" → 5.2; vacío → null; texto raro → NaN. */
export function parseDecimal(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (!t) return null;
  return Number(t);
}
