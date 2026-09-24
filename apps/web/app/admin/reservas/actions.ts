"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createBooking(
  scheduleId: string,
  memberId: string,
  bookingDate: string
) {
  const supabase = await createClient();

  // Check for existing booking (including cancelled)
  const { data: existing } = await supabase
    .from("class_bookings")
    .select("id, status")
    .eq("schedule_id", scheduleId)
    .eq("member_id", memberId)
    .eq("booking_date", bookingDate)
    .maybeSingle();

  if (existing) {
    if (existing.status === "confirmed" || existing.status === "attended") {
      throw new Error("Este miembro ya tiene una reserva activa para esta clase");
    }
    // Reactivate a previously cancelled booking
    const { error } = await supabase
      .from("class_bookings")
      .update({ status: "confirmed" })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/reservas");
    return;
  }

  // Check capacity
  const [scheduleRes, countRes] = await Promise.all([
    supabase.from("class_schedules").select("max_capacity").eq("id", scheduleId).single(),
    supabase
      .from("class_bookings")
      .select("id", { count: "exact", head: true })
      .eq("schedule_id", scheduleId)
      .eq("booking_date", bookingDate)
      .in("status", ["confirmed", "attended"]),
  ]);

  if (scheduleRes.error) throw new Error(scheduleRes.error.message);
  const booked = countRes.count ?? 0;
  if (booked >= scheduleRes.data.max_capacity) {
    throw new Error(`Clase llena (${scheduleRes.data.max_capacity}/${scheduleRes.data.max_capacity} cupos)`);
  }

  const { error } = await supabase.from("class_bookings").insert({
    schedule_id: scheduleId,
    member_id: memberId,
    booking_date: bookingDate,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/reservas");
}

export async function cancelBooking(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("class_bookings")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/reservas");
}

export async function markAttended(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("class_bookings")
    .update({ status: "attended" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/reservas");
}
