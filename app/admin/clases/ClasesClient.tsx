"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import {
  createSchedule,
  updateSchedule,
  toggleScheduleActive,
  updateCoachOnSchedule,
  deleteSchedule,
  createCoach,
} from "./actions";

type Schedule = {
  id: string;
  name: string;
  description: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  period: string;
  max_capacity: number;
  coach_id: string | null;
  coach_name: string | null;
  active: boolean;
};

type Coach = { id: string; full_name: string; specialty: string | null };
type Props = { schedules: Schedule[]; coaches: Coach[] };

const DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const inputCls =
  "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-fg/20";
const labelCls = "text-fg/50 text-xs uppercase tracking-wider";

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${m} ${ampm}`;
}

// ─── Calendario mensual ───────────────────────────────────────────────────────
function MonthCalendar({
  scheduledWeekdays,
  selected,
  onSelect,
}: {
  scheduledWeekdays: Set<number>;
  selected: Date;
  onSelect: (d: Date) => void;
}) {
  const [viewMonth, setViewMonth] = useState(
    new Date(selected.getFullYear(), selected.getMonth(), 1)
  );

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  // First weekday of month (Mon=0 … Sun=6)
  const firstWd = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells: { day: number; date: Date; curr: boolean }[] = [];
  for (let i = firstWd - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    cells.push({ day: d, date: new Date(year, month - 1, d), curr: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, date: new Date(year, month, d), curr: true });
  }
  while (cells.length % 7 !== 0) {
    const d = cells.length - firstWd - daysInMonth + 1;
    cells.push({ day: d, date: new Date(year, month + 1, d), curr: false });
  }

  const selStr = selected.toDateString();
  const todayStr = today.toDateString();

  return (
    <div className="bg-white/5 border border-line rounded-xl p-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setViewMonth(new Date(year, month - 1, 1))}
          className="w-8 h-8 flex items-center justify-center text-fg/40 hover:text-fg rounded-lg hover:bg-white/5 transition-colors text-lg"
        >
          ‹
        </button>
        <span className="text-xs font-bold uppercase tracking-widest text-fg/70">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          onClick={() => setViewMonth(new Date(year, month + 1, 1))}
          className="w-8 h-8 flex items-center justify-center text-fg/40 hover:text-fg rounded-lg hover:bg-white/5 transition-colors text-lg"
        >
          ›
        </button>
      </div>

      {/* Weekday labels — Mon first */}
      <div className="grid grid-cols-7 mb-1">
        {["L","M","M","J","V","S","D"].map((d, i) => (
          <div key={i} className="text-center text-xs text-fg/25 py-1 font-medium">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, i) => {
          const dow = cell.date.getDay();
          const hasClass = scheduledWeekdays.has(dow);
          const isSelected = cell.date.toDateString() === selStr;
          const isToday = cell.date.toDateString() === todayStr;

          return (
            <button
              key={i}
              onClick={() => onSelect(cell.date)}
              className={[
                "w-8 h-8 mx-auto flex items-center justify-center text-xs rounded-full transition-all",
                !cell.curr ? "opacity-25 pointer-events-none" : "",
                isSelected
                  ? "bg-accent text-white font-bold"
                  : hasClass && cell.curr
                    ? "bg-accent/20 text-accent font-semibold hover:bg-accent/35"
                    : cell.curr
                      ? "text-fg/40 hover:bg-white/8 hover:text-fg"
                      : "",
                isToday && !isSelected ? "ring-1 ring-accent/50" : "",
              ].join(" ")}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-line/50 flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs text-fg/30">
          <span className="w-3 h-3 rounded-full bg-accent/20 inline-block" />
          Con clases
        </span>
        <span className="flex items-center gap-1.5 text-xs text-fg/30">
          <span className="w-3 h-3 rounded-full bg-accent inline-block" />
          Seleccionado
        </span>
      </div>
    </div>
  );
}

// ─── Tarjeta de clase ─────────────────────────────────────────────────────────
function ClassCard({
  schedule,
  coaches,
  onEdit,
}: {
  schedule: Schedule;
  coaches: Coach[];
  onEdit: () => void;
}) {
  const [coachPending, startCoachTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();

  function handleCoachChange(coachId: string) {
    startCoachTransition(async () => {
      try {
        await updateCoachOnSchedule(schedule.id, coachId || null);
        toast.success("Coach actualizado");
      } catch {
        toast.error("Error al actualizar coach");
      }
    });
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      try {
        await deleteSchedule(schedule.id);
        toast.success("Clase eliminada");
      } catch {
        toast.error("Error al eliminar");
      }
    });
  }

  return (
    <div
      className={`bg-white/5 border rounded-xl p-4 flex flex-col gap-3 transition-colors ${
        schedule.active ? "border-line hover:border-accent/30" : "border-line/30 opacity-50"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{schedule.name}</p>
          <p className="text-fg/40 text-xs mt-0.5">
            {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-fg/35 tabular-nums bg-white/5 px-2 py-0.5 rounded-full border border-line/50">
            0/{schedule.max_capacity}
          </span>
        </div>
      </div>

      {/* Coach inline */}
      <select
        defaultValue={schedule.coach_id ?? ""}
        onChange={(e) => handleCoachChange(e.target.value)}
        disabled={coachPending}
        className="w-full bg-white/5 border border-white/10 text-fg/70 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent transition-colors disabled:opacity-50"
      >
        <option value="">Sin coach asignado</option>
        {coaches.map((c) => (
          <option key={c.id} value={c.id}>
            {c.full_name}
          </option>
        ))}
      </select>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-line/40">
        <button
          onClick={onEdit}
          className="flex-1 text-xs text-fg/40 hover:text-fg border border-line/50 hover:border-accent/40 py-1.5 rounded-lg transition-colors"
        >
          Editar
        </button>
        <ToggleBtn scheduleId={schedule.id} active={schedule.active} />
        <button
          onClick={handleDelete}
          disabled={deletePending}
          className="text-xs text-red-400/50 hover:text-red-400 border border-line/50 hover:border-red-500/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30"
        >
          {deletePending ? "..." : "✕"}
        </button>
      </div>
    </div>
  );
}

