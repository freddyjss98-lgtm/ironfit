"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { RECEIPTS_BUCKET } from "@/lib/receipts";
import * as renewals from "@/lib/services/renewals";

// Sube el comprobante al bucket privado payment-receipts y devuelve su RUTA
// (se muestra con URL firmada, ver lib/receipts.ts).
export async function uploadReceipt(file: File): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${user.id}-${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(fileName, file, { upsert: false });
  if (error) throw new Error(error.message);

  return data.path;
}

// Crea la solicitud de renovación (queda pendiente de aprobación del admin).
export async function createRenewalRequest(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  await renewals.createRenewalRequest(
    { supabase, userId: user.id },
    {
      planId: formData.get("plan_id") as string,
      amount: parseFloat(formData.get("amount") as string),
      paymentMethod: (formData.get("payment_method") as string) || "transfer",
      receiptPath: (formData.get("receipt_url") as string) || null,
      memberNote: (formData.get("member_note") as string) || null,
    }
  );

  revalidatePath("/portal/renovar");
}
