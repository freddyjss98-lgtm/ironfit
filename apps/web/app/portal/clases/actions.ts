"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function portalBookClass(
  scheduleId: string,
  bookingDate: string,
  slotStart: string,
  slotEnd: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: member, error: memberErr } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (memberErr || !member) throw new Error("Perfil de miembro no encontrado");

  // Requiere membresía activa y vigente para poder reservar
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
  const { data: activeMembership } = await supabase
    .from("memberships")
    .select("id")
    .eq("member_id", member.id)
    .eq("status", "active")
    .gte("end_date", today)
    .limit(1)
    .maybeSingle();
  if (!activeMembership) {
    throw new Error("Necesitas una membresía activa para reservar clases. Renueva tu membresía.");
  }

  // Cupo por slot (hora): cuenta solo las reservas de ese bloque horario
  const [scheduleRes, countRes] = await Promise.all([
    supabase.from("class_schedules").select("max_capacity, name").eq("id", scheduleId).single(),
    supabase.rpc("get_class_booking_counts", {
      date_from: bookingDate,
      date_to: bookingDate,
    }),
  ]);

  if (scheduleRes.error) throw new Error(scheduleRes.error.message);
  const counts = (countRes.data ?? []) as {
    schedule_id: string;
    booking_date: string;
    start_time: string;
    booked_count: number;
  }[];
  const existing = counts.find(
    (c) =>
      c.schedule_id === scheduleId &&
      c.booking_date === bookingDate &&
      c.start_time === slotStart
  );
  const booked = existing?.booked_count ?? 0;

  if (booked >= scheduleRes.data.max_capacity) {
    throw new Error(`Ese horario ya no tiene cupos disponibles`);
  }

  const { error } = await supabase.from("class_bookings").insert({
    schedule_id: scheduleId,
    member_id: member.id,
    booking_date: bookingDate,
    start_time: slotStart,
    end_time: slotEnd,
  });

  if (error) {
    if (error.code === "23505") throw new Error("Ya tienes una reserva para ese horario");
    throw new Error(error.message);
  }

  revalidatePath("/portal/clases");
}

export async function portalCancelBooking(bookingId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: member, error: memberErr } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (memberErr || !member) throw new Error("Perfil de miembro no encontrado");

  // RLS ensures this booking belongs to the member
  const { error } = await supabase
    .from("class_bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .eq("member_id", member.id);

  if (error) throw new Error(error.message);
  revalidatePath("/portal/clases");
}
