"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import * as renewals from "@/lib/services/renewals";

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

// Aprueba la solicitud → renueva la membresía (membership + venta) y la marca aprobada.
export async function approveRenewalRequest(requestId: string) {
  await renewals.approveRenewalRequest(await ctx(), requestId);

  revalidatePath("/admin/renovaciones");
  revalidatePath("/admin/membresias");
  revalidatePath("/admin");
}

export async function rejectRenewalRequest(requestId: string, reason: string) {
  await renewals.rejectRenewalRequest(await ctx(), requestId, reason);

  revalidatePath("/admin/renovaciones");
}

export async function updateGymSettings(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("gym_settings")
    .update({
      bank_name: (formData.get("bank_name") as string) || null,
      account_type: (formData.get("account_type") as string) || null,
      account_number: (formData.get("account_number") as string) || null,
      account_holder: (formData.get("account_holder") as string) || null,
      account_doc: (formData.get("account_doc") as string) || null,
      payment_note: (formData.get("payment_note") as string) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/renovaciones");
  revalidatePath("/portal/renovar");
}
