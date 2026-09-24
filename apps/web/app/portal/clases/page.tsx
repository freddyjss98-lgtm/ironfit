import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PortalClasesClient from "./PortalClasesClient";

function getEcuadorToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function toMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay();
  return addDays(dateStr, dow === 0 ? -6 : -(dow - 1));
}

// Fecha ISO real de un día (dow 0=Dom..6=Sáb) dentro de una semana (lunes).
function dayDateISO(weekStart: string, dow: number): string {
  return addDays(weekStart, dow === 0 ? 6 : dow - 1);
}

export default async function PortalClasesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const today = getEcuadorToday();
  // Ventana visible: hoy + los próximos 6 días (7 en total)
  const windowEnd = addDays(today, 6);

  const [memberRes, schedulesRes] = await Promise.all([
    supabase.from("members").select("id, full_name").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("class_schedules")
      .select("id, name, description, day_of_week, start_time, end_time, max_capacity, coaches(full_name)")
      .eq("active", true)
      .order("day_of_week")
      .order("start_time"),
  ]);

  const memberId = memberRes.data?.id ?? null;

  // Member's own bookings + capacity counts (via security-definer RPC) + active membership
  const [myBookingsRes, countsRes, membershipRes] = memberId
    ? await Promise.all([
        supabase
          .from("class_bookings")
          .select("id, schedule_id, booking_date, start_time, end_time, status")
          .eq("member_id", memberId)
          .gte("booking_date", today)
          .lte("booking_date", windowEnd)
          .neq("status", "cancelled"),
        supabase.rpc("get_class_booking_counts", {
          date_from: today,
          date_to: windowEnd,
        }),
        supabase
          .from("memberships")
          .select("id")
          .eq("member_id", memberId)
          .eq("status", "active")
          .gte("end_date", today)
          .limit(1)
          .maybeSingle(),
      ])
    : [{ data: [] as unknown[] }, { data: [] as unknown[] }, { data: null }];

  const hasActiveMembership = Boolean((membershipRes as { data: unknown }).data);

  if (schedulesRes.error) {
    console.error("[PortalClasesPage] schedules error:", schedulesRes.error);
  }
  if ("error" in countsRes && countsRes.error) {
    console.error("[PortalClasesPage] booking counts error:", countsRes.error);
  }

  // Build count map: "scheduleId|date|startTime" -> booked_count
  type CountRow = {
    schedule_id: string;
    booking_date: string;
    start_time: string;
    booked_count: number;
  };
  const bookingCounts: Record<string, number> = {};
  for (const row of (countsRes.data ?? []) as CountRow[]) {
    bookingCounts[`${row.schedule_id}|${row.booking_date}|${row.start_time}`] = row.booked_count;
  }

  type RawSchedule = {
    id: string;
    name: string;
    description: string | null;
    day_of_week: number;
    start_time: string;
    end_time: string;
    max_capacity: number;
    coaches: { full_name: string } | null;
  };

  const schedules = (schedulesRes.data ?? []).map((s: unknown) => {
    const raw = s as RawSchedule;
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      day_of_week: raw.day_of_week,
      start_time: raw.start_time,
      end_time: raw.end_time,
      max_capacity: raw.max_capacity,
      coach_name: raw.coaches?.full_name ?? null,
    };
  });

  type MyBooking = {
    id: string;
    schedule_id: string;
    booking_date: string;
    start_time: string | null;
    end_time: string | null;
    status: string;
  };

  // ── Planificación (WOD) del programa activo para el rango visible ──────────
  const wodByDate: Record<string, string> = {};

  const { data: types } = await supabase
    .from("program_types")
    .select("id, is_active, sort_order")
    .order("sort_order");
  const activeType = (types ?? []).find((t) => t.is_active) ?? (types ?? [])[0] ?? null;

  if (activeType) {
    const monday = toMonday(today);
    const { data: weeks } = await supabase
      .from("weekly_programs")
      .select("id, week_start")
      .eq("type_id", activeType.id)
      .gte("week_start", monday)
      .lte("week_start", addDays(monday, 21))
      .order("week_start");

    const weekStartById: Record<string, string> = {};
    for (const w of weeks ?? []) weekStartById[w.id as string] = w.week_start as string;
    const weekIds = Object.keys(weekStartById);

    if (weekIds.length > 0) {
      const { data: workouts } = await supabase
        .from("daily_workouts")
        .select("program_id, day_of_week, content")
        .in("program_id", weekIds);
      for (const w of workouts ?? []) {
        const ws = weekStartById[w.program_id as string];
        if (!ws) continue;
        const date = dayDateISO(ws, w.day_of_week as number);
        const c = (w.content ?? "") as string;
        if (c) wodByDate[date] = c;
      }
    }
  }

  return (
    <PortalClasesClient
      schedules={schedules}
      myBookings={(myBookingsRes.data ?? []) as MyBooking[]}
      bookingCounts={bookingCounts}
      memberId={memberId}
      hasActiveMembership={hasActiveMembership}
      today={today}
      wodByDate={wodByDate}
    />
  );
}
