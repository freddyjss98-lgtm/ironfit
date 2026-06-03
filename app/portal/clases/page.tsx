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

export default async function PortalClasesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const today = getEcuadorToday();
  const next13 = addDays(today, 13);

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

  // Member's own bookings + capacity counts (via security-definer RPC)
  const [myBookingsRes, countsRes] = memberId
    ? await Promise.all([
        supabase
          .from("class_bookings")
          .select("id, schedule_id, booking_date, status")
          .eq("member_id", memberId)
          .gte("booking_date", today)
          .lte("booking_date", next13)
          .neq("status", "cancelled"),
        supabase.rpc("get_class_booking_counts", {
          date_from: today,
          date_to: next13,
        }),
      ])
    : [{ data: [] as unknown[] }, { data: [] as unknown[] }];

  // Build count map: "scheduleId|date" -> booked_count
  type CountRow = { schedule_id: string; booking_date: string; booked_count: number };
  const bookingCounts: Record<string, number> = {};
  for (const row of (countsRes.data ?? []) as CountRow[]) {
    bookingCounts[`${row.schedule_id}|${row.booking_date}`] = row.booked_count;
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

  type MyBooking = { id: string; schedule_id: string; booking_date: string; status: string };

  return (
    <PortalClasesClient
      schedules={schedules}
      myBookings={(myBookingsRes.data ?? []) as MyBooking[]}
      bookingCounts={bookingCounts}
      memberId={memberId}
      today={today}
    />
  );
}
