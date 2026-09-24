"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Las reglas (membresía activa, cupo por horario, reactivar una reserva
// cancelada) viven en la RPC `book_class`: la app móvil la llama igual.
export async function portalBookClass(
  scheduleId: string,
  bookingDate: string,
  slotStart: string,
  slotEnd: string
) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("book_class", {
    p_schedule_id: scheduleId,
    p_booking_date: bookingDate,
    p_start_time: slotStart,
    p_end_time: slotEnd,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/portal/clases");
}

export async function portalCancelBooking(bookingId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("cancel_my_booking", { p_booking_id: bookingId });
  if (error) throw new Error(error.message);

  revalidatePath("/portal/clases");
}
