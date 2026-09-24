"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import PreviewBanner from "../_components/PreviewBanner";
import {
  addMyProgress,
  deleteMyProgress,
  setMyWeightGoal,
  addMyAttendance,
} from "./actions";

// ── Tipos ───────────────────────────────────────────────────────────────────────
type MetricKey =
  | "weight"
  | "body_fat"
  | "muscle_mass"
  | "chest_cm"
  | "waist_cm"
  | "hips_cm"
  | "arm_cm"
  | "leg_cm";

type Progress = {
  id: string;
  measured_at: string;
  weight: number | null;
  body_fat: number | null;
  muscle_mass: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  arm_cm: number | null;
  leg_cm: number | null;
  notes: string | null;
  photo_url: string | null;
  is_own: boolean;
};

type AttendanceRow = {
  id: string;
  checked_in_at: string;
  checked_in_date: string;
};

type Props = {
  heightCm: number | null;
  targetWeight: number | null;
  isPreview: boolean;
  memberName: string;
  progress: Progress[];
  hasActiveMembership: boolean;
  checkedInToday: boolean;
  today: string;
  attendanceStats: { total: number; thisMonth: number; last7: number };
  attendedDates: string[];
  attendanceHistory: AttendanceRow[];
};

// ── Config de métricas ───────────────────────────────────────────────────────────
const METRICS: { key: MetricKey; label: string; unit: string; goodDir: "down" | "up" }[] = [
  { key: "weight", label: "Peso", unit: "kg", goodDir: "down" },
  { key: "body_fat", label: "% Grasa", unit: "%", goodDir: "down" },
  { key: "muscle_mass", label: "Músculo", unit: "kg", goodDir: "up" },
  { key: "chest_cm", label: "Pecho", unit: "cm", goodDir: "up" },
  { key: "waist_cm", label: "Cintura", unit: "cm", goodDir: "down" },
  { key: "hips_cm", label: "Cadera", unit: "cm", goodDir: "down" },
  { key: "arm_cm", label: "Brazo", unit: "cm", goodDir: "up" },
  { key: "leg_cm", label: "Pierna", unit: "cm", goodDir: "up" },
];

const inputCls =
  "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-fg/20";
const labelMini = "text-fg/50 text-xs uppercase tracking-wider";

const MES_ABBR = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

// Formato determinista a partir de "YYYY-MM-DD" (sin Date/locale → no rompe hidratación).
function fmtDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return `${d} ${MES_ABBR[(m || 1) - 1]} ${y}`;
}

// Hora local de Ecuador construida desde partes numéricas: idéntica en server y cliente.
function fmtTimeEC(iso: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dp = get("dayPeriod").toUpperCase().startsWith("A") ? "a.m." : "p.m.";
  return `${get("hour")}:${get("minute")} ${dp}`;
}

function todayLocal() {
  return new Date().toLocaleDateString("en-CA");
}

