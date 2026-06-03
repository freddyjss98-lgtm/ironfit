"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { createEvent, updateEvent, deleteEvent } from "./actions";

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const DAY_LABELS = ["L","M","M","J","V","S","D"];
const DAYS_FULL = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MONTH_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

type Event = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;       // YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  max_capacity: number | null;
};

type Props = { events: Event[] };

const inputCls =
  "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-fg/20";
const labelCls = "text-fg/50 text-xs uppercase tracking-wider";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmt12h(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event form (create / edit)
// ─────────────────────────────────────────────────────────────────────────────
function EventForm({
  event,
  defaultDate,
  onClose,
}: {
  event?: Event;
  defaultDate?: string;
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
        if (event) {
          await updateEvent(event.id, fd);
          toast.success("Evento actualizado");
        } else {
          await createEvent(fd);
          toast.success("Evento creado");
        }
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
        {/* Title */}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Título *</label>
          <input
            name="title"
            required
            defaultValue={event?.title}
            className={inputCls}
            placeholder="Ej. Competencia Interna, Taller de Nutrición..."
          />
        </div>

        {/* Date */}
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Fecha *</label>
          <input
            name="event_date"
            type="date"
            required
            defaultValue={event?.event_date ?? defaultDate}
            className={inputCls}
          />
        </div>

        {/* Location */}
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Lugar</label>
          <input
            name="location"
            defaultValue={event?.location ?? ""}
            className={inputCls}
            placeholder="Iron Fit Club, Parque Central..."
          />
        </div>

        {/* Start time */}
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Hora inicio</label>
          <input
            name="start_time"
            type="time"
            defaultValue={event?.start_time?.slice(0, 5) ?? ""}
            className={inputCls}
          />
        </div>

        {/* End time */}
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Hora fin</label>
          <input
            name="end_time"
            type="time"
            defaultValue={event?.end_time?.slice(0, 5) ?? ""}
            className={inputCls}
          />
        </div>

        {/* Capacity */}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Capacidad máxima (opcional)</label>
          <input
            name="max_capacity"
            type="number"
            min="1"
            defaultValue={event?.max_capacity ?? ""}
            className={inputCls}
            placeholder="Dejar en blanco si no hay límite"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Descripción</label>
          <textarea
            name="description"
            rows={3}
            defaultValue={event?.description ?? ""}
            className={inputCls + " resize-none"}
            placeholder="Detalles del evento, requisitos, premios..."
          />
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-2">
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
          {pending ? "Guardando..." : event ? "Actualizar" : "Crear evento"}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Event card
// ─────────────────────────────────────────────────────────────────────────────
function EventCard({
  event,
  onEdit,
}: {
  event: Event;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`¿Eliminar el evento "${event.title}"?`)) return;
    startTransition(async () => {
      try {
        await deleteEvent(event.id);
        toast.success("Evento eliminado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al eliminar");
      }
    });
  }

  return (
    <div className="bg-white/5 border border-line rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{event.title}</p>
          {event.location && (
            <p className="text-fg/40 text-xs mt-0.5 flex items-center gap-1">
              <span>📍</span> {event.location}
            </p>
          )}
        </div>
        {/* Time badge */}
        {event.start_time && (
          <span className="text-xs bg-accent/15 text-accent px-2 py-1 rounded-lg shrink-0 font-medium">
            {fmt12h(event.start_time)}
            {event.end_time && ` – ${fmt12h(event.end_time)}`}
          </span>
        )}
      </div>

      {/* Description */}
      {event.description && (
        <p className="text-fg/50 text-xs leading-relaxed">{event.description}</p>
      )}

      {/* Capacity */}
      {event.max_capacity && (
        <p className="text-fg/30 text-xs">Capacidad: {event.max_capacity} personas</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-line/40">
        <button
          onClick={onEdit}
          className="flex-1 text-xs text-fg/40 hover:text-fg border border-line/50 hover:border-accent/40 py-1.5 rounded-lg transition-colors"
        >
          Editar
        </button>
        <button
          onClick={handleDelete}
          disabled={pending}
          className="text-xs text-red-400/40 hover:text-red-400 border border-line/40 hover:border-red-500/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
        >
          {pending ? "..." : "Eliminar"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar
// ─────────────────────────────────────────────────────────────────────────────
function EventCalendar({
  eventCountByDate,
  selected,
  onSelect,
}: {
  eventCountByDate: Record<string, number>;
  selected: string | null;
  onSelect: (dateStr: string) => void;
}) {
  const todayStr = useMemo(() => toDateStr(new Date()), []);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  // Mon-first offset
  const firstWd = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  type Cell = { day: number; dateStr: string; curr: boolean };
  const cells: Cell[] = [];

  for (let i = firstWd - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    cells.push({
      day: d,
      dateStr: toDateStr(new Date(year, month - 1, d)),
      curr: false,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateStr: toDateStr(new Date(year, month, d)), curr: true });
  }
  while (cells.length % 7 !== 0) {
    const d = cells.length - firstWd - daysInMonth + 1;
    cells.push({
      day: d,
      dateStr: toDateStr(new Date(year, month + 1, d)),
      curr: false,
    });
  }

  return (
    <div className="bg-white/5 border border-line rounded-xl p-4 select-none">
      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
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

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="text-center text-xs text-fg/25 py-1 font-medium">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, i) => {
          const count = eventCountByDate[cell.dateStr] ?? 0;
          const isSelected = cell.dateStr === selected;
          const isToday = cell.dateStr === todayStr;
          const hasEvents = cell.curr && count > 0;

          return (
            <button
              key={i}
              onClick={() => cell.curr && onSelect(cell.dateStr)}
              disabled={!cell.curr}
              className={[
                "relative w-9 h-9 mx-auto flex flex-col items-center justify-center text-xs rounded-xl transition-all",
                !cell.curr ? "opacity-20 cursor-default" : "cursor-pointer",
                isSelected
                  ? "bg-accent text-white font-bold"
                  : hasEvents
                    ? "bg-orange-500/20 text-orange-300 font-semibold hover:bg-orange-500/35"
                    : cell.curr
                      ? "text-fg/50 hover:bg-white/8 hover:text-fg"
                      : "",
                isToday && !isSelected ? "ring-1 ring-accent/60" : "",
              ].join(" ")}
            >
              <span className="leading-none">{cell.day}</span>
              {hasEvents && !isSelected && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center bg-orange-500 text-white text-[9px] font-bold rounded-full leading-none">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-line/50 flex flex-col gap-1.5">
        <span className="flex items-center gap-2 text-xs text-fg/35">
          <span className="w-3 h-3 rounded bg-orange-500/25 inline-block" />
          Días con eventos se muestran en naranja
        </span>
        <span className="flex items-center gap-2 text-xs text-fg/35">
          <span className="w-4 h-4 rounded-full bg-orange-500 inline-flex items-center justify-center text-white text-[9px] font-bold">1</span>
          El número indica cantidad de eventos
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Day panel (right side)
// ─────────────────────────────────────────────────────────────────────────────
function DayPanel({
  dateStr,
  events,
  onNewEvent,
  onEdit,
}: {
  dateStr: string | null;
  events: Event[];
  onNewEvent: () => void;
  onEdit: (e: Event) => void;
}) {
  if (!dateStr) {
    return (
      <div className="bg-white/5 border border-line rounded-xl flex flex-col items-center justify-center gap-4 min-h-[400px] p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-3xl">
          📅
        </div>
        <div>
          <p className="text-fg/40 text-sm">Selecciona una fecha para ver los eventos programados</p>
          <p className="text-fg/20 text-xs mt-1">Los días con eventos se muestran en naranja</p>
        </div>
      </div>
    );
  }

  const d = new Date(dateStr + "T00:00:00");
  const dayLabel = `${DAYS_FULL[d.getDay()]}, ${d.getDate()} de ${MONTH_SHORT[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;

  return (
    <div className="bg-white/5 border border-line rounded-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <p className="font-semibold capitalize text-sm">{dayLabel}</p>
          <p className="text-fg/35 text-xs mt-0.5">
            {events.length === 0
              ? "Sin eventos"
              : `${events.length} evento${events.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={onNewEvent}
          className="flex items-center gap-2 bg-accent hover:bg-accent/80 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          + Evento
        </button>
      </div>

      {/* Events */}
      <div className="flex-1 p-5">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <p className="text-fg/25 text-sm">Sin eventos para este día</p>
            <button onClick={onNewEvent} className="text-accent text-sm hover:underline">
              Crear primer evento →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {events
              .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))
              .map((ev) => (
                <EventCard key={ev.id} event={ev} onEdit={() => onEdit(ev)} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
type Modal =
  | { type: "create"; defaultDate?: string }
  | { type: "edit"; event: Event }
  | null;

export default function EventosClient({ events }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);

  // Event count per date string
  const eventCountByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ev of events) {
      map[ev.event_date] = (map[ev.event_date] ?? 0) + 1;
    }
    return map;
  }, [events]);

  // Events for selected date
  const dayEvents = useMemo(
    () => events.filter((ev) => ev.event_date === selectedDate),
    [events, selectedDate]
  );

  // Upcoming events (next 30 days) for quick summary
  const todayStr = toDateStr(new Date());
  const in30 = toDateStr(new Date(Date.now() + 30 * 86400000));
  const upcoming = events
    .filter((ev) => ev.event_date >= todayStr && ev.event_date <= in30)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 4);

  return (
    <>
      {/* Upcoming strip */}
      {upcoming.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
          {upcoming.map((ev) => {
            const d = new Date(ev.event_date + "T00:00:00");
            return (
              <button
                key={ev.id}
                onClick={() => setSelectedDate(ev.event_date)}
                className="bg-orange-500/10 border border-orange-500/25 rounded-xl p-3 text-left hover:border-orange-500/50 transition-colors"
              >
                <p className="text-orange-300 text-xs font-semibold">
                  {d.getDate()} {MONTH_SHORT[d.getMonth()]}
                </p>
                <p className="text-fg text-sm font-medium truncate mt-0.5">{ev.title}</p>
                {ev.start_time && (
                  <p className="text-fg/40 text-xs mt-0.5">{fmt12h(ev.start_time)}</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Main layout: calendar + day panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 items-start">
        <EventCalendar
          eventCountByDate={eventCountByDate}
          selected={selectedDate}
          onSelect={(d) => setSelectedDate(d === selectedDate ? null : d)}
        />
        <DayPanel
          dateStr={selectedDate}
          events={dayEvents}
          onNewEvent={() => setModal({ type: "create", defaultDate: selectedDate ?? todayStr })}
          onEdit={(ev) => setModal({ type: "edit", event: ev })}
        />
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-line rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg uppercase tracking-tight">
                {modal.type === "edit" ? "Editar evento" : "Nuevo evento"}
              </h2>
              <button
                onClick={() => setModal(null)}
                className="text-fg/40 hover:text-fg text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <EventForm
              event={modal.type === "edit" ? modal.event : undefined}
              defaultDate={modal.type === "create" ? modal.defaultDate : undefined}
              onClose={() => setModal(null)}
            />
          </div>
        </div>
      )}
    </>
  );
}
