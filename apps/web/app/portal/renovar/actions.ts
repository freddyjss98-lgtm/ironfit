"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Sube el comprobante al bucket público payment-receipts y devuelve la URL.
export async function uploadReceipt(file: File): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${user.id}-${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from("payment-receipts")
    .upload(fileName, file, { upsert: false });
  if (error) throw new Error(error.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from("payment-receipts").getPublicUrl(data.path);
  return publicUrl;
}

// Crea la solicitud de renovación (queda pendiente de aprobación del admin).
export async function createRenewalRequest(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: member, error: mErr } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (mErr || !member) throw new Error("Perfil de miembro no encontrado");

  // Una sola solicitud pendiente a la vez
  const { data: pending } = await supabase
    .from("renewal_requests")
    .select("id")
    .eq("member_id", member.id)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (pending) throw new Error("Ya tienes una solicitud en revisión.");

  const planId = formData.get("plan_id") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const paymentMethod = (formData.get("payment_method") as string) || "transfer";
  const receiptUrl = (formData.get("receipt_url") as string) || null;
  const memberNote = (formData.get("member_note") as string) || null;

  if (!planId) throw new Error("Selecciona un plan");
  if (!receiptUrl) throw new Error("Sube el comprobante de pago");

  const { error } = await supabase.from("renewal_requests").insert({
    member_id: member.id,
    plan_id: planId,
    amount: Number.isFinite(amount) ? amount : 0,
    payment_method: paymentMethod,
    receipt_url: receiptUrl,
    member_note: memberNote,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/portal/renovar");
}
