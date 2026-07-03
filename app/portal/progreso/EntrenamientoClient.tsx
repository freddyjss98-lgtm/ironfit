"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { todayInEcuador } from "@/lib/date";
import { downloadCSV } from "@/lib/csv";
import {
  saveWorkoutSession,
  deleteWorkoutSession,
  createPersonalExercise,
  createRoutine,
  deleteRoutine,
} from "@/app/_actions/workout";

// ── Tipos ────────────────────────────────────────────────────────────────────────
export type Exercise = { id: string; name: string; muscle_group: string; is_global: boolean };
export type WorkoutSet = { exercise_id: string; set_number: number; weight_kg: number; reps: number };
export type WorkoutSession = { id: string; session_date: string; notes: string | null; sets: WorkoutSet[] };
export type RoutineExercise = { exercise_id: string; position: number; target_sets: number | null; target_reps: number | null };
export type Routine = { id: string; name: string; notes: string | null; exercises: RoutineExercise[] };

type Props = {
  memberId: string | null; // coach: id del socio; socio: null (usa su propio member)
  canEdit: boolean;
  exercises: Exercise[];
  sessions: WorkoutSession[]; // más reciente primero
  routines: Routine[];
};

const MUSCLES: { value: string; label: string }[] = [
  { value: "pectoral", label: "Pectoral" },
  { value: "triceps", label: "Tríceps" },
  { value: "pierna", label: "Pierna" },
  { value: "pantorrilla", label: "Pantorrilla" },
  { value: "espalda", label: "Espalda" },
  { value: "biceps", label: "Bíceps" },
  { value: "hombro", label: "Hombro" },
  { value: "otros", label: "Otros" },
];
const MUSCLE_LABEL: Record<string, string> = Object.fromEntries(MUSCLES.map((m) => [m.value, m.label]));

const inputCls =
  "bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-fg/20";

function fmtVol(n: number) {
  return new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 }).format(n);
}
function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${parseInt(day)} ${meses[parseInt(m) - 1]} ${y}`;
}
function setsSummary(sets: { w: number; r: number }[]) {
  return sets.map((s) => `${s.w % 1 === 0 ? s.w : s.w.toFixed(1)}×${s.r}`).join("  ");
}
function nice(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}
/** 1RM estimado (fórmula de Epley). */
function est1RM(weight: number, reps: number) {
  if (reps <= 0 || weight <= 0) return 0;
  return weight * (1 + reps / 30);
}

// ── Historial por ejercicio ────────────────────────────────────────────────────────
type ExPoint = {
  date: string;
  volume: number;
  sets: { w: number; r: number }[];
  pct: number | null;
  best1rm: number;
  topWeight: number;
};

function buildHistory(sessions: WorkoutSession[]) {
  const byEx = new Map<string, ExPoint[]>();
  for (const s of sessions) {
    const grouped = new Map<string, { w: number; r: number }[]>();
    for (const set of s.sets) {
      if (!grouped.has(set.exercise_id)) grouped.set(set.exercise_id, []);
      grouped.get(set.exercise_id)!.push({ w: set.weight_kg, r: set.reps });
    }
    for (const [exId, sets] of grouped) {
      const volume = sets.reduce((a, x) => a + x.w * x.r, 0);
      const best1rm = Math.max(0, ...sets.map((x) => est1RM(x.w, x.r)));
      const topWeight = Math.max(0, ...sets.map((x) => x.w));
      if (!byEx.has(exId)) byEx.set(exId, []);
      byEx.get(exId)!.push({ date: s.session_date, volume, sets, pct: null, best1rm, topWeight });
    }
  }
  for (const arr of byEx.values()) {
    arr.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    for (let i = 1; i < arr.length; i++) {
      const prev = arr[i - 1].volume;
      arr[i].pct = prev > 0 ? (arr[i].volume - prev) / prev : null;
    }
  }
  return byEx;
}

function PctBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-fg/25 text-xs">—</span>;
  const up = pct >= 0;
  return (
    <span className={`text-xs font-semibold ${up ? "text-emerald-400" : "text-red-400"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct * 100).toFixed(0)}%
    </span>
  );
}