// ── Gráfico de peso (SVG) ────────────────────────────────────────────────────────
function WeightChart({ data }: { data: Progress[] }) {
  const points = data
    .filter((d) => d.weight !== null)
    .slice(0, 12)
    .reverse();
  if (points.length < 2) return null;

  const weights = points.map((d) => d.weight!);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const w = 300;
  const h = 80;

  const pts = weights
    .map((v, i) => {
      const x = (i / (weights.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
        <polyline points={pts} fill="none" stroke="#e84b1f" strokeWidth="2.5" strokeLinejoin="round" />
        {weights.map((v, i) => {
          const x = (i / (weights.length - 1)) * w;
          const y = h - ((v - min) / range) * (h - 8) - 4;
          return <circle key={i} cx={x} cy={y} r="3" fill="#e84b1f" />;
        })}
      </svg>
      <div className="flex justify-between text-xs text-fg/30 mt-1">
        <span>{fmtDate(points[0].measured_at)}</span>
        <span>{fmtDate(points[points.length - 1].measured_at)}</span>
      </div>
    </div>
  );
}

// ── Delta coloreado ──────────────────────────────────────────────────────────────
function Delta({ value, goodDir }: { value: number; goodDir: "down" | "up" }) {
  if (value === 0) return <span className="text-fg/30 text-xs">±0</span>;
  const isGood = goodDir === "down" ? value < 0 : value > 0;
  const color = isGood ? "text-emerald-400" : "text-amber-400";
  const arrow = value < 0 ? "↓" : "↑";
  return (
    <span className={`text-xs font-medium ${color}`}>
      {arrow} {Math.abs(value).toFixed(1)}
    </span>
  );
}

// ── Modal: registrar medición ─────────────────────────────────────────────────────
function RegisterModal({ onClose }: { onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await addMyProgress(fd);
        toast.success("Medición registrada");
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-line rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-lg uppercase tracking-tight">Registrar medición</h2>
          <button onClick={onClose} className="text-fg/40 hover:text-fg text-xl leading-none">
            ✕
          </button>
        </div>
        <p className="text-fg/40 text-xs mb-5">Ingresa al menos un dato. Lo que dejes vacío se omite.</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelMini}>Fecha</label>
            <input type="date" name="measured_at" defaultValue={todayLocal()} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {METRICS.map((m) => (
              <div key={m.key} className="flex flex-col gap-1.5">
                <label className={labelMini}>
                  {m.label} ({m.unit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  name={m.key}
                  inputMode="decimal"
                  placeholder="—"
                  className={inputCls}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelMini}>Notas (opcional)</label>
            <textarea name="notes" rows={2} className={inputCls + " resize-none"} placeholder="Cómo te sentiste, observaciones..." />
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {pending ? "Guardando..." : "Guardar medición"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: fijar meta de peso ──────────────────────────────────────────────────────
function GoalModal({ current, onClose }: { current: number | null; onClose: () => void }) {
  const [value, setValue] = useState(current != null ? String(current) : "");
  const [pending, startTransition] = useTransition();

  function save(target: number | null) {
    startTransition(async () => {
      try {
        await setMyWeightGoal(target);
        toast.success(target == null ? "Meta eliminada" : "Meta guardada");
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al guardar meta");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-line rounded-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-lg uppercase tracking-tight">Meta de peso</h2>
          <button onClick={onClose} className="text-fg/40 hover:text-fg text-xl leading-none">
            ✕
          </button>
        </div>
        <p className="text-fg/40 text-xs mb-5">Define tu peso objetivo para ver tu avance.</p>

        <div className="flex flex-col gap-1.5">
          <label className={labelMini}>Peso objetivo (kg)</label>
          <input
            type="number"
            step="0.1"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ej. 75"
            className={inputCls}
          />
        </div>

        <div className="flex gap-3 justify-between items-center mt-6 pt-4 border-t border-line">
          {current != null ? (
            <button
              onClick={() => save(null)}
              disabled={pending}
              className="text-xs text-fg/40 hover:text-red-400 transition-colors disabled:opacity-40"
            >
              Quitar meta
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                const n = parseFloat(value);
                if (!Number.isFinite(n) || n <= 0) {
                  toast.error("Ingresa un peso válido");
                  return;
                }
                save(n);
              }}
              disabled={pending}
              className="px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {pending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Calendario de asistencia ────────────────────────────────────────────────────
const MONTHS_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"]; // Lunes → Domingo

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function AttendanceCalendar({ attended, today }: { attended: Set<string>; today: string }) {
  const [offset, setOffset] = useState(0); // 0 = mes actual

  const base = new Date(today + "T00:00:00");
  const view = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();

  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Lunes=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const ds = (d: number) => `${year}-${pad2(month + 1)}-${pad2(d)}`;
  const attendedThisMonth = cells.filter((d) => d != null && attended.has(ds(d))).length;

  return (
    <div className="bg-white/5 border border-line rounded-2xl p-5">
      {/* Navegación de mes */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setOffset((o) => o - 1)}
          disabled={offset <= -3}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-line text-fg/50 hover:text-fg disabled:opacity-30 transition-colors"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="font-display text-sm uppercase tracking-tight">
            {MONTHS_FULL[month]} {year}
          </p>
          <p className="text-fg/30 text-xs">
            {attendedThisMonth} día{attendedThisMonth !== 1 ? "s" : ""} asistido
            {attendedThisMonth !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setOffset((o) => o + 1)}
          disabled={offset >= 0}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-line text-fg/50 hover:text-fg disabled:opacity-30 transition-colors"
        >
          ›
        </button>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-center text-fg/30 text-xs py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Celdas del mes */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d == null) return <div key={`e${i}`} />;
          const date = ds(d);
          const isAttended = attended.has(date);
          const isToday = date === today;
          const isFuture = date > today;
          return (
            <div key={date} className="aspect-square flex items-center justify-center">
              <div
                title={isAttended ? "Asististe" : undefined}
                className={`w-full h-full flex items-center justify-center rounded-lg text-sm ${
                  isAttended
                    ? "bg-accent text-white font-semibold"
                    : isToday
                      ? "border border-accent/60 text-accent"
                      : isFuture
                        ? "text-fg/20"
                        : "text-fg/55"
                }`}
              >
                {d}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 mt-4 text-xs text-fg/30">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-accent" /> Asististe
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-accent/60" /> Hoy
        </span>
      </div>
    </div>
  );
}

// ── Pestaña de Asistencia ───────────────────────────────────────────────────────
function AttendanceTab({
  stats,
  attendedDates,
  today,
  history,
  checkedInToday,
  hasActiveMembership,
  isPreview,
}: {
  stats: { total: number; thisMonth: number; last7: number };
  attendedDates: string[];
  today: string;
  history: AttendanceRow[];
  checkedInToday: boolean;
  hasActiveMembership: boolean;
  isPreview: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const attended = new Set(attendedDates);

  function handleCheckIn() {
    startTransition(async () => {
      try {
        await addMyAttendance();
        toast.success("¡Asistencia registrada! 💪");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al registrar");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Tarjeta de check-in */}
      {!isPreview && (
        <div className="bg-white/5 border border-line rounded-2xl p-5">
          {!hasActiveMembership ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-xl leading-none">⚠️</span>
                <div>
                  <p className="text-amber-300 font-semibold text-sm">Tu membresía no está activa</p>
                  <p className="text-fg/50 text-xs mt-0.5">
                    Necesitas una membresía vigente para registrar tu asistencia.
                  </p>
                </div>
              </div>
              <Link
                href="/portal/renovar"
                className="shrink-0 text-center bg-accent hover:bg-accent/80 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Renovar membresía
              </Link>
            </div>
          ) : checkedInToday ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-400 text-xl">
                ✓
              </span>
              <div>
                <p className="text-emerald-400 font-semibold text-sm">
                  ¡Asistencia de hoy registrada!
                </p>
                <p className="text-fg/40 text-xs mt-0.5">Nos vemos en el gym 💪</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm">¿Ya estás en el gimnasio?</p>
                <p className="text-fg/40 text-xs mt-0.5">Registra tu visita de hoy.</p>
              </div>
              <button
                onClick={handleCheckIn}
                disabled={pending}
                className="shrink-0 bg-accent hover:bg-accent/80 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {pending ? "Registrando..." : "✓ Registrar mi asistencia de hoy"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/5 border border-line rounded-xl p-4">
          <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">Total visitas</p>
          <p className="font-display text-2xl">{stats.total}</p>
        </div>
        <div className="bg-white/5 border border-line rounded-xl p-4">
          <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">Este mes</p>
          <p className="font-display text-2xl text-accent">{stats.thisMonth}</p>
        </div>
        <div className="bg-white/5 border border-line rounded-xl p-4">
          <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">Últimos 7 días</p>
          <p className="font-display text-2xl">{stats.last7}</p>
        </div>
      </div>

      {/* Calendario de asistencia */}
      <AttendanceCalendar attended={attended} today={today} />

      {/* Historial */}
      <div className="bg-white/5 border border-line rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="text-fg/50 text-xs uppercase tracking-widest">
            Historial reciente ({history.length} registros)
          </h2>
        </div>
        {history.length === 0 ? (
          <p className="text-fg/30 text-sm text-center py-12">Sin asistencias registradas</p>
        ) : (
          <div className="divide-y divide-line/40">
            {history.map((a) => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <span>{fmtDate(a.checked_in_date)}</span>
                <span className="text-fg/40 text-xs">{fmtTimeEC(a.checked_in_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────────
export default function PortalProgresoClient({
  heightCm,
  targetWeight,
  isPreview,
  memberName,
  progress,
  hasActiveMembership,
  checkedInToday,
  today,
  attendanceStats,
  attendedDates,
  attendanceHistory,
}: Props) {
  const [tab, setTab] = useState<"asistencia" | "medidas">("asistencia");
  const [showRegister, setShowRegister] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [deleting, startDelete] = useTransition();

  const all = progress;
  const withWeight = all.filter((p) => p.weight !== null);
  const latest = withWeight[0] ?? null; // desc → el más reciente
  const oldest = withWeight[withWeight.length - 1] ?? null;
  const lastWeight = latest?.weight ?? null;
  const totalDelta =
    oldest?.weight != null && latest?.weight != null ? latest.weight - oldest.weight : null;

  const latestEntry = all[0] ?? null;
  const imc =
    heightCm && lastWeight ? lastWeight / Math.pow(heightCm / 100, 2) : null;

  // Progreso hacia la meta
  let goalPct: number | null = null;
  if (targetWeight != null && oldest?.weight != null && lastWeight != null) {
    const totalNeeded = oldest.weight - targetWeight;
    const done = oldest.weight - lastWeight;
    goalPct =
      totalNeeded === 0 ? 100 : Math.max(0, Math.min(100, (done / totalNeeded) * 100));
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta medición?")) return;
    startDelete(async () => {
      try {
        await deleteMyProgress(id);
        toast.success("Medición eliminada");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al eliminar");
      }
    });
  }

  return (
    <div className="space-y-6">
      {isPreview && <PreviewBanner memberName={memberName} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-tight">Progreso</h1>
          <p className="text-fg/40 text-sm mt-0.5">Tu asistencia y evolución</p>
        </div>
        {tab === "medidas" && !isPreview && (
          <button
            onClick={() => setShowRegister(true)}
            className="shrink-0 bg-accent hover:bg-accent/80 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Registrar
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-line">
        {(
          [
            { key: "asistencia", label: "Asistencia" },
            { key: "medidas", label: "Medidas" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              tab === t.key
                ? "border-accent text-fg"
                : "border-transparent text-fg/40 hover:text-fg/70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "asistencia" && (
        <AttendanceTab
          stats={attendanceStats}
          attendedDates={attendedDates}
          today={today}
          history={attendanceHistory}
          checkedInToday={checkedInToday}
          hasActiveMembership={hasActiveMembership}
          isPreview={isPreview}
        />
      )}

      {tab === "medidas" && (
        <div className="space-y-6">
      {/* Resumen */}
      {latestEntry && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/5 border border-line rounded-xl p-4">
            <p className={labelMini}>Peso actual</p>
            <p className="font-display text-2xl mt-1">
              {lastWeight != null ? `${lastWeight} kg` : "—"}
            </p>
            {totalDelta != null && (
              <p
                className={`text-xs font-semibold mt-0.5 ${
                  totalDelta < 0 ? "text-emerald-400" : totalDelta > 0 ? "text-amber-400" : "text-fg/40"
                }`}
              >
                {totalDelta > 0 ? "+" : ""}
                {totalDelta.toFixed(1)} kg total
              </p>
            )}
          </div>
          <div className="bg-white/5 border border-line rounded-xl p-4">
            <p className={labelMini}>% Grasa</p>
            <p className="font-display text-2xl mt-1">
              {latestEntry.body_fat != null ? `${latestEntry.body_fat}%` : "—"}
            </p>
          </div>
          <div className="bg-white/5 border border-line rounded-xl p-4">
            <p className={labelMini}>Músculo</p>
            <p className="font-display text-2xl mt-1">
              {latestEntry.muscle_mass != null ? `${latestEntry.muscle_mass} kg` : "—"}
            </p>
          </div>
          <div className="bg-white/5 border border-line rounded-xl p-4">
            <p className={labelMini}>IMC</p>
            <p className="font-display text-2xl mt-1">{imc != null ? imc.toFixed(1) : "—"}</p>
          </div>
        </div>
      )}

      {/* Meta de peso */}
      <div className="bg-white/5 border border-line rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-fg/40 text-xs uppercase tracking-widest">Meta de peso</p>
          {!isPreview && (
            <button
              onClick={() => setShowGoal(true)}
              className="text-xs text-accent hover:text-accent/80 transition-colors"
            >
              {targetWeight != null ? "Editar" : "Fijar meta"}
            </button>
          )}
        </div>

        {targetWeight != null ? (
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-2xl">{targetWeight} kg</span>
              <span className="text-fg/40 text-sm">
                {lastWeight != null ? `Actual: ${lastWeight} kg` : "Sin peso registrado"}
              </span>
            </div>
            {goalPct != null && (
              <>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden mt-3">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${goalPct}%` }}
                  />
                </div>
                <p className="text-fg/40 text-xs mt-1.5">{Math.round(goalPct)}% del camino a tu meta</p>
              </>
            )}
          </div>
        ) : (
          <p className="text-fg/30 text-sm mt-2">
            Aún no fijas una meta de peso.{" "}
            {!isPreview && "Pulsa “Fijar meta” para empezar a medir tu avance."}
          </p>
        )}
      </div>

      {/* Evolución de peso */}
      {withWeight.length >= 2 && (
        <div className="bg-white/5 border border-line rounded-2xl p-5">
          <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">Evolución de peso</p>
          <WeightChart data={all} />
        </div>
      )}

      {/* Historial */}
      {all.length === 0 ? (
        <div className="bg-white/5 border border-line rounded-2xl px-5 py-14 text-center">
          <div className="text-4xl mb-3">📏</div>
          <p className="text-fg/60 text-sm font-medium">Aún no hay mediciones</p>
          <p className="text-fg/30 text-xs mt-1 mb-5">
            Registra tu primera medición para empezar a ver tu evolución.
          </p>
          {!isPreview && (
            <button
              onClick={() => setShowRegister(true)}
              className="bg-accent hover:bg-accent/80 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              + Registrar primera medición
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-fg/40 text-xs uppercase tracking-widest">
            {all.length} medición{all.length !== 1 ? "es" : ""}
          </h2>
          {all.map((p, i) => {
            const prev = all[i + 1] ?? null; // medición anterior (más antigua)
            return (
              <div key={p.id} className="bg-white/5 border border-line rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-sm">{fmtDate(p.measured_at)}</p>
                  <div className="flex items-center gap-2">
                    {p.is_own ? (
                      <span className="text-xs text-fg/30">Tú</span>
                    ) : (
                      <span className="text-xs text-emerald-400/60">Gym</span>
                    )}
                    {p.is_own && !isPreview && (
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting}
                        title="Eliminar"
                        className="text-fg/25 hover:text-red-400 transition-colors disabled:opacity-40"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {METRICS.map((m) => {
                    const value = p[m.key];
                    if (value == null) return null;
                    const prevVal = prev?.[m.key] ?? null;
                    const diff = prevVal != null ? value - prevVal : null;
                    return (
                      <div key={m.key}>
                        <p className="text-fg/40 text-xs uppercase tracking-wider mb-0.5">{m.label}</p>
                        <p className="font-semibold text-sm flex items-baseline gap-1.5">
                          {value} {m.unit}
                          {diff != null && <Delta value={diff} goodDir={m.goodDir} />}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {p.notes && (
                  <p className="text-fg/50 text-sm mt-3 italic border-t border-line/40 pt-3">{p.notes}</p>
                )}

                {p.photo_url && (
                  <div className="mt-3">
                    <Image
                      src={p.photo_url}
                      alt={`Foto ${p.measured_at}`}
                      width={300}
                      height={300}
                      unoptimized
                      className="rounded-lg object-cover max-h-72 w-auto"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

        </div>
      )}

      {/* Modales */}
      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} />}
      {showGoal && <GoalModal current={targetWeight} onClose={() => setShowGoal(false)} />}
    </div>
  );
}
