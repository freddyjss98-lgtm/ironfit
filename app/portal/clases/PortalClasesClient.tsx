"use client";

import { useState, useTransition } from "react";
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
  status: string;
};

type Props = {
  schedules: Schedule[];
  myBookings: MyBooking[];
  bookingCounts: Record<string, number>;
  memberId: string | null;
  today: string;
};

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

export default function PortalClasesClient({
  schedules,
  myBookings,
  bookingCounts,
  memberId,
  today,
}: Props) {
  const [selectedDate, setSelectedDate] = useState(today);

  // 14 days strip
  const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  const selectedDow = new Date(selectedDate + "T00:00:00").getDay();
  const daySchedules = schedules
    .filter((s) => s.day_of_week === selectedDow)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  // Build lookup: "scheduleId|date" -> my booking
  const myBookingMap: Record<string, MyBooking> = {};
  for (const b of myBookings) {
    myBookingMap[`${b.schedule_id}|${b.booking_date}`] = b;
  }

  // Count my upcoming confirmed bookings
  const myUpcoming = myBookings.filter((b) => b.status === "confirmed" && b.booking_date >= today);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl uppercase tracking-tight">Horario de clases</h1>
        <p className="text-fg/40 text-sm mt-1">
          {myUpcoming.length > 0
            ? `Tienes ${myUpcoming.length} reserva${myUpcoming.length !== 1 ? "s" : ""} próxima${myUpcoming.length !== 1 ? "s" : ""}`
            : "Selecciona un día y reserva tu clase"}
        </p>
      </div>

      {/* Date strip */}
      <div className="overflow-x-auto pb-1 -mx-4 px-4">
        <div className="flex gap-2 min-w-max">
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
                className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-xs transition-colors min-w-[58px] ${
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

      {/* Classes */}
      {daySchedules.length === 0 ? (
        <div className="bg-white/5 border border-line rounded-2xl px-6 py-12 text-center">
          <p className="text-fg/30 text-sm">Sin clases programadas para este día.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {daySchedules.map((schedule) => {
            const key = `${schedule.id}|${selectedDate}`;
            const myBooking = myBookingMap[key] ?? null;
            const booked = bookingCounts[key] ?? 0;
            const spotsLeft = schedule.max_capacity - booked;
            return (
              <ClassCard
                key={schedule.id}
                schedule={schedule}
                myBooking={myBooking}
                spotsLeft={spotsLeft}
                selectedDate={selectedDate}
                memberId={memberId}
              />
            );
          })}
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
                return (
                  <div key={b.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{sched.name}</span>
                    <span className="text-fg/40 text-xs">
                      {DAY_SHORT[d.getDay()]} {d.getDate()} {MONTH_SHORT[d.getMonth()]} · {fmt12h(sched.start_time)}
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
  myBooking,
  spotsLeft,
  selectedDate,
  memberId,
}: {
  schedule: Schedule;
  myBooking: MyBooking | null;
  spotsLeft: number;
  selectedDate: string;
  memberId: string | null;
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
    startTransition(async () => {
      try {
        await portalBookClass(schedule.id, selectedDate);
        toast.success(`Reservado: ${schedule.name}`);
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
      className={`border rounded-2xl p-4 transition-colors ${
        isBooked
          ? "bg-accent/5 border-accent/30"
          : isFull
            ? "bg-white/[0.02] border-line/40 opacity-60"
            : "bg-white/5 border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold">{schedule.name}</p>
            {isBooked && (
              <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full font-medium">
                Reservado ✓
              </span>
            )}
          </div>
          <p className="text-fg/40 text-xs mt-1">
            {fmt12h(schedule.start_time)} – {fmt12h(schedule.end_time)}
            {schedule.coach_name && ` · ${schedule.coach_name}`}
          </p>
          {schedule.description && (
            <p className="text-fg/30 text-xs mt-1">{schedule.description}</p>
          )}
          <p
            className={`text-xs mt-1.5 ${
              isFull ? "text-red-400" : isAlmostFull ? "text-amber-400" : "text-fg/30"
            }`}
          >
            {isFull
              ? "Sin cupos disponibles"
              : isAlmostFull
                ? `¡Solo quedan ${spotsLeft} cupo${spotsLeft !== 1 ? "s" : ""}!`
                : `${spotsLeft} cupo${spotsLeft !== 1 ? "s" : ""} disponible${spotsLeft !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Action button */}
        <div className="shrink-0">
          {isBooked ? (
            <button
              onClick={handleCancel}
              disabled={pending}
              className="text-xs text-fg/40 hover:text-red-400 border border-line hover:border-red-400/40 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {pending ? "..." : "Cancelar"}
            </button>
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
    </div>
  );
}
