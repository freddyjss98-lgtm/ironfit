// Partes del WOD del día y lectura permisiva de lo que escribe el socio.
//
// Las partes salen de la planificación del coach: sus títulos van en color o
// negrita ("B. Fase 1 :" + "6 Rondas"). Las líneas con estilo seguidas forman
// una parte; el calentamiento se omite porque no se puntúa.

import { htmlToSegments } from '@/lib/html';

import type { ScoreType } from './score';

export type PartScore = {
  label: string;
  score_type: ScoreType;
  time_seconds: number | null;
  rounds: number | null;
  reps: number | null;
  load_kg: number | null;
};

const SKIP = /calentamiento|warm.?up|movilidad|estiramiento|enfriamiento|cool.?down/i;

export type WodSection = {
  /** Título del coach ("B. Fase 1"); vacío si el WOD no tiene títulos. */
  title: string;
  /** Lo que hay debajo: esquema y ejercicios ("4 rondas:", "600 m carrera"). */
  lines: string[];
  /** Calentamiento, movilidad…: se muestra pero no se puntúa. */
  warmup: boolean;
};

/**
 * El WOD dividido en secciones. Cada título del coach (en color o negrita)
 * abre una; los títulos con estilo seguidos se juntan ("B. Fase 1 :" +
 * "6 Rondas") y todo lo que viene debajo sin estilo son sus líneas.
 */
export function wodSections(html: string | undefined): WodSection[] {
  if (!html) return [];
  // Reparte los segmentos en líneas, recordando si la línea tiene estilo.
  const lines: { text: string; styled: boolean }[] = [{ text: '', styled: false }];
  for (const s of htmlToSegments(html)) {
    const pieces = s.text.split('\n');
    pieces.forEach((piece, i) => {
      if (i > 0) lines.push({ text: '', styled: false });
      const line = lines[lines.length - 1];
      line.text += piece;
      if (piece.trim() && (s.bold || s.color)) line.styled = true;
    });
  }

  const sections: { title: string[]; lines: string[] }[] = [];
  let inTitle = false;
  for (const l of lines) {
    const raw = l.text.trim();
    if (!raw) continue;
    const heading = l.styled && !/^[-•*→]/.test(raw);
    if (heading) {
      const text = raw.replace(/[\s:]+$/, '');
      // "A. ...", "B) ..." o "Parte 2" abren sección; un título seguido de otro la completa.
      if (!inTitle || /^([A-Z][.)]|parte\s*\d)/i.test(text)) sections.push({ title: [], lines: [] });
      sections[sections.length - 1].title.push(text);
      inTitle = true;
    } else {
      if (!sections.length) sections.push({ title: [], lines: [] }); // WOD sin títulos
      sections[sections.length - 1].lines.push(raw);
      inTitle = false;
    }
  }
  return sections.map((s) => {
    const title = s.title.join(' · ').replace(/\s+/g, ' ');
    return { title, lines: s.lines, warmup: SKIP.test(title) };
  });
}

/** Títulos de las partes puntuables del WOD, en orden. */
export function detectParts(html: string | undefined): string[] {
  return wodSections(html)
    .filter((s) => s.title && !s.warmup)
    .map((s) => s.title)
    .slice(0, 6);
}

/** Primera línea de una parte ("4 rondas:", "AMRAP 10'"): ayuda a adivinar el formato. */
export function partScheme(html: string | undefined, title: string): string {
  return wodSections(html).find((s) => s.title === title)?.lines[0]?.replace(/[\s:]+$/, '') ?? '';
}

/** Formato más probable según el título (y el esquema) que puso el coach. */
export function guessType(label: string): ScoreType {
  if (/amrap/i.test(label)) return 'rounds';
  if (/\b\d*\s*rm\b|\b\d+\s*x\s*\d+\b|fuerza|carga|peso|\bkg\b|heavy|max(imo)?\b/i.test(label)) return 'load';
  if (/max\s*reps|reps?\s*max|m[aá]ximo de rep/i.test(label)) return 'reps';
  return 'time'; // For Time, "6 Rondas", chipper…
}

const toNum = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/**
 * Lo que escribió el socio → número. Permisivo: "2410", "24:10", "24.10" y
 * "24" (minutos) son tiempo; "7+12", "7 12" o "7" son rondas.
 * Devuelve null si está vacío o no se entiende.
 */
export function parseScore(type: ScoreType, raw: string): Omit<PartScore, 'label' | 'score_type'> | null {
  const s = raw.trim();
  if (!s) return null;
  const none = { time_seconds: null, rounds: null, reps: null, load_kg: null };

  if (type === 'time') {
    let min: number, sec: number;
    const sep = s.match(/^(\d{1,3})\s*[:.,'´\s]\s*(\d{1,2})$/);
    if (sep) [min, sec] = [Number(sep[1]), Number(sep[2])];
    else if (/^\d{3,4}$/.test(s)) [min, sec] = [Number(s.slice(0, -2)), Number(s.slice(-2))];
    else if (/^\d{1,2}$/.test(s)) [min, sec] = [Number(s), 0];
    else return null;
    if (sec >= 60) return null;
    const total = min * 60 + sec;
    return total > 0 && total < 6 * 3600 ? { ...none, time_seconds: total } : null;
  }
  if (type === 'rounds') {
    const m = s.match(/^(\d{1,3})(?:\s*[+\s]\s*(\d{1,4}))?$/);
    return m ? { ...none, rounds: Number(m[1]), reps: m[2] ? Number(m[2]) : null } : null;
  }
  if (type === 'load') {
    const n = toNum(s.replace(/\s*kg$/i, ''));
    return n && n > 0 && n < 1000 ? { ...none, load_kg: Math.round(n * 100) / 100 } : null;
  }
  const n = toNum(s);
  return n != null && n >= 0 && Number.isInteger(n) ? { ...none, reps: n } : null;
}

/** Al revés: el número guardado → texto del campo, para editar. */
export function scoreToInput(p: PartScore): string {
  if (p.score_type === 'time' && p.time_seconds != null)
    return `${Math.floor(p.time_seconds / 60)}:${String(p.time_seconds % 60).padStart(2, '0')}`;
  if (p.score_type === 'rounds' && p.rounds != null) return p.reps ? `${p.rounds}+${p.reps}` : String(p.rounds);
  if (p.score_type === 'load' && p.load_kg != null) return String(p.load_kg);
  if (p.score_type === 'reps' && p.reps != null) return String(p.reps);
  return '';
}
