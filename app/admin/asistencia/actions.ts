"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { todayInEcuador } from "@/lib/date";

export async function checkInMember(memberId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Membresía actual del socio, sin contar canceladas/suspendidas: una cancelada
  // con end_date lejano (creada por error) no debe pasar por la vigente.
  const { data: membership } = await supabase
    .from("memberships")
    .select("id, end_date, status, membership_plans(name)")
    .eq("member_id", memberId)
    .in("status", ["active", "frozen", "expired"])
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isActive =
    membership &&
    membership.status === "active" &&
    (membership.end_date as string) >= todayInEcuador();

  const { data, error } = await supabase
    .from("attendances")
    .insert({
      member_id: memberId,
      membership_id: membership?.id ?? null,
      checked_in_by: user?.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Este miembro ya tiene check-in registrado hoy.");
    }
    throw new Error(error.message);
  }

  revalidatePath("/admin/asistencia");
  revalidatePath("/admin");

  return {
    id: data.id,
    membershipActive: isActive,
    membershipEnd: membership?.end_date ?? null,
    planName: (membership?.membership_plans as unknown as { name: string } | null)?.name ?? null,
  };
}

export async function deleteAttendance(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("attendances").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/asistencia");
}
