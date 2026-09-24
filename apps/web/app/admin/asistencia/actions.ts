"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import * as attendance from "@/lib/services/attendance";

export async function checkInMember(memberId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const result = await attendance.checkInMember({ supabase, userId: user?.id ?? null }, memberId);

  revalidatePath("/admin/asistencia");
  revalidatePath("/admin");

  return result;
}

export async function deleteAttendance(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("attendances").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/asistencia");
}
