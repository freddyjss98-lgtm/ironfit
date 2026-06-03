"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { createBooking, cancelBooking, markAttended } from "./actions";

const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

type Schedule = {
  id: string;
  name: string;
  description: string | null;
  start_time: string;
  end_time: string;
  max_capacity: number;
  day_of_week: number;
  coach_name: string | null;
};

type Booking = {
  id: string;
  schedule_id: string;
  member_id: string;
  booking_date: string;
  status: string;
  member_name: string;
  member_phone: string;
};

type Member = { id: string; full_name: string; phone: string };

type Props = {
  schedules: Schedule[];
  bookings: Booking[];
  members: Member[];
  today: string;
};

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function displayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

function fmt12h(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export default function ReservasClient({ schedules, bookings, members, today }: Props) {
  const [selectedDate, setSelectedDate] = useState(today);

  const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  const selectedDow = new Date(selectedDate + "T00:00:00").getDay();
  const todayDow = new Date(today + "T00:00:00").getDay();

  const daySchedules = schedules
    .filter((s) => s.day_of_week === selectedDow)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const bookingsByScheduleForDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const b of bookings) {
      if (b.booking_date !== selectedDate) continue;
      if (!map[b.schedule_id]) map[b.schedule_id] = [];
      map[b.schedule_id].push(b);
    }
    return map;
  }, [bookings, selectedDate]);

  const todayBookings = bookings.filter((b) => b.booking_date === today).length;
  const todayClasses = schedules.filter((s) => s.day_of_week === todayDow).length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/5 border border-line rounded-xl p-4">
          <p className="text-fg/40 text-xs uppercase tracking-widest">Reservas hoy</p>
          <p className="font-display text-3xl mt-1 text-accent">{todayBookings}</p>
        </div>
        <div className="bg-white/5 border border-line rounded-xl p-4">
          <p className="text-fg/40 text-xs uppercase tracking-widest">Clases hoy</p>
          <p className="font-display text-3xl mt-1">{todayClasses}</p>
        </div>
        <div className="bg-white/5 border border-line rounded-xl p-4">
          <p className="text-fg/40 text-xs uppercase tracking-widest">Total 2 semanas</p>
          <p className="font-display text-3xl mt-1">{bookings.length}</p>
        </div>
      </div>

      {/* Date strip */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-2 min-w-max">
          {dates.map((date) => {
            const d = new Date(date + "T00:00:00");
            const dow = d.getDay();
            const isToday = date === today;
            const isSelected = date === selectedDate;
            const count = bookings.filter((b) => b.booking_date === date).length;
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border text-xs transition-colors min-w-[64px] ${
                  isSelected
                    ? "bg-accent text-white border-accent"
                    : isToday
                      ? "bg-accent/10 text-accent border-accent/30"
                      : "bg-white/5 text-fg/50 border-line hover:text-fg"
                }`}
              >
                <span className="font-semibold text-sm">{DAY_SHORT[dow]}</span>
                <span className={isSelected ? "text-white/70 text-xs" : "text-fg/40 text-xs"}>{displayDate(date)}</span>
                {count > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${isSelected ? "bg-white/25 text-white" : "bg-accent/20 text-accent"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Classes for selected date */}
      {daySchedules.length === 0 ? (
        <div className="bg-white/5 border border-line rounded-xl px-6 py-14 text-center">
          <p className="text-fg/30 text-sm">
            No hay clases programadas para {DAY_SHORT[selectedDow]}.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {daySchedules.map((schedule) => (
            <ClassCard
              key={schedule.id}
              schedule={schedule}
              bookings={bookingsByScheduleForDate[schedule.id] ?? []}
              members={members}
              selectedDate={selectedDate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ClassCard({
  schedule,
  bookings,
  members,
  selectedDate,
}: {
  schedule: Schedule;
  bookings: Booking[];
  members: Member[];
  selectedDate: string;
}) {
  const [addingBooking, setAddingBooking] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const confirmedCount = bookings.filter(
    (b) => b.status === "confirmed" || b.status === "attended"
  ).length;
  const pct = Math.min(100, (confirmedCount / schedule.max_capacity) * 100);
  const isFull = confirmedCount >= schedule.max_capacity;
  const bookedMemberIds = new Set(bookings.map((b) => b.member_id));

  const searchResults =
    memberSearch.trim().length >= 1
      ? members
          .filter(
            (m) =>
              !bookedMemberIds.has(m.id) &&
              (m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                m.phone.includes(memberSearch))
          )
          .slice(0, 6)
      : [];

  function handleAddBooking(member: Member) {
    startTransition(async () => {
      try {
        await createBooking(schedule.id, member.id, selectedDate);
        toast.success(`Reserva creada para ${member.full_name}`);
        setMemberSearch("");
        setAddingBooking(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al crear reserva");
      }
    });
  }

  return (
    <div className="bg-white/5 border border-line rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-line">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{schedule.name}</h3>
            <p className="text-fg/40 text-xs mt-0.5">
              {fmt12h(schedule.start_time)} – {fmt12h(schedule.end_time)}
              {schedule.coach_name && ` · Coach: ${schedule.coach_name}`}
            </p>
          </div>
          <span
            className={`text-sm font-bold shrink-0 ${
              isFull
                ? "text-red-400"
                : pct > 70
                  ? "text-amber-400"
                  : "text-fg"
            }`}
          >
            {confirmedCount}/{schedule.max_capacity}
          </span>
        </div>
        {/* Capacity bar */}
        <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isFull ? "bg-red-400" : pct > 70 ? "bg-amber-400" : "bg-accent"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Bookings list */}
      {bookings.length > 0 && (
        <div className="divide-y divide-line/40">
          {bookings.map((b) => (
            <BookingRow key={b.id} booking={b} />
          ))}
        </div>
      )}

      {bookings.length === 0 && (
        <div className="px-5 py-4 text-fg/25 text-sm text-center">
          Sin reservas para esta fecha
        </div>
      )}

      {/* Add booking footer */}
      <div className="px-5 py-3 border-t border-line/50 bg-white/[0.02]">
        {!addingBooking ? (
          <button
            onClick={() => setAddingBooking(true)}
            disabled={isFull}
            className="text-xs text-accent hover:text-accent/70 disabled:text-fg/25 disabled:cursor-not-allowed transition-colors"
          >
            {isFull ? "Clase completa — sin cupos" : "+ Agregar reserva"}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                autoFocus
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Buscar miembro por nombre o teléfono..."
                className="flex-1 bg-white/5 border border-line text-fg text-sm rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors placeholder:text-fg/30"
              />
              <button
                onClick={() => {
                  setAddingBooking(false);
                  setMemberSearch("");
                }}
                className="text-fg/40 hover:text-fg text-sm px-3 transition-colors"
              >
                ✕
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="bg-[#0a0a0a] border border-line rounded-lg overflow-hidden">
                {searchResults.map((m) => (
                  <button
                    key={m.id}
                    disabled={pending}
                    onClick={() => handleAddBooking(m)}
                    className="w-full text-left px-3 py-2.5 hover:bg-white/5 border-b border-line/30 last:border-0 transition-colors flex items-center justify-between gap-3 disabled:opacity-50"
                  >
                    <div>
                      <p className="text-sm font-medium">{m.full_name}</p>
                      <p className="text-xs text-fg/40">{m.phone}</p>
                    </div>
                    <span className="text-xs text-accent font-medium shrink-0">
                      {pending ? "..." : "+ Reservar"}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {memberSearch.trim().length >= 1 && searchResults.length === 0 && (
              <p className="text-xs text-fg/30 px-1">Sin resultados para "{memberSearch}"</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  const [pending, startTransition] = useTransition();

  function handleCancel() {
    if (!confirm(`¿Cancelar la reserva de ${booking.member_name}?`)) return;
    startTransition(async () => {
      try {
        await cancelBooking(booking.id);
        toast.success("Reserva cancelada");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al cancelar");
      }
    });
  }

  function handleAttended() {
    startTransition(async () => {
      try {
        await markAttended(booking.id);
        toast.success(`${booking.member_name} marcado como asistido`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  const STATUS_COLORS: Record<string, string> = {
    confirmed: "bg-emerald-500/15 text-emerald-400",
    attended: "bg-blue-500/15 text-blue-400",
    cancelled: "bg-red-500/15 text-red-400",
  };
  const STATUS_LABELS: Record<string, string> = {
    confirmed: "Confirmado",
    attended: "Asistió",
    cancelled: "Cancelado",
  };

  return (
    <div className={`flex items-center gap-3 px-5 py-3 transition-opacity ${pending ? "opacity-50" : ""}`}>
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-white/10 border border-line flex items-center justify-center text-xs font-semibold shrink-0">
        {booking.member_name
          .split(" ")
          .map((p) => p[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{booking.member_name}</p>
        <p className="text-fg/40 text-xs">{booking.member_phone}</p>
      </div>

      {/* Status badge */}
      <span
        className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${
          STATUS_COLORS[booking.status] ?? "bg-white/10 text-fg/40"
        }`}
      >
        {STATUS_LABELS[booking.status] ?? booking.status}
      </span>

      {/* Actions */}
      {booking.status === "confirmed" && (
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={handleAttended}
            disabled={pending}
            title="Marcar como asistido"
            className="text-xs text-blue-400 hover:text-blue-300 border border-blue-400/30 hover:border-blue-400/70 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
          >
            ✓ Asistió
          </button>
          <button
            onClick={handleCancel}
            disabled={pending}
            title="Cancelar reserva"
            className="text-xs text-fg/30 hover:text-red-400 border border-line hover:border-red-400/40 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
