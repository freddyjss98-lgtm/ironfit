// Registro de entrada hecho por el staff (admin o coach) desde recepción.

import { todayInEcuador } from "@ironfit/shared/date";
import type { ServiceCtx } from "./types";

export type CheckInResult = {
  id: string;
  membershipActive: boolean;
  membershipEnd: string | null;
  planName: string | null;
};

export async function checkInMember(
  { supabase, userId }: ServiceCtx,
  memberId: string
): Promise<CheckInResult> {
  if (!memberId) throw new Error("Selecciona un socio");

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
    !!membership &&
    membership.status === "active" &&
    (membership.end_date as string) >= todayInEcuador();

  const { data, error } = await supabase
    .from("attendances")
    .insert({
      member_id: memberId,
      membership_id: membership?.id ?? null,
      checked_in_by: userId,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Este miembro ya tiene check-in registrado hoy.");
    }
    throw new Error(error.message);
  }

  return {
    id: data.id as string,
    membershipActive: isActive,
    membershipEnd: (membership?.end_date as string | undefined) ?? null,
    planName: (membership?.membership_plans as unknown as { name: string } | null)?.name ?? null,
  };
}