function ToggleBtn({ scheduleId, active }: { scheduleId: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await toggleScheduleActive(scheduleId, active);
            toast.success(active ? "Clase pausada" : "Clase activada");
          } catch {
            toast.error("Error");
          }
        })
      }
      className={`text-xs border px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30 ${
        active
          ? "border-line/50 text-fg/40 hover:text-amber-400 hover:border-amber-500/30"
          : "border-emerald-500/30 text-emerald-400/60 hover:text-emerald-400"
      }`}
    >
      {pending ? "..." : active ? "Pausar" : "Activar"}
    </button>
  );
}

// ─── Vista del día ────────────────────────────────────────────────────────────
function DayView({
  date,
  schedules,
  coaches,
  onEdit,
  onNew,
}: {
  date: Date;
  schedules: Schedule[];
  coaches: Coach[];
  onEdit: (s: Schedule) => void;
  onNew: () => void;
}) {
  const morning = schedules.filter((s) => s.start_time < "12:00:00");
  const afternoon = schedules.filter((s) => s.start_time >= "12:00:00" && s.start_time < "17:00:00");
  const evening = schedules.filter((s) => s.start_time >= "17:00:00");

  const dayName = DAYS_FULL[date.getDay()];
  const dateLabel = `${dayName}, ${date.getDate()} de ${MONTH_NAMES[date.getMonth()].toLowerCase()}`;

  function Group({ title, items }: { title: string; items: Schedule[] }) {
    if (items.length === 0) return null;
    return (
      <div>
        <p className="text-fg/35 text-xs uppercase tracking-widest mb-3">{title}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((s) => (
            <ClassCard key={s.id} schedule={s} coaches={coaches} onEdit={() => onEdit(s)} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-line rounded-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <p className="font-semibold capitalize">{dateLabel}</p>
          <p className="text-fg/35 text-xs mt-0.5">
            {schedules.length === 0
              ? "Sin clases para este día"
              : `${schedules.length} clase${schedules.length !== 1 ? "s" : ""} programada${schedules.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-2 bg-accent hover:bg-accent/80 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          + Crear clase
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 p-5 space-y-6 min-h-64">
        {schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <p className="text-fg/30 text-sm">Sin clases para este día</p>
            <button
              onClick={onNew}
              className="text-accent text-sm hover:underline"
            >
              Agregar primera clase →
            </button>
          </div>
        ) : (
          <>
            <Group title="Mañana" items={morning} />
            <Group title="Tarde" items={afternoon} />
            <Group title="Noche" items={evening} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Formulario de clase ──────────────────────────────────────────────────────
function ScheduleForm({
  schedule,
  coaches,
  defaultDow,
  onClose,
}: {
  schedule?: Schedule;
  coaches: Coach[];
  defaultDow?: number;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        if (schedule) await updateSchedule(schedule.id, fd);
        else await createSchedule(fd);
        toast.success(schedule ? "Clase actualizada" : "Clase creada");
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Nombre *</label>
          <input
            name="name"
            required
            defaultValue={schedule?.name}
            className={inputCls}
            placeholder="Ej. Funcional, CrossFit, Spinning..."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Día de la semana *</label>
          <select
            name="day_of_week"
            required
            defaultValue={schedule?.day_of_week ?? defaultDow ?? 1}
            className={inputCls}
          >
            {[1, 2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>{DAYS_FULL[d]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Coach</label>
          <select name="coach_id" defaultValue={schedule?.coach_id ?? ""} className={inputCls}>
            <option value="">Sin asignar</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}{c.specialty ? ` — ${c.specialty}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Hora inicio *</label>
          <input
            name="start_time"
            type="time"
            required
            defaultValue={schedule?.start_time?.slice(0, 5)}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Hora fin *</label>
          <input
            name="end_time"
            type="time"
            required
            defaultValue={schedule?.end_time?.slice(0, 5)}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Capacidad máx. *</label>
          <input
            name="max_capacity"
            type="number"
            required
            min="1"
            defaultValue={schedule?.max_capacity ?? 22}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Descripción</label>
          <input
            name="description"
            defaultValue={schedule?.description ?? ""}
            className={inputCls}
            placeholder="Opcional"
          />
        </div>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={pending} className="px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50">
          {pending ? "Guardando..." : schedule ? "Actualizar" : "Crear clase"}
        </button>
      </div>
    </form>
  );
}

// ─── Formulario de coach ──────────────────────────────────────────────────────
function CoachForm({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await createCoach(fd);
        toast.success("Coach agregado");
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Nombre completo *</label>
        <input name="full_name" required className={inputCls} placeholder="Ej. Marco Torres" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Teléfono</label>
        <input name="phone" className={inputCls} placeholder="0999 000 000" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Especialidad</label>
        <input name="specialty" className={inputCls} placeholder="CrossFit, Funcional..." />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={pending} className="px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50">
          {pending ? "Guardando..." : "Agregar coach"}
        </button>
      </div>
    </form>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
type Modal =
  | { type: "class"; schedule?: Schedule; defaultDow?: number }
  | { type: "coach" }
  | null;

export default function ClasesClient({ schedules, coaches }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [modal, setModal] = useState<Modal>(null);

  // Weekdays that have at least one active schedule
  const scheduledWeekdays = useMemo(
    () => new Set(schedules.filter((s) => s.active).map((s) => s.day_of_week)),
    [schedules]
  );

  // Schedules for the selected day_of_week (show active and inactive)
  const selectedDow = selectedDate.getDay();
  const daySchedules = useMemo(
    () =>
      schedules
        .filter((s) => s.day_of_week === selectedDow)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [schedules, selectedDow]
  );

  return (
    <>
      {/* Action bar */}
      <div className="flex gap-2 justify-end mb-1">
        <button
          onClick={() => setModal({ type: "coach" })}
          className="px-3 py-2 border border-line text-fg/50 hover:text-fg text-sm rounded-lg transition-colors"
        >
          + Coach
        </button>
        <button
          onClick={() => setModal({ type: "class", defaultDow: selectedDow })}
          className="px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Clase
        </button>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[288px_1fr] gap-4 items-start">
        <MonthCalendar
          scheduledWeekdays={scheduledWeekdays}
          selected={selectedDate}
          onSelect={setSelectedDate}
        />
        <DayView
          date={selectedDate}
          schedules={daySchedules}
          coaches={coaches}
          onEdit={(s) => setModal({ type: "class", schedule: s })}
          onNew={() => setModal({ type: "class", defaultDow: selectedDow })}
        />
      </div>

      {/* Coaches strip */}
      {coaches.length > 0 && (
        <div className="mt-2">
          <p className="text-fg/35 text-xs uppercase tracking-widest mb-3">Coaches</p>
          <div className="flex flex-wrap gap-2">
            {coaches.map((c) => (
              <div key={c.id} className="bg-white/5 border border-line rounded-lg px-3 py-2 text-sm">
                <span className="font-medium">{c.full_name}</span>
                {c.specialty && (
                  <span className="text-fg/35 ml-2 text-xs">{c.specialty}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: clase */}
      {modal?.type === "class" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-line rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg uppercase tracking-tight">
                {modal.schedule ? "Editar clase" : "Nueva clase"}
              </h2>
              <button onClick={() => setModal(null)} className="text-fg/40 hover:text-fg text-xl leading-none">✕</button>
            </div>
            <ScheduleForm
              schedule={modal.schedule}
              coaches={coaches}
              defaultDow={modal.defaultDow}
              onClose={() => setModal(null)}
            />
          </div>
        </div>
      )}

      {/* Modal: coach */}
      {modal?.type === "coach" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-line rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg uppercase tracking-tight">Agregar coach</h2>
              <button onClick={() => setModal(null)} className="text-fg/40 hover:text-fg text-xl leading-none">✕</button>
            </div>
            <CoachForm onClose={() => setModal(null)} />
          </div>
        </div>
      )}
    </>
  );
}
