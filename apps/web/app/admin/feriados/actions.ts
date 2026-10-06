"use server";

// Cierres por feriado: las reglas (domingos, un día por socio, encadenadas,
// deshacer) viven en las RPC de 20261006000000_gym_closures.sql. Aquí solo se
// llama y se revalida.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionData } from "@ironfit/shared/result";

export type ClosureDayResult = {
  date: string;
  members: number;
  bookings_cancelled: number;
};

export type ClosurePreview = {
  date: string;
  /** Socios con membresía activa ese día: los que recuperan el día. */
  members: number;
  /** Reservas de clase de ese día que se van a cancelar. */
  bookings: number;
};

function revalidateAll() {
  revalidatePath("/admin/feriados");
  revalidatePath("/admin/membresias");
  revalidatePath("/admin/miembros");
  revalidatePath("/admin/miembros/[id]", "page");
  revalidatePath("/admin/reservas");
  revalidatePath("/admin");
  revalidatePath("/portal");
  revalidatePath("/portal/clases");
}

/** Cuántos socios recuperan el día y cuántas reservas se cancelan, por fecha. */
export async function previewClosures(dates: string[]): Promise<ActionData<ClosurePreview[]>> {
  if (dates.length === 0) return { ok: true, data: [] };
  const supabase = await createClient();

  const out: ClosurePreview[] = [];
  for (const date of dates) {
    const [{ data: rows, error }, { count: bookings }] = await Promise.all([
      supabase
        .from("memberships")
        .select("member_id, members!inner(deleted_at)")
        .eq("status", "active")
        .lte("start_date", date)
        .gte("end_date", date)
        .is("members.deleted_at", null),
      supabase
        .from("class_bookings")
        .select("id", { count: "exact", head: true })
        .eq("booking_date", date)
        .neq("status", "cancelled"),
    ]);
    if (error) return { ok: false, error: error.message };
    out.push({
      date,
      members: new Set((rows ?? []).map((r) => r.member_id as string)).size,
      bookings: bookings ?? 0,
    });
  }
  return { ok: true, data: out };
}

export async function createClosures(
  dates: string[],
  reason: string
): Promise<ActionData<ClosureDayResult[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_gym_closures", {
    p_dates: dates,
    p_reason: reason,
  });
  if (error) return { ok: false, error: error.message };

  revalidateAll();
  return { ok: true, data: (data ?? []) as ClosureDayResult[] };
}

/** Borra el cierre y quita el día a quienes se les dio. Devuelve a cuántos. */
export async function deleteClosure(closureId: string): Promise<ActionData<number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_gym_closure", { p_closure: closureId });
  if (error) return { ok: false, error: error.message };

  revalidateAll();
  return { ok: true, data: Number(data) || 0 };
}
