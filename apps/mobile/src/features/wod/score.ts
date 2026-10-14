// Formatos de puntuación del WOD y cómo se muestran y se ordenan.

export type ScoreType = 'time' | 'rounds' | 'load' | 'reps';

export const SCORE_LABELS: Record<ScoreType, string> = {
  time: 'Tiempo',
  rounds: 'Rondas',
  load: 'Kilos',
  reps: 'Reps',
};

export type Score = {
  score_type: ScoreType;
  time_seconds: number | null;
  capped: boolean;
  rounds: number | null;
  reps: number | null;
  load_kg: number | null;
  rx: boolean;
};

export function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "18:42", "Tope · 180 reps", "7 + 12", "80 kg", "45 reps". */
export function fmtScore(s: Score): string {
  switch (s.score_type) {
    case 'time':
      if (s.capped) return s.reps != null ? `Tope · ${s.reps} reps` : 'Tope';
      return s.time_seconds != null ? fmtTime(s.time_seconds) : '—';
    case 'rounds':
      return `${s.rounds ?? 0}${s.reps ? ` + ${s.reps}` : ''} rondas`;
    case 'load':
      return `${Number(s.load_kg ?? 0)} kg`;
    case 'reps':
      return `${s.reps ?? 0} reps`;
  }
}

/** Orden de pizarra dentro de un mismo formato: Rx primero y luego el mejor resultado. */
export function compareScores(a: Score, b: Score): number {
  if (a.rx !== b.rx) return a.rx ? -1 : 1;
  switch (a.score_type) {
    case 'time':
      // Quien terminó va antes que quien llegó al tope; entre los del tope, más reps.
      if (a.capped !== b.capped) return a.capped ? 1 : -1;
      if (a.capped) return (b.reps ?? 0) - (a.reps ?? 0);
      return (a.time_seconds ?? Infinity) - (b.time_seconds ?? Infinity);
    case 'rounds':
      return (b.rounds ?? 0) - (a.rounds ?? 0) || (b.reps ?? 0) - (a.reps ?? 0);
    case 'load':
      return Number(b.load_kg ?? 0) - Number(a.load_kg ?? 0);
    case 'reps':
      return (b.reps ?? 0) - (a.reps ?? 0);
  }
}
