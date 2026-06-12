import { createClient } from "@/lib/supabase/server";
import ReservasClient from "./ReservasClient";

function getEcuadorToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

export default async function ReservasPage() {
  const supabase = await createClient();
  const today = getEcuadorToday();
  const next14 = addDays(today, 13);

  const [schedulesRes, bookingsRes, membersRes] = await Promise.all([
    supabase
      .from("class_schedules")
      .select("id, name, description, start_time, end_time, max_capacity, day_of_week, coaches(full_name)")
      .eq("active", true)
      .order("day_of_week")
      .order("start_time"),

    supabase
      .from("class_bookings")
      .select("id, schedule_id, member_id, booking_date, start_time, end_time, status, created_at, members(full_name, phone)")
      .gte("booking_date", today)
      .lte("booking_date", next14)
      .neq("status", "cancelled")
      .order("booking_date")
      .order("start_time")
      .order("created_at"),

    supabase
      .from("members")
      .select("id, full_name, phone")
      .eq("status", "active")
      .order("full_name"),
  ]);

  type RawBooking = {
    id: string;
    schedule_id: string;
    member_id: string;
    booking_date: string;
    start_time: string | null;
    end_time: string | null;
    status: string;
    created_at: string;
    members: { full_name: string; phone: string } | null;
  };

  const bookings = (bookingsRes.data ?? []).map((b: unknown) => {
    const raw = b as RawBooking;
    return {
      id: raw.id,
      schedule_id: raw.schedule_id,
      member_id: raw.member_id,
      booking_date: raw.booking_date,
      start_time: raw.start_time,
      end_time: raw.end_time,
      status: raw.status,
      member_name: raw.members?.full_name ?? "—",
      member_phone: raw.members?.phone ?? "—",
    };
  });

  type RawSchedule = {
    id: string;
    name: string;
    description: string | null;
    start_time: string;
    end_time: string;
    max_capacity: number;
    day_of_week: number;
    coaches: { full_name: string } | null;
  };

  const schedules = (schedulesRes.data ?? []).map((s: unknown) => {
    const raw = s as RawSchedule;
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      start_time: raw.start_time,
      end_time: raw.end_time,
      max_capacity: raw.max_capacity,
      day_of_week: raw.day_of_week,
      coach_name: raw.coaches?.full_name ?? null,
    };
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Reservas</h2>
        <p className="text-fg/40 text-sm mt-0.5">Gestión de reservas por clase y fecha</p>
      </div>
      <ReservasClient
        schedules={schedules}
        bookings={bookings}
        members={membersRes.data ?? []}
        today={today}
      />
    </div>
  );
}
