"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createProgramType,
  setActiveProgramType,
  deleteProgramType,
  createWeeklyProgram,
  deleteWeeklyProgram,
  saveDayWorkout,
  clearDayWorkout,
} from "./actions";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type ProgramType = { id: string; name: string; is_active: boolean };
type Week = { id: string; week_start: string; notes: string | null };
type DailyWorkout = {
  id: string;
  day_of_week: number;
  warmup: string;
  strength: string;
  wod: string;
  accessories: string;
};

type Props = {
  types: ProgramType[];
  weeks: Week[];
  workouts: DailyWorkout[];
  selectedTypeId: string | null;
  selectedProgramId: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_NAMES_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

type Section = "warmup" | "strength" | "wod" | "accessories";

const SECTIONS: {
  key: Section;
  label: string;
  emoji: string;
  color: string;
  bg: string;
  border: string;
  headerBg: string;
  textareaFocus: string;
  placeholder: string;
}[] = [
  {
    key: "warmup",
    label: "Calentamiento",
    emoji: "🔥",
    color: "text-blue-300",
    bg: "bg-blue-500/15",
    border: "border-blue-500/30",
    headerBg: "bg-blue-500/10 border-blue-500/20",
    textareaFocus: "focus:border-blue-400/50",
    placeholder: "Ej: 10 min trote suave, movilidad articular, activación...",
  },
  {
    key: "strength",
    label: "Fuerza",
    emoji: "💪",
    color: "text-red-300",
    bg: "bg-red-500/15",
    border: "border-red-500/30",
    headerBg: "bg-red-500/10 border-red-500/20",
    textareaFocus: "focus:border-red-400/50",
    placeholder: "Ej: Back squat 5x5 @ 75%, Press banca 3x8...",
  },
  {
    key: "wod",
    label: "WOD",
    emoji: "⚡",
    color: "text-amber-300",
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    headerBg: "bg-amber-500/10 border-amber-500/20",
    textareaFocus: "focus:border-amber-400/50",
    placeholder: "Ej: AMRAP 20 min — 5 pull-ups, 10 push-ups, 15 air squats...",
  },
  {
    key: "accessories",
    label: "Accesorios",
    emoji: "🏋️",
    color: "text-emerald-300",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
    headerBg: "bg-emerald-500/10 border-emerald-500/20",
    textareaFocus: "focus:border-emerald-400/50",
    placeholder: "Ej: Core work 3x15, estiramiento 10 min...",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function formatWeekLabel(weekStart: string): string {
  const mon = new Date(weekStart + "T00:00:00");
  const sun = new Date(weekStart + "T00:00:00");
  sun.setDate(sun.getDate() + 6);
  return `${mon.getDate()} ${MONTH_SHORT[mon.getMonth()]} – ${sun.getDate()} ${MONTH_SHORT[sun.getMonth()]} ${sun.getFullYear()}`;
}

function toMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay();
  const back = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - back);
  return d.toISOString().split("T")[0];
}

function currentMonday(): string {
  return toMonday(new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" }));
}

function getDayDate(weekStart: string, dow: number): string {
  // dow: 0=Dom,1=Lun,...,6=Sáb; weekStart is Monday (dow=1)
  const mon = new Date(weekStart + "T00:00:00");
  const offset = dow === 0 ? 6 : dow - 1; // Mon=0, Tue=1, ... Sun=6
  const d = new Date(mon);
  d.setDate(d.getDate() + offset);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DayCard
// ─────────────────────────────────────────────────────────────────────────────
function DayCard({
  workout,
  dow,
  weekStart,
}: {
  workout: DailyWorkout | null;
  dow: number;
  weekStart: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [warmup, setWarmup] = useState(workout?.warmup ?? "");
  const [strength, setStrength] = useState(workout?.strength ?? "");
  const [wod, setWod] = useState(workout?.wod ?? "");
  const [accessories, setAccessories] = useState(workout?.accessories ?? "");
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [clearPending, startClear] = useTransition();

  const refs = {
    warmup: useRef<HTMLTextAreaElement>(null),
    strength: useRef<HTMLTextAreaElement>(null),
    wod: useRef<HTMLTextAreaElement>(null),
    accessories: useRef<HTMLTextAreaElement>(null),
  };

  const values: Record<Section, string> = { warmup, strength, wod, accessories };
  const setters: Record<Section, (v: string) => void> = {
    warmup: setWarmup,
    strength: setStrength,
    wod: setWod,
    accessories: setAccessories,
  };

  const filledSections = SECTIONS.filter((s) => !!values[s.key]?.trim());
  const hasContent = filledSections.length > 0;
  const hasWOD = !!(values.wod?.trim());
  const wodPreview = hasWOD ? (values.wod.slice(0, 90) + (values.wod.length > 90 ? "…" : "")) : null;

  function handleChange(key: Section, val: string) {
    setters[key](val);
    setIsDirty(true);
    setSaveState("idle");
  }

  function focusSection(key: Section) {
    setExpanded(true);
    setTimeout(() => refs[key].current?.focus(), 60);
  }

  async function handleSave() {
    if (!workout) return;
    setSaveState("saving");
    try {
      await saveDayWorkout(workout.id, { warmup, strength, wod, accessories });
      setSaveState("saved");
      setIsDirty(false);
      toast.success(`${DAY_NAMES_FULL[dow]} guardado ✓`);
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err) {
      setSaveState("idle");
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  function handleClear() {
    if (!workout) return;
    if (!confirm(`¿Limpiar toda la programación de ${DAY_NAMES_FULL[dow]}?`)) return;
    startClear(async () => {
      try {
        await clearDayWorkout(workout.id);
        setWarmup(""); setStrength(""); setWod(""); setAccessories("");
        setIsDirty(false);
        setSaveState("idle");
        toast.success(`${DAY_NAMES_FULL[dow]} limpiado`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al limpiar");
      }
    });
  }

  const isDisabled = !workout;

  // Left border color based on content completeness
  const borderAccent = !workout
    ? "border-line/20"
    : filledSections.length === 4
      ? "border-emerald-500/60"
      : filledSections.length >= 2
        ? "border-amber-500/60"
        : filledSections.length >= 1
          ? "border-accent/60"
          : expanded
            ? "border-accent/40"
            : "border-line/40";

  return (
    <div
      className={`relative bg-bg-2 border rounded-2xl overflow-hidden transition-all duration-200
        ${isDisabled ? "opacity-35" : ""}
        ${expanded ? "border-accent/40 shadow-lg shadow-accent/5" : borderAccent}
      `}
    >
      {/* ── Colored top stripe ── */}
      <div
        className={`h-1 w-full transition-colors ${
          !workout
            ? "bg-line/20"
            : filledSections.length === 4
              ? "bg-gradient-to-r from-emerald-500 to-blue-500"
              : filledSections.length >= 1
                ? "bg-gradient-to-r from-accent/80 to-amber-500/60"
                : "bg-line/30"
        }`}
      />

      {/* ── Card Header ── */}
      <div
        className={`flex items-center justify-between px-4 py-3 select-none ${
          !isDisabled ? "cursor-pointer" : ""
        }`}
        onClick={() => !isDisabled && setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="font-display text-base font-semibold text-fg leading-none">
              {DAY_NAMES_FULL[dow]}
            </span>
            {weekStart && (
              <span className="text-xs text-fg/35 mt-0.5 font-mono">
                {getDayDate(weekStart, dow)}
              </span>
            )}
          </div>
          {hasContent && !expanded && (
            <span className="text-xs text-fg/40 bg-white/5 rounded-full px-2 py-0.5 border border-line/30">
              {filledSections.length}/{SECTIONS.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isDisabled && !expanded && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
              className="text-xs font-semibold text-accent border border-accent/30 hover:bg-accent/10 px-2.5 py-1 rounded-full transition-colors"
            >
              + Agregar
            </button>
          )}
          {!isDisabled && (
            <svg
              viewBox="0 0 12 12"
              className={`w-3.5 h-3.5 text-fg/30 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          )}
        </div>
      </div>

      {/* ── Section pill badges (always visible when collapsed) ── */}
      {!expanded && (
        <div className="px-4 pb-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {SECTIONS.map((s) => {
              const filled = !!values[s.key]?.trim();
              return (
                <button
                  key={s.key}
                  disabled={isDisabled}
                  onClick={() => focusSection(s.key)}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors disabled:pointer-events-none ${
                    filled
                      ? `${s.bg} ${s.border} ${s.color} font-semibold`
                      : "bg-white/3 border-line/20 text-fg/25 hover:text-fg/50 hover:border-line/40"
                  }`}
                >
                  <span>{s.emoji}</span>
                  <span>{s.label}</span>
                  {filled && <span className="ml-0.5 opacity-70">✓</span>}
                </button>
              );
            })}
          </div>

          {/* WOD preview or empty message */}
          <div
            className="cursor-pointer"
            onClick={() => !isDisabled && setExpanded(true)}
          >
            {wodPreview ? (
              <p className="text-xs text-fg/45 leading-relaxed line-clamp-2 italic">
                ⚡ {wodPreview}
              </p>
            ) : (
              <p className="text-xs text-fg/20">
                {isDisabled ? "Día no disponible" : "No hay WOD programado"}
              </p>
            )}
          </div>

          {/* Limpiar button — only if has content */}
          {hasContent && !isDisabled && (
            <div className="flex justify-end">
              <button
                onClick={(e) => { e.stopPropagation(); handleClear(); }}
                disabled={clearPending}
                className="text-xs text-fg/20 hover:text-red-400 transition-colors disabled:opacity-30"
              >
                {clearPending ? "Limpiando..." : "🗑 Limpiar día"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Expanded editing form ── */}
      {expanded && workout && (
        <div className="border-t border-line/30">
          <div className="px-4 py-4 space-y-3">
            {SECTIONS.map((s) => (
              <div key={s.key} className="rounded-xl overflow-hidden border border-line/20">
                {/* Section header */}
                <div className={`flex items-center gap-2 px-3 py-2 border-b ${s.headerBg}`}>
                  <span>{s.emoji}</span>
                  <span className={`text-xs font-bold uppercase tracking-wider ${s.color}`}>
                    {s.label}
                  </span>
                  {values[s.key]?.trim() && (
                    <span className={`ml-auto text-xs ${s.color} opacity-60`}>✓</span>
                  )}
                </div>
                <textarea
                  ref={refs[s.key]}
                  value={values[s.key]}
                  onChange={(e) => handleChange(s.key, e.target.value)}
                  rows={3}
                  placeholder={s.placeholder}
                  className={`w-full bg-bg-2 text-fg text-sm px-3 py-2.5 outline-none resize-none placeholder:text-fg/20 border-0 transition-all ${s.textareaFocus} focus:bg-white/3`}
                />
              </div>
            ))}
          </div>

          {/* Bottom actions bar */}
          <div className="px-4 pb-4 flex items-center justify-between gap-3 border-t border-line/20 pt-3">
            <div className="flex items-center gap-3">
              {isDirty && (
                <span className="text-xs text-amber-400/80 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Sin guardar
                </span>
              )}
              {saveState === "saved" && !isDirty && (
                <span className="text-xs text-emerald-400/80 flex items-center gap-1">
                  <span>✓</span> Guardado
                </span>
              )}
              <button
                onClick={handleClear}
                disabled={clearPending || !hasContent}
                className="text-xs text-fg/25 hover:text-red-400 transition-colors disabled:opacity-20"
              >
                {clearPending ? "..." : "🗑 Limpiar"}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setExpanded(false)}
                className="px-3 py-1.5 text-xs text-fg/40 hover:text-fg border border-line/30 hover:border-line rounded-lg transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={handleSave}
                disabled={saveState === "saving" || !isDirty}
                className="px-4 py-1.5 text-xs font-semibold bg-accent hover:bg-accent/85 text-white rounded-lg transition-colors disabled:opacity-35 flex items-center gap-1.5"
              >
                {saveState === "saving" ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando
                  </>
                ) : (
                  "Guardar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// New week modal
// ─────────────────────────────────────────────────────────────────────────────
function NewWeekModal({
  typeId,
  onClose,
  onCreated,
}: {
  typeId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [date, setDate] = useState(currentMonday());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const previewMonday = toMonday(date);
  const mon = new Date(previewMonday + "T00:00:00");
  const sun = new Date(previewMonday + "T00:00:00");
  sun.setDate(sun.getDate() + 6);
  const weekLabel = `${mon.getDate()} ${MONTH_SHORT[mon.getMonth()]} – ${sun.getDate()} ${MONTH_SHORT[sun.getMonth()]} ${sun.getFullYear()}`;

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      try {
        const newId = await createWeeklyProgram(typeId, date);
        toast.success("Semana creada");
        onCreated(newId);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al crear semana");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-bg-2 border border-line rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display text-lg uppercase tracking-tight">Nueva semana</h2>
            <p className="text-xs text-fg/40 mt-0.5">Selecciona cualquier día de la semana</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-fg/40 hover:text-fg transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-white/5 border border-white/15 text-fg rounded-xl px-3 py-2.5 text-sm outline-none focus:border-accent/60 transition-colors"
          />

          <div className="bg-accent/8 border border-accent/20 rounded-xl px-4 py-3">
            <p className="text-xs text-fg/40 mb-0.5">Semana a crear</p>
            <p className="text-sm font-bold text-accent">📅 {weekLabel}</p>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-fg/50 hover:text-fg border border-line rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={pending}
            className="px-6 py-2.5 text-sm font-bold bg-accent hover:bg-accent/85 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {pending ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creando...
              </>
            ) : (
              "Crear semana"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// New type inline form
// ─────────────────────────────────────────────────────────────────────────────
function NewTypeInline({
  onCreated,
  onCancel,
}: {
  onCreated: (id: string, name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function handle() {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const id = await createProgramType(name.trim());
        toast.success(`Tipo "${name}" creado`);
        onCreated(id, name.trim());
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al crear tipo");
      }
    });
  }

  return (
    <div className="flex gap-2 items-center mt-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre del tipo de programación..."
        onKeyDown={(e) => { if (e.key === "Enter") handle(); if (e.key === "Escape") onCancel(); }}
        className="flex-1 bg-white/5 border border-accent/40 text-fg rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-fg/20"
      />
      <button
        onClick={handle}
        disabled={pending || !name.trim()}
        className="px-3 py-2 text-sm font-semibold bg-accent hover:bg-accent/85 text-white rounded-xl transition-colors disabled:opacity-40 whitespace-nowrap"
      >
        {pending ? "..." : "Crear"}
      </button>
      <button
        onClick={onCancel}
        className="w-8 h-8 flex items-center justify-center text-fg/30 hover:text-fg rounded-lg transition-colors text-lg"
      >
        ✕
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Week legend / stats bar
// ─────────────────────────────────────────────────────────────────────────────
function WeekStatsBar({ workouts }: { workouts: DailyWorkout[] }) {
  const total = workouts.length;
  const withWOD = workouts.filter((w) => w.wod?.trim()).length;
  const fullyLoaded = workouts.filter(
    (w) => w.warmup?.trim() && w.strength?.trim() && w.wod?.trim() && w.accessories?.trim()
  ).length;

  if (total === 0) return null;

  return (
    <div className="flex items-center gap-4 text-xs text-fg/40">
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        {withWOD}/7 con WOD
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        {fullyLoaded}/7 completos
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function PlanificacionesClient({
  types,
  weeks,
  workouts,
  selectedTypeId,
  selectedProgramId,
}: Props) {
  const router = useRouter();
  const [showNewWeek, setShowNewWeek] = useState(false);
  const [showNewType, setShowNewType] = useState(false);
  const [setActivePending, startSetActive] = useTransition();
  const [deleteWeekPending, startDeleteWeek] = useTransition();

  const selectedType = types.find((t) => t.id === selectedTypeId) ?? null;
  const activeType = types.find((t) => t.is_active) ?? null;
  const selectedWeek = weeks.find((w) => w.id === selectedProgramId) ?? null;

  const workoutByDow: Record<number, DailyWorkout> = {};
  for (const w of workouts) workoutByDow[w.day_of_week] = w;

  function navigateTo(typeId: string | null, programId: string | null) {
    const params = new URLSearchParams();
    if (typeId) params.set("typeId", typeId);
    if (programId) params.set("programId", programId);
    router.push(`/admin/clases?${params.toString()}`);
  }

  function handleTypeChange(typeId: string) { navigateTo(typeId, null); }
  function handleWeekChange(programId: string) { navigateTo(selectedTypeId, programId); }
  function handleWeekCreated(newId: string) { navigateTo(selectedTypeId, newId); }

  function handleSetActive() {
    if (!selectedTypeId) return;
    startSetActive(async () => {
      try {
        await setActiveProgramType(selectedTypeId);
        toast.success(`Tipo activo: ${selectedType?.name}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  function handleDeleteWeek() {
    if (!selectedProgramId) return;
    const label = selectedWeek ? formatWeekLabel(selectedWeek.week_start) : "";
    if (!confirm(`¿Eliminar la semana del ${label}? Esta acción no se puede deshacer.`)) return;
    startDeleteWeek(async () => {
      try {
        await deleteWeeklyProgram(selectedProgramId);
        toast.success("Semana eliminada");
        navigateTo(selectedTypeId, null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al eliminar");
      }
    });
  }

  return (
    <>
      {/* ── Controls panel ── */}
      <div className="bg-bg-2 border border-line rounded-2xl overflow-hidden">
        {/* Top row: selectors + CTA */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          {/* Tipo selector */}
          <div className="space-y-1.5">
            <label className="text-fg/40 text-xs uppercase tracking-widest font-semibold">
              Tipo de Programación
            </label>
            <div className="flex gap-2">
              <select
                value={selectedTypeId ?? ""}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="flex-1 bg-white/5 border border-white/12 text-fg rounded-xl px-3 py-2.5 text-sm outline-none focus:border-accent/50 transition-colors appearance-none cursor-pointer"
              >
                {types.length === 0 && <option value="">Sin tipos — crea uno</option>}
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.is_active ? "  ★ Activo" : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowNewType((v) => !v)}
                title="Nuevo tipo de programación"
                className="px-3 py-2.5 border border-line text-fg/40 hover:text-fg hover:border-accent/40 rounded-xl text-sm transition-colors font-bold"
              >
                +
              </button>
            </div>
            {showNewType && (
              <NewTypeInline
                onCreated={(id) => { setShowNewType(false); navigateTo(id, null); }}
                onCancel={() => setShowNewType(false)}
              />
            )}
          </div>

          {/* Semana selector */}
          <div className="space-y-1.5">
            <label className="text-fg/40 text-xs uppercase tracking-widest font-semibold">
              Semana
            </label>
            <select
              value={selectedProgramId ?? ""}
              onChange={(e) => handleWeekChange(e.target.value)}
              disabled={!selectedTypeId || weeks.length === 0}
              className="w-full bg-white/5 border border-white/12 text-fg rounded-xl px-3 py-2.5 text-sm outline-none focus:border-accent/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed appearance-none"
            >
              {weeks.length === 0
                ? <option value="">— Sin semanas —</option>
                : weeks.map((w) => (
                    <option key={w.id} value={w.id}>
                      {formatWeekLabel(w.week_start)}
                    </option>
                  ))
              }
            </select>
          </div>

          {/* CREAR NUEVA SEMANA */}
          <button
            onClick={() => setShowNewWeek(true)}
            disabled={!selectedTypeId}
            className="flex items-center justify-center gap-2 bg-accent hover:bg-accent/85 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-35 whitespace-nowrap shadow-lg shadow-accent/20"
          >
            <span className="text-base">+</span>
            CREAR NUEVA SEMANA
          </button>
        </div>

        {/* Status bar */}
        <div className="px-4 py-2.5 bg-white/2 border-t border-line/40 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${activeType ? "bg-emerald-400 shadow-[0_0_6px_theme(colors.emerald.400)]" : "bg-fg/20"}`} />
              <span className="text-xs text-fg/50">
                Programación activa:
                <span className={`ml-1 font-semibold ${activeType ? "text-emerald-400" : "text-fg/30"}`}>
                  {activeType?.name ?? "Ninguna"}
                </span>
              </span>
            </div>
            {selectedType && !selectedType.is_active && (
              <button
                onClick={handleSetActive}
                disabled={setActivePending}
                className="text-xs text-accent hover:underline disabled:opacity-40 transition-colors"
              >
                {setActivePending ? "Activando..." : "→ Usar este tipo"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <WeekStatsBar workouts={workouts} />
            {selectedProgramId && (
              <button
                onClick={handleDeleteWeek}
                disabled={deleteWeekPending}
                className="text-xs text-fg/25 hover:text-red-400 transition-colors disabled:opacity-30"
              >
                {deleteWeekPending ? "Eliminando..." : "🗑 Eliminar semana"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Day grid or empty state ── */}
      {!selectedProgramId ? (
        <div className="bg-bg-2 border border-line rounded-2xl px-6 py-20 text-center">
          <div className="text-4xl mb-3">
            {types.length === 0 ? "📋" : weeks.length === 0 ? "📅" : "👆"}
          </div>
          <p className="text-fg/40 text-sm font-medium">
            {types.length === 0
              ? "Crea un tipo de programación para comenzar"
              : weeks.length === 0
                ? "No hay semanas creadas para este tipo"
                : "Selecciona una semana para ver la programación"}
          </p>
          {types.length > 0 && weeks.length === 0 && (
            <button
              onClick={() => setShowNewWeek(true)}
              disabled={!selectedTypeId}
              className="mt-4 inline-flex items-center gap-2 bg-accent hover:bg-accent/85 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-accent/20 disabled:opacity-35"
            >
              + CREAR PRIMERA SEMANA
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Week label */}
          {selectedWeek && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-fg/35 uppercase tracking-wider font-semibold">Semana</span>
              <span className="text-xs font-bold text-fg/60 bg-white/5 border border-line/30 px-3 py-1 rounded-full">
                📅 {formatWeekLabel(selectedWeek.week_start)}
              </span>
            </div>
          )}

          {/* Day cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {DAY_ORDER.map((dow) => (
              <DayCard
                key={dow}
                dow={dow}
                workout={workoutByDow[dow] ?? null}
                weekStart={selectedWeek?.week_start ?? null}
              />
            ))}
          </div>

          {/* Section legend */}
          <div className="flex flex-wrap gap-3 pt-1">
            {SECTIONS.map((s) => (
              <span key={s.key} className={`flex items-center gap-1.5 text-xs ${s.color} opacity-60`}>
                {s.emoji} {s.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-xs text-fg/25">
              <span className="w-2 h-2 rounded-full bg-emerald-400/60" /> Completo
            </span>
          </div>
        </div>
      )}

      {/* ── New week modal ── */}
      {showNewWeek && selectedTypeId && (
        <NewWeekModal
          typeId={selectedTypeId}
          onClose={() => setShowNewWeek(false)}
          onCreated={handleWeekCreated}
        />
      )}
    </>
  );
}
