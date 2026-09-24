"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { portalBookClass, portalCancelBooking } from "./actions";

const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

type Schedule = {
  id: string;
  name: string;
  description: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_capacity: number;
  coach_name: string | null;
};

type MyBooking = {
  id: string;
  schedule_id: string;
  booking_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
};

type Slot = { start: string; end: string };

type Props = {
  schedules: Schedule[];
  myBookings: MyBooking[];
  bookingCounts: Record<string, number>;
  memberId: string | null;
  hasActiveMembership: boolean;
  today: string;
  wodByDate: Record<string, string>;
};

const WOD_CONTENT_CLS =
  "[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-1 leading-relaxed";

function DayWod({ content }: { content: string | undefined }) {
  if (!content || content.trim() === "") return null;

  return (
    <div className="bg-white/5 border border-accent/30 rounded-2xl p-4">
      <p className="text-accent text-xs uppercase tracking-widest font-semibold mb-3">
        🗓️ Planificación del día
      </p>
      <div
        className={`text-sm text-fg/80 ${WOD_CONTENT_CLS}`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function fmt12h(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Divide la ventana de la clase en bloques de 1 hora ("HH:MM:SS").
function generateSlots(start: string, end: string): Slot[] {
  const sh = parseInt(start.split(":")[0], 10);
  const eh = parseInt(end.split(":")[0], 10);
  const slots: Slot[] = [];
  for (let h = sh; h < eh; h++) {
    slots.push({ start: `${pad(h)}:00:00`, end: `${pad(h + 1)}:00:00` });
  }
  return slots;
}

export default function PortalClasesClient({
  schedules,
  myBookings,
  bookingCounts,
  memberId,
  hasActiveMembership,
  today,
  wodByDate,
}: Props) {
  const [selectedDate, setSelectedDate] = useState(today);

  // 7 días: hoy + los próximos 6
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const selectedDow = new Date(selectedDate + "T00:00:00").getDay();
  const daySchedules = schedules
    .filter((s) => s.day_of_week === selectedDow)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  // Build lookup: "scheduleId|date|startTime" -> my booking
  const myBookingMap: Record<string, MyBooking> = {};
  for (const b of myBookings) {
    myBookingMap[`${b.schedule_id}|${b.booking_date}|${b.start_time}`] = b;
  }

  // Count my upcoming confirmed bookings
  const myUpcoming = myBookings.filter((b) => b.status === "confirmed" && b.booking_date >= today);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl uppercase tracking-tight">Entrenamiento</h1>
        <p className="text-fg/40 text-sm mt-1">
          {myUpcoming.length > 0
            ? `Tienes ${myUpcoming.length} reserva${myUpcoming.length !== 1 ? "s" : ""} próxima${myUpcoming.length !== 1 ? "s" : ""}`
            : "Selecciona un día y reserva tu clase"}
        </p>
      </div>

      {/* Aviso: sin membresía activa no se puede reservar */}
      {memberId && !hasActiveMembership && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="text-xl leading-none">⚠️</span>
            <div>
              <p className="text-amber-300 font-semibold text-sm">Tu membresía no está activa</p>
              <p className="text-fg/50 text-xs mt-0.5">
                Necesitas una membresía vigente para reservar clases.
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
      )}

      {/* Date strip — 7 días que llenan el ancho */}
      <div className="grid grid-cols-7 gap-1.5">
          {dates.map((date) => {
            const d = new Date(date + "T00:00:00");
            const dow = d.getDay();
            const isToday = date === today;
            const isSelected = date === selectedDate;
            const myCount = myBookings.filter(
              (b) => b.booking_date === date && b.status === "confirmed"
            ).length;
            const hasClasses = schedules.some((s) => s.day_of_week === dow);
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center gap-1 px-1 py-3 rounded-xl border text-xs transition-colors ${
                  isSelected
                    ? "bg-accent text-white border-accent"
                    : isToday
                      ? "bg-accent/10 text-accent border-accent/30"
                      : hasClasses
                        ? "bg-white/5 text-fg/60 border-line hover:text-fg"
                        : "bg-white/[0.02] text-fg/25 border-line/30"
                }`}
              >
                <span className="font-semibold">{DAY_SHORT[dow]}</span>
                <span className={`text-xs ${isSelected ? "text-white/70" : "text-fg/40"}`}>
                  {d.getDate()} {MONTH_SHORT[d.getMonth()]}
                </span>
                {myCount > 0 && (
                  <span
                    className={`w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold ${
                      isSelected ? "bg-white/25 text-white" : "bg-accent text-white"
                    }`}
                  >
                    {myCount}
                  </span>
                )}
              </button>
            );
          })}
      </div>

      {/* Day header */}
      <div className="flex items-center gap-2">
        <h2 className="text-fg/50 text-xs uppercase tracking-widest">
          {DAY_FULL[selectedDow]},{" "}
          {(() => {
            const d = new Date(selectedDate + "T00:00:00");
            return `${d.getDate()} de ${MONTH_SHORT[d.getMonth()]}`;
          })()}
        </h2>
        {selectedDate === today && (
          <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">Hoy</span>
        )}
      </div>

      {/* Planificación del día (encima de las clases) */}
      <DayWod content={wodByDate[selectedDate]} />

      {/* Classes */}
      {daySchedules.length === 0 ? (
        <div className="bg-white/5 border border-line rounded-2xl px-6 py-12 text-center">
          <p className="text-fg/30 text-sm">Sin clases programadas para este día.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {daySchedules.map((schedule) => (
            <ClassCard
              key={schedule.id}
              schedule={schedule}
              selectedDate={selectedDate}
              isToday={selectedDate === today}
              memberId={memberId}
              hasActiveMembership={hasActiveMembership}
              myBookingMap={myBookingMap}
              bookingCounts={bookingCounts}
            />
          ))}
        </div>
      )}

      {/* Upcoming bookings summary */}
      {myUpcoming.length > 0 && (
        <div className="bg-accent/5 border border-accent/20 rounded-2xl p-4">
          <p className="text-xs text-accent uppercase tracking-widest mb-3">Mis próximas reservas</p>
          <div className="space-y-2">
            {myUpcoming
              .sort((a, b) => (a.booking_date > b.booking_date ? 1 : -1))
              .slice(0, 5)
              .map((b) => {
                const sched = schedules.find((s) => s.id === b.schedule_id);
                if (!sched) return null;
                const d = new Date(b.booking_date + "T00:00:00");
                const slotLabel = b.start_time
                  ? `${fmt12h(b.start_time)}${b.end_time ? `–${fmt12h(b.end_time)}` : ""}`
                  : fmt12h(sched.start_time);
                return (
                  <div key={b.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{sched.name}</span>
                    <span className="text-fg/40 text-xs">
                      {DAY_SHORT[d.getDay()]} {d.getDate()} {MONTH_SHORT[d.getMonth()]} · {slotLabel}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function ClassCard({
  schedule,
  selectedDate,
  isToday,
  memberId,
  hasActiveMembership,
  myBookingMap,
  bookingCounts,
}: {
  schedule: Schedule;
  selectedDate: string;
  isToday: boolean;
  memberId: string | null;
  hasActiveMembership: boolean;
  myBookingMap: Record<string, MyBooking>;
  bookingCounts: Record<string, number>;
}) {
  const slots = generateSlots(schedule.start_time, schedule.end_time);
  const nowHour = new Date().getHours();

  return (
    <div className="border border-line bg-white/5 rounded-2xl overflow-hidden">
      {/* Header de la clase */}
      <div className="px-4 py-3 border-b border-line/40">
        <p className="font-semibold">{schedule.name}</p>
        <p className="text-fg/40 text-xs mt-0.5">
          {fmt12h(schedule.start_time)} – {fmt12h(schedule.end_time)}
          {schedule.coach_name && ` · ${schedule.coach_name}`}
        </p>
        {schedule.description && (
          <p className="text-fg/30 text-xs mt-1">{schedule.description}</p>
        )}
      </div>

      {/* Bloques de 1 hora */}
      <div className="divide-y divide-line/30">
        {slots.length === 0 ? (
          <p className="text-fg/30 text-sm px-4 py-4">Sin horarios disponibles.</p>
        ) : (
          slots.map((slot) => {
            const key = `${schedule.id}|${selectedDate}|${slot.start}`;
            const myBooking = myBookingMap[key] ?? null;
            const booked = bookingCounts[key] ?? 0;
            const spotsLeft = schedule.max_capacity - booked;
            const isPast = isToday && parseInt(slot.start.split(":")[0], 10) < nowHour;
            return (
              <SlotRow
                key={slot.start}
                scheduleId={schedule.id}
                slot={slot}
                myBooking={myBooking}
                spotsLeft={spotsLeft}
                isPast={isPast}
                selectedDate={selectedDate}
                memberId={memberId}
                hasActiveMembership={hasActiveMembership}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function SlotRow({
  scheduleId,
  slot,
  myBooking,
  spotsLeft,
  isPast,
  selectedDate,
  memberId,
  hasActiveMembership,
}: {
  scheduleId: string;
  slot: Slot;
  myBooking: MyBooking | null;
  spotsLeft: number;
  isPast: boolean;
  selectedDate: string;
  memberId: string | null;
  hasActiveMembership: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const isBooked = myBooking !== null;
  const isFull = spotsLeft <= 0;
  const isAlmostFull = spotsLeft > 0 && spotsLeft <= 3;

  function handleBook() {
    if (!memberId) {
      toast.error("Necesitas ser miembro para reservar");
      return;
    }
    if (!hasActiveMembership) {
      toast.error("Necesitas una membresía activa para reservar");
      return;
    }
    startTransition(async () => {
      try {
        await portalBookClass(scheduleId, selectedDate, slot.start, slot.end);
        toast.success(`Reservado: ${fmt12h(slot.start)}–${fmt12h(slot.end)}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al reservar");
      }
    });
  }

  function handleCancel() {
    if (!myBooking) return;
    startTransition(async () => {
      try {
        await portalCancelBooking(myBooking.id);
        toast.success("Reserva cancelada");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al cancelar");
      }
    });
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors ${
        isBooked ? "bg-accent/[0.07]" : isPast ? "opacity-40" : "hover:bg-white/[0.03]"
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm">
            {fmt12h(slot.start)} – {fmt12h(slot.end)}
          </p>
          {isBooked && (
            <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full font-medium">
              Reservado ✓
            </span>
          )}
        </div>
        {!isBooked && (
          <p
            className={`text-xs mt-0.5 ${
              isPast ? "text-fg/30" : isFull ? "text-red-400" : isAlmostFull ? "text-amber-400" : "text-fg/35"
            }`}
          >
            {isPast
              ? "Horario pasado"
              : isFull
                ? "Sin cupos"
                : isAlmostFull
                  ? `¡Solo ${spotsLeft} cupo${spotsLeft !== 1 ? "s" : ""}!`
                  : `${spotsLeft} cupo${spotsLeft !== 1 ? "s" : ""}`}
          </p>
        )}
      </div>

      <div className="shrink-0">
        {isBooked ? (
          <button
            onClick={handleCancel}
            disabled={pending}
            className="text-xs text-fg/40 hover:text-red-400 border border-line hover:border-red-400/40 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {pending ? "..." : "Cancelar"}
          </button>
        ) : isPast ? (
          <span className="text-xs text-fg/25 px-2">—</span>
        ) : memberId && !hasActiveMembership ? (
          <Link
            href="/portal/renovar"
            className="text-xs border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 px-3 py-1.5 rounded-lg transition-colors font-medium whitespace-nowrap"
          >
            Renovar
          </Link>
        ) : (
          <button
            onClick={handleBook}
            disabled={pending || isFull || !memberId}
            className="text-xs bg-accent hover:bg-accent/80 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
          >
            {pending ? "..." : isFull ? "Llena" : "Reservar"}
          </button>
        )}
      </div>
    </div>
  );
}