function MiniVolumeChart({ points }: { points: ExPoint[] }) {
  const shown = points.slice(-16); // últimas 16 sesiones
  const max = Math.max(1, ...shown.map((p) => p.volume));
  return (
    <div className="flex items-end gap-0.5 h-14 px-1">
      {shown.map((p, i) => (
        <div
          key={i}
          className="flex-1 bg-accent/60 hover:bg-accent rounded-t transition-colors min-w-[3px]"
          style={{ height: `${Math.max(4, (p.volume / max) * 100)}%` }}
          title={`${fmtDate(p.date)} · vol ${fmtVol(p.volume)}`}
        />
      ))}
    </div>
  );
}

function ExerciseHistoryCard({ name, muscle, points }: { name: string; muscle: string; points: ExPoint[] }) {
  const [open, setOpen] = useState(false);
  const last = points[points.length - 1];
  const rev = [...points].reverse();

  // Récords (PRs)
  const prVol = Math.max(...points.map((p) => p.volume));
  const prWeight = Math.max(...points.map((p) => p.topWeight));
  const pr1rm = Math.max(...points.map((p) => p.best1rm));
  // ¿La última sesión igualó o superó el mejor registro PREVIO? (con 1 sola
  // sesión no hay récord que romper)
  const prev = points.slice(0, -1);
  const lastIsPR =
    prev.length > 0 &&
    (last.volume >= Math.max(...prev.map((p) => p.volume)) ||
      last.topWeight >= Math.max(...prev.map((p) => p.topWeight)) ||
      last.best1rm >= Math.max(...prev.map((p) => p.best1rm)));

  return (
    <div className="border border-line rounded-xl overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-white/5 text-left">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate flex items-center gap-1.5">
            {name}
            {lastIsPR && <span title="Récord reciente" className="text-amber-300 text-xs">★</span>}
          </p>
          <p className="text-fg/40 text-xs">{MUSCLE_LABEL[muscle] ?? muscle} · {points.length} sesión{points.length !== 1 ? "es" : ""}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-display text-lg leading-none">{fmtVol(last.volume)}</p>
          <div className="flex items-center gap-1 justify-end mt-0.5">
            <span className="text-[10px] text-fg/40 uppercase tracking-wider">vol</span>
            <PctBadge pct={last.pct} />
          </div>
        </div>
      </button>

      {open && (
        <div>
          {/* Récords */}
          <div className="grid grid-cols-3 gap-2 px-4 py-3 border-b border-line/50 bg-amber-400/[0.04]">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-fg/40">Mejor peso</p>
              <p className="font-semibold text-sm text-amber-200">{nice(prWeight)} kg</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-fg/40">1RM estimado</p>
              <p className="font-semibold text-sm text-amber-200">{fmtVol(pr1rm)} kg</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-fg/40">Mejor volumen</p>
              <p className="font-semibold text-sm text-amber-200">{fmtVol(prVol)}</p>
            </div>
          </div>

          {/* Mini-gráfico de volumen */}
          {points.length >= 2 && (
            <div className="px-3 py-3 border-b border-line/50">
              <p className="text-[10px] uppercase tracking-wider text-fg/40 mb-1 px-1">Volumen en el tiempo</p>
              <MiniVolumeChart points={points} />
            </div>
          )}

          {/* Sesiones */}
          <div className="divide-y divide-line/50">
            {rev.map((p, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <span className="text-fg/40 text-xs">{fmtDate(p.date)}</span>
                  <p className="text-fg/80 text-xs truncate">{setsSummary(p.sets)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-right">
                  <span className="text-fg/40 text-[11px]">1RM {fmtVol(p.best1rm)}</span>
                  <span className="font-semibold w-14 text-right">{fmtVol(p.volume)}</span>
                  <span className="w-12 text-right"><PctBadge pct={p.pct} /></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Timer de descanso ───────────────────────────────────────────────────────────────
const REST_PRESETS = [60, 90, 120, 180];
function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
}
function RestTimer() {
  const [remaining, setRemaining] = useState(0);
  const remRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function setRem(v: number) {
    remRef.current = v;
    setRemaining(v);
  }
  function stop() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }
  function start(sec: number) {
    stop();
    setRem(sec);
    intervalRef.current = setInterval(() => {
      const next = remRef.current - 1;
      if (next <= 0) {
        stop();
        setRem(0);
        try { navigator.vibrate?.(400); } catch {}
        toast.success("¡Descanso terminado! 💪");
      } else {
        setRem(next);
      }
    }, 1000);
  }

  useEffect(() => () => stop(), []);

  return (
    <div className="flex items-center gap-2 flex-wrap bg-white/5 border border-line rounded-lg px-3 py-2">
      <span className="text-[10px] text-fg/40 uppercase tracking-wider">Descanso</span>
      {remaining > 0 ? (
        <>
          <span className="font-display text-lg tabular-nums text-accent leading-none">{mmss(remaining)}</span>
          <button onClick={() => { stop(); setRem(0); }} className="text-xs text-fg/50 hover:text-fg ml-auto">Detener</button>
        </>
      ) : (
        <div className="flex gap-1 flex-wrap">
          {REST_PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => start(s)}
              className="text-xs font-semibold px-2.5 py-1 rounded-md border border-line hover:border-accent hover:text-accent transition-colors"
            >
              {mmss(s)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Formulario de registro ──────────────────────────────────────────────────────────
type DraftSet = { weight: string; reps: string };
type DraftEntry = { key: string; exerciseId: string; sets: DraftSet[] };

let keySeq = 0;
const newKey = () => `k${keySeq++}`;

function routineToEntries(
  routine: Routine,
  lastSetsFor: (id: string) => { w: number; r: number }[] | null
): DraftEntry[] {
  return [...routine.exercises]
    .sort((a, b) => a.position - b.position)
    .map((re) => {
      const last = lastSetsFor(re.exercise_id);
      let sets: DraftSet[];
      if (re.target_sets && re.target_sets > 0) {
        sets = Array.from({ length: re.target_sets }, (_, i) => ({
          weight: last && last[i] ? String(last[i].w) : "",
          reps: re.target_reps ? String(re.target_reps) : last && last[i] ? String(last[i].r) : "",
        }));
      } else if (last && last.length > 0) {
        sets = last.map((s) => ({ weight: String(s.w), reps: String(s.r) }));
      } else {
        sets = [{ weight: "", reps: "" }];
      }
      return { key: newKey(), exerciseId: re.exercise_id, sets };
    });
}

function RegisterModal({
  memberId,
  exercises,
  routines,
  initialEntries,
  lastSetsFor,
  onClose,
}: {
  memberId: string | null;
  exercises: Exercise[];
  routines: Routine[];
  initialEntries?: DraftEntry[] | null;
  lastSetsFor: (exId: string) => { w: number; r: number }[] | null;
  onClose: () => void;
}) {
  const today = todayInEcuador();
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<DraftEntry[]>(
    initialEntries && initialEntries.length > 0
      ? initialEntries
      : [{ key: newKey(), exerciseId: "", sets: [{ weight: "", reps: "" }] }]
  );
  const [extra, setExtra] = useState<Exercise[]>([]);
  const [showNewEx, setShowNewEx] = useState(false);
  const [newExName, setNewExName] = useState("");
  const [newExMuscle, setNewExMuscle] = useState("pectoral");
  const [pending, startTransition] = useTransition();

  // Dedupe: tras crear un ejercicio propio, la revalidación lo trae también en
  // `exercises` y quedaría repetido junto al de `extra`.
  const allExercises = useMemo(() => {
    const seen = new Set<string>();
    return [...exercises, ...extra].filter((e) => !seen.has(e.id) && (seen.add(e.id), true));
  }, [exercises, extra]);
  const grouped = useMemo(() => {
    const g: Record<string, Exercise[]> = {};
    for (const e of allExercises) (g[e.muscle_group] ??= []).push(e);
    return g;
  }, [allExercises]);

  function setEntry(key: string, patch: Partial<DraftEntry>) {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  }
  function onPickExercise(key: string, exId: string) {
    const last = exId ? lastSetsFor(exId) : null;
    const sets: DraftSet[] = last && last.length > 0
      ? last.map((s) => ({ weight: String(s.w), reps: String(s.r) }))
      : [{ weight: "", reps: "" }];
    setEntry(key, { exerciseId: exId, sets });
  }
  function addSet(key: string) {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, sets: [...e.sets, { weight: "", reps: "" }] } : e)));
  }
  function removeSet(key: string, idx: number) {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, sets: e.sets.filter((_, i) => i !== idx) } : e)));
  }
  function setSetVal(key: string, idx: number, field: keyof DraftSet, val: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.key === key ? { ...e, sets: e.sets.map((s, i) => (i === idx ? { ...s, [field]: val } : s)) } : e
      )
    );
  }

  function createExercise() {
    startTransition(async () => {
      try {
        const created = await createPersonalExercise(newExName, newExMuscle, memberId);
        if (created) {
          setExtra((p) => [...p, created as Exercise]);
          toast.success("Ejercicio agregado");
          setShowNewEx(false);
          setNewExName("");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo agregar");
      }
    });
  }

  function save() {
    if (!date) {
      toast.error("Elige la fecha del entrenamiento");
      return;
    }
    if (date > today) {
      toast.error("La fecha no puede ser futura");
      return;
    }
    const payload = entries
      .filter((e) => e.exerciseId)
      .map((e) => ({
        exerciseId: e.exerciseId,
        sets: e.sets
          .map((s) => ({ weight: parseFloat(s.weight) || 0, reps: parseInt(s.reps) || 0 }))
          .filter((s) => s.reps > 0),
      }))
      .filter((e) => e.sets.length > 0);

    if (payload.length === 0) {
      toast.error("Agrega al menos un ejercicio con una serie (reps)");
      return;
    }
    startTransition(async () => {
      try {
        await saveWorkoutSession({ memberId, sessionDate: date, notes, entries: payload });
        toast.success("Entrenamiento guardado");
        onClose();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo guardar");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-bg-2 border border-line rounded-2xl w-full max-w-lg p-5 space-y-4 my-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl uppercase tracking-tight">Registrar entrenamiento</h3>
          <button onClick={onClose} className="text-fg/40 hover:text-fg text-2xl leading-none">×</button>
        </div>

        <div className="grid grid-cols-2 gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-fg/40">Fecha</label>
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <RestTimer />
        </div>

        {routines.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-fg/40">Cargar rutina</label>
            <select
              className={inputCls}
              defaultValue=""
              onChange={(e) => {
                const r = routines.find((x) => x.id === e.target.value);
                if (r) setEntries(routineToEntries(r, lastSetsFor));
                e.target.value = "";
              }}
            >
              <option value="">Elegir rutina…</option>
              {routines.map((r) => (
                <option key={r.id} value={r.id} className="bg-bg-2">{r.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Ejercicios */}
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.key} className="border border-line rounded-xl p-3 space-y-2 bg-white/5">
              <div className="flex items-center gap-2">
                <select
                  value={entry.exerciseId}
                  onChange={(e) => onPickExercise(entry.key, e.target.value)}
                  className={inputCls + " flex-1"}
                >
                  <option value="">Elegir ejercicio…</option>
                  {MUSCLES.filter((m) => grouped[m.value]?.length).map((m) => (
                    <optgroup key={m.value} label={m.label}>
                      {grouped[m.value].map((ex) => (
                        <option key={ex.id} value={ex.id} className="bg-bg-2">{ex.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {entries.length > 1 && (
                  <button
                    onClick={() => setEntries((p) => p.filter((x) => x.key !== entry.key))}
                    className="text-fg/30 hover:text-red-400 text-sm px-1"
                    title="Quitar ejercicio"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Series */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center text-[10px] uppercase tracking-wider text-fg/30 px-1">
                  <span className="w-6">#</span><span>Peso (kg)</span><span>Reps</span><span />
                </div>
                {entry.sets.map((s, i) => (
                  <div key={i} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center">
                    <span className="w-6 text-center text-fg/40 text-sm">{i + 1}</span>
                    <input
                      type="number" inputMode="decimal" step="0.5" min="0" placeholder="0"
                      value={s.weight} onChange={(e) => setSetVal(entry.key, i, "weight", e.target.value)}
                      className={inputCls}
                    />
                    <input
                      type="number" inputMode="numeric" min="0" placeholder="0"
                      value={s.reps} onChange={(e) => setSetVal(entry.key, i, "reps", e.target.value)}
                      className={inputCls}
                    />
                    <button
                      onClick={() => removeSet(entry.key, i)} disabled={entry.sets.length === 1}
                      className="text-fg/30 hover:text-red-400 disabled:opacity-20 px-1"
                      title="Quitar serie"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button onClick={() => addSet(entry.key)} className="text-xs text-accent hover:underline mt-1">
                  + Agregar serie
                </button>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setEntries((p) => [...p, { key: newKey(), exerciseId: "", sets: [{ weight: "", reps: "" }] }])}
              className="text-sm font-semibold text-fg/70 hover:text-fg border border-line hover:border-accent px-3 py-1.5 rounded-lg transition-colors"
            >
              + Agregar ejercicio
            </button>
            <button
              onClick={() => setShowNewEx((v) => !v)}
              className="text-sm font-semibold text-fg/50 hover:text-fg px-2 py-1.5 transition-colors"
            >
              ¿No está el ejercicio? Crear
            </button>
          </div>

          {showNewEx && (
            <div className="border border-line rounded-xl p-3 space-y-2 bg-white/5">
              <input
                value={newExName} onChange={(e) => setNewExName(e.target.value)}
                placeholder="Nombre del ejercicio" className={inputCls + " w-full"}
              />
              <div className="flex gap-2">
                <select value={newExMuscle} onChange={(e) => setNewExMuscle(e.target.value)} className={inputCls + " flex-1"}>
                  {MUSCLES.map((m) => <option key={m.value} value={m.value} className="bg-bg-2">{m.label}</option>)}
                </select>
                <button
                  onClick={createExercise} disabled={pending || !newExName.trim()}
                  className="px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-bold rounded-lg disabled:opacity-50"
                >
                  Crear
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-fg/40">Nota (opcional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. día pesado, buena energía" className={inputCls + " w-full"} />
        </div>

        <div className="flex justify-end gap-2 pt-1 border-t border-line">
          <button onClick={onClose} disabled={pending} className="px-4 py-2 text-sm font-semibold text-fg/60 hover:text-fg disabled:opacity-50">Cancelar</button>
          <button onClick={save} disabled={pending} className="px-5 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-bold rounded-lg disabled:opacity-50">
            {pending ? "Guardando…" : "Guardar entrenamiento"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Constructor de rutinas ──────────────────────────────────────────────────────────
function RoutineBuilderModal({
  memberId,
  exercises,
  onClose,
}: {
  memberId: string | null;
  exercises: Exercise[];
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<{ key: string; exerciseId: string; sets: string; reps: string }[]>([
    { key: newKey(), exerciseId: "", sets: "", reps: "" },
  ]);
  const [pending, startTransition] = useTransition();
  const grouped = useMemo(() => {
    const g: Record<string, Exercise[]> = {};
    for (const e of exercises) (g[e.muscle_group] ??= []).push(e);
    return g;
  }, [exercises]);

  function save() {
    if (!name.trim()) { toast.error("Ponle un nombre a la rutina"); return; }
    const exs = rows
      .filter((r) => r.exerciseId)
      .map((r) => ({ exerciseId: r.exerciseId, targetSets: parseInt(r.sets) || null, targetReps: parseInt(r.reps) || null }));
    if (exs.length === 0) { toast.error("Agrega al menos un ejercicio"); return; }
    startTransition(async () => {
      try {
        await createRoutine({ memberId, name, notes, exercises: exs });
        toast.success("Rutina creada");
        onClose();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo crear");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-bg-2 border border-line rounded-2xl w-full max-w-lg p-5 space-y-4 my-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl uppercase tracking-tight">Nueva rutina</h3>
          <button onClick={onClose} className="text-fg/40 hover:text-fg text-2xl leading-none">×</button>
        </div>

        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (ej. Día de pecho)" className={inputCls + " w-full"} />

        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[10px] uppercase tracking-wider text-fg/30 px-1">
            <span>Ejercicio</span><span className="w-12 text-center">Series</span><span className="w-12 text-center">Reps</span><span className="w-5" />
          </div>
          {rows.map((row) => (
            <div key={row.key} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
              <select
                value={row.exerciseId}
                onChange={(e) => setRows((p) => p.map((x) => (x.key === row.key ? { ...x, exerciseId: e.target.value } : x)))}
                className={inputCls}
              >
                <option value="">Elegir…</option>
                {MUSCLES.filter((m) => grouped[m.value]?.length).map((m) => (
                  <optgroup key={m.value} label={m.label}>
                    {grouped[m.value].map((ex) => <option key={ex.id} value={ex.id} className="bg-bg-2">{ex.name}</option>)}
                  </optgroup>
                ))}
              </select>
              <input type="number" min="1" placeholder="—" value={row.sets}
                onChange={(e) => setRows((p) => p.map((x) => (x.key === row.key ? { ...x, sets: e.target.value } : x)))}
                className={inputCls + " w-12 text-center px-1"} />
              <input type="number" min="1" placeholder="—" value={row.reps}
                onChange={(e) => setRows((p) => p.map((x) => (x.key === row.key ? { ...x, reps: e.target.value } : x)))}
                className={inputCls + " w-12 text-center px-1"} />
              <button onClick={() => setRows((p) => (p.length > 1 ? p.filter((x) => x.key !== row.key) : p))}
                className="text-fg/30 hover:text-red-400 w-5">✕</button>
            </div>
          ))}
          <button
            onClick={() => setRows((p) => [...p, { key: newKey(), exerciseId: "", sets: "", reps: "" }])}
            className="text-xs text-accent hover:underline"
          >
            + Agregar ejercicio
          </button>
        </div>

        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Nota (opcional)" className={inputCls + " w-full"} />

        <div className="flex justify-end gap-2 pt-1 border-t border-line">
          <button onClick={onClose} disabled={pending} className="px-4 py-2 text-sm font-semibold text-fg/60 hover:text-fg disabled:opacity-50">Cancelar</button>
          <button onClick={save} disabled={pending} className="px-5 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-bold rounded-lg disabled:opacity-50">
            {pending ? "Guardando…" : "Crear rutina"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Logros ────────────────────────────────────────────────────────────────────────────
function computeAchievements(sessions: WorkoutSession[], history: Map<string, ExPoint[]>) {
  const count = sessions.length;
  const totalVolume = sessions.reduce((a, s) => a + s.sets.reduce((b, x) => b + x.weight_kg * x.reps, 0), 0);
  // PRs: ejercicios donde la última sesión igualó el mejor volumen/peso/1RM
  let prExercises = 0;
  for (const pts of history.values()) {
    if (pts.length < 2) continue;
    const last = pts[pts.length - 1];
    const prVol = Math.max(...pts.map((p) => p.volume));
    const prW = Math.max(...pts.map((p) => p.topWeight));
    const pr1 = Math.max(...pts.map((p) => p.best1rm));
    if (last.volume >= prVol || last.topWeight >= prW || last.best1rm >= pr1) prExercises++;
  }
  const badges = [
    { key: "first", label: "Primer entreno", icon: "🌱", got: count >= 1 },
    { key: "s10", label: "10 sesiones", icon: "🔥", got: count >= 10 },
    { key: "s50", label: "50 sesiones", icon: "💪", got: count >= 50 },
    { key: "s100", label: "100 sesiones", icon: "🏆", got: count >= 100 },
    { key: "pr", label: "Rompió récord", icon: "⭐", got: prExercises > 0 },
    { key: "vol50k", label: "50k kg movidos", icon: "🦾", got: totalVolume >= 50000 },
    { key: "vol250k", label: "250k kg movidos", icon: "🚀", got: totalVolume >= 250000 },
  ];
  return badges;
}

// ── Componente principal ──────────────────────────────────────────────────────────────
export default function EntrenamientoClient({ memberId, canEdit, exercises, sessions, routines }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [formInitial, setFormInitial] = useState<DraftEntry[] | null>(null);
  const [showRoutine, setShowRoutine] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [delRoutineId, setDelRoutineId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const history = useMemo(() => buildHistory(sessions), [sessions]);
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  // Ejercicios con historial, ordenados por actividad más reciente.
  const exerciseCards = useMemo(() => {
    const arr = Array.from(history.entries())
      .map(([exId, points]) => ({ exId, points, last: points[points.length - 1].date }))
      .filter((x) => exMap.has(x.exId));
    arr.sort((a, b) => (a.last < b.last ? 1 : -1));
    return arr;
  }, [history, exMap]);

  // Volumen total por grupo muscular (histórico)
  const muscleVolume = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const s of sessions)
      for (const set of s.sets) {
        const mg = exMap.get(set.exercise_id)?.muscle_group ?? "otros";
        totals[mg] = (totals[mg] ?? 0) + set.weight_kg * set.reps;
      }
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [sessions, exMap]);
  const muscleVolumeMax = muscleVolume.length ? Math.max(...muscleVolume.map(([, v]) => v)) : 0;

  function lastSetsFor(exId: string) {
    const pts = history.get(exId);
    return pts && pts.length > 0 ? pts[pts.length - 1].sets : null;
  }

  // Resumen: sesiones, volumen de la última y total histórico movido.
  const sessionCount = sessions.length;
  const totalVolumeLast = sessions[0]
    ? sessions[0].sets.reduce((a, s) => a + s.weight_kg * s.reps, 0)
    : 0;
  const totalVolumeAll = useMemo(
    () => sessions.reduce((a, s) => a + s.sets.reduce((b, x) => b + x.weight_kg * x.reps, 0), 0),
    [sessions]
  );

  const achievements = useMemo(() => computeAchievements(sessions, history), [sessions, history]);
  const earned = achievements.filter((a) => a.got);

  function openRegister(preset: DraftEntry[] | null) {
    setFormInitial(preset);
    setShowForm(true);
  }
  function applyRoutine(r: Routine) {
    openRegister(routineToEntries(r, lastSetsFor));
  }

  function exportCSV() {
    const rows: (string | number)[][] = [];
    for (const s of sessions) {
      const byEx = new Map<string, WorkoutSet[]>();
      for (const set of s.sets) {
        if (!byEx.has(set.exercise_id)) byEx.set(set.exercise_id, []);
        byEx.get(set.exercise_id)!.push(set);
      }
      for (const [exId, sets] of byEx) {
        const ex = exMap.get(exId);
        sets
          .sort((a, b) => a.set_number - b.set_number)
          .forEach((set) => {
            rows.push([
              s.session_date,
              ex?.name ?? exId,
              MUSCLE_LABEL[ex?.muscle_group ?? ""] ?? "",
              set.set_number,
              set.weight_kg,
              set.reps,
              set.weight_kg * set.reps,
            ]);
          });
      }
    }
    downloadCSV(
      `entrenamiento-${todayInEcuador()}.csv`,
      ["Fecha", "Ejercicio", "Grupo", "Serie", "Peso (kg)", "Reps", "Volumen serie"],
      rows
    );
  }

  function confirmDelete() {
    if (!delId) return;
    startTransition(async () => {
      try {
        await deleteWorkoutSession(delId);
        toast.success("Sesión eliminada");
        setDelId(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
      }
    });
  }

  function confirmDeleteRoutine() {
    if (!delRoutineId) return;
    startTransition(async () => {
      try {
        await deleteRoutine(delRoutineId);
        toast.success("Rutina eliminada");
        setDelRoutineId(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Resumen + acción */}
      <div className="flex items-end justify-between gap-3">
        <div className="grid grid-cols-3 gap-3 flex-1 max-w-md">
          <div className="bg-white/5 border border-line rounded-xl p-3">
            <span className="text-[10px] uppercase tracking-wider text-fg/40">Sesiones</span>
            <p className="font-display text-2xl">{sessionCount}</p>
          </div>
          <div className="bg-white/5 border border-line rounded-xl p-3">
            <span className="text-[10px] uppercase tracking-wider text-fg/40">Vol. última</span>
            <p className="font-display text-2xl">{fmtVol(totalVolumeLast)}</p>
          </div>
          <div className="bg-white/5 border border-line rounded-xl p-3">
            <span className="text-[10px] uppercase tracking-wider text-fg/40">Total movido</span>
            <p className="font-display text-2xl">{fmtVol(totalVolumeAll)}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {canEdit && (
            <button
              onClick={() => openRegister(null)}
              className="px-4 py-2.5 bg-accent hover:bg-accent/80 text-white text-sm font-bold rounded-lg transition-colors"
            >
              + Registrar
            </button>
          )}
          {sessions.length > 0 && (
            <button
              onClick={exportCSV}
              className="px-4 py-2 border border-line hover:border-accent hover:text-accent text-xs font-semibold rounded-lg transition-colors"
            >
              Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* Logros */}
      {earned.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {earned.map((b) => (
            <span
              key={b.key}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-300/30 bg-amber-400/10 text-amber-200 text-xs font-semibold"
              title="Logro desbloqueado"
            >
              <span aria-hidden>{b.icon}</span> {b.label}
            </span>
          ))}
        </div>
      )}

      {/* Rutinas */}
      {(canEdit || routines.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base uppercase tracking-tight text-fg/70">Rutinas</h3>
            {canEdit && (
              <button onClick={() => setShowRoutine(true)} className="text-xs font-semibold text-accent hover:underline">
                + Nueva rutina
              </button>
            )}
          </div>
          {routines.length === 0 ? (
            <p className="text-fg/30 text-sm">Sin rutinas. Crea una para registrar más rápido.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {routines.map((r) => (
                <div key={r.id} className="border border-line rounded-xl px-4 py-3 flex items-center justify-between gap-2 bg-white/5">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{r.name}</p>
                    <p className="text-fg/40 text-xs">{r.exercises.length} ejercicio{r.exercises.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canEdit && (
                      <button onClick={() => applyRoutine(r)} className="text-xs font-bold px-3 py-1.5 bg-accent/15 hover:bg-accent/25 text-accent rounded-lg transition-colors">
                        Usar
                      </button>
                    )}
                    {canEdit && (
                      <button onClick={() => setDelRoutineId(r.id)} className="text-xs text-red-400/70 hover:text-red-400">Eliminar</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Volumen por grupo muscular */}
      {muscleVolume.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-base uppercase tracking-tight text-fg/70">Volumen por grupo muscular</h3>
          <div className="bg-white/5 border border-line rounded-xl p-4 space-y-2">
            {muscleVolume.map(([mg, v]) => (
              <div key={mg} className="flex items-center gap-3">
                <span className="text-xs text-fg/60 w-24 shrink-0">{MUSCLE_LABEL[mg] ?? mg}</span>
                <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${(v / muscleVolumeMax) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold w-16 text-right">{fmtVol(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial por ejercicio */}
      {exerciseCards.length === 0 ? (
        <div className="bg-white/5 border border-line rounded-2xl px-5 py-12 text-center">
          <p className="text-fg/40 text-sm">Aún no hay entrenamientos registrados.</p>
          {canEdit && <p className="text-fg/30 text-xs mt-1">Toca en “+ Registrar” para empezar tu historial.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="font-display text-base uppercase tracking-tight text-fg/70">Progreso por ejercicio</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {exerciseCards.map(({ exId, points }) => {
              const ex = exMap.get(exId)!;
              return <ExerciseHistoryCard key={exId} name={ex.name} muscle={ex.muscle_group} points={points} />;
            })}
          </div>
        </div>
      )}

      {/* Sesiones recientes (para borrar) */}
      {canEdit && sessions.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-base uppercase tracking-tight text-fg/70">Sesiones recientes</h3>
          <div className="divide-y divide-line/50 border border-line rounded-xl overflow-hidden">
            {sessions.slice(0, 8).map((s) => {
              const exCount = new Set(s.sets.map((x) => x.exercise_id)).size;
              const vol = s.sets.reduce((a, x) => a + x.weight_kg * x.reps, 0);
              return (
                <div key={s.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm bg-white/5">
                  <div className="min-w-0">
                    <span className="font-medium">{fmtDate(s.session_date)}</span>
                    <p className="text-fg/40 text-xs">{exCount} ejercicio{exCount !== 1 ? "s" : ""} · vol {fmtVol(vol)}{s.notes ? ` · ${s.notes}` : ""}</p>
                  </div>
                  <button onClick={() => setDelId(s.id)} className="text-xs text-red-400/70 hover:text-red-400 shrink-0">Eliminar</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showForm && (
        <RegisterModal
          memberId={memberId}
          exercises={exercises}
          routines={routines}
          initialEntries={formInitial}
          lastSetsFor={lastSetsFor}
          onClose={() => { setShowForm(false); setFormInitial(null); }}
        />
      )}

      {showRoutine && (
        <RoutineBuilderModal memberId={memberId} exercises={exercises} onClose={() => setShowRoutine(false)} />
      )}

      {delRoutineId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-bg-2 border border-line rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="font-display text-lg uppercase tracking-tight">Eliminar rutina</h3>
            <p className="text-sm text-fg/60">Se eliminará esta rutina. Tus entrenamientos ya registrados no se tocan.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDelRoutineId(null)} disabled={pending} className="px-4 py-2 text-sm font-semibold text-fg/60 hover:text-fg disabled:opacity-50">Cancelar</button>
              <button onClick={confirmDeleteRoutine} disabled={pending} className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                {pending ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-bg-2 border border-line rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="font-display text-lg uppercase tracking-tight">Eliminar sesión</h3>
            <p className="text-sm text-fg/60">Se borrará esta sesión y todas sus series. No se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDelId(null)} disabled={pending} className="px-4 py-2 text-sm font-semibold text-fg/60 hover:text-fg disabled:opacity-50">Cancelar</button>
              <button onClick={confirmDelete} disabled={pending} className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                {pending ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
