"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Marca un socio auto-registrado como revisado (quita la notificación). */
export async function markMemberReviewed(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("members")
    .update({ reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .is("reviewed_at", null);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

/** Marca todos los socios pendientes como revisados. */
export async function markAllMembersReviewed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("members")
    .update({ reviewed_at: new Date().toISOString() })
    .is("reviewed_at", null);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
