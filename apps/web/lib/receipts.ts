// Comprobantes de pago (bucket privado `payment-receipts`).
//
// Hasta 2026-09 el bucket era público y `renewal_requests.receipt_url` guardaba
// la URL pública completa. Ahora se guarda la RUTA del archivo y se muestra con
// una URL firmada de corta duración. Las filas viejas se leen igual: de la URL
// pública se extrae la ruta.

import type { SupabaseClient } from "@supabase/supabase-js";

export const RECEIPTS_BUCKET = "payment-receipts";
const PUBLIC_MARKER = `/object/public/${RECEIPTS_BUCKET}/`;
const SIGNED_TTL_SECONDS = 60 * 60;

/** Ruta del archivo dentro del bucket, venga como ruta o como URL pública vieja. */
export function receiptPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const i = value.indexOf(PUBLIC_MARKER);
  if (i >= 0) return decodeURIComponent(value.slice(i + PUBLIC_MARKER.length));
  return value.startsWith("http") ? null : value;
}

/**
 * URLs firmadas para mostrar comprobantes, en el mismo orden que `values`.
 * Usa el cliente de quien consulta: el RLS de storage decide si puede verlos
 * (staff todos; el socio solo los suyos).
 */
export async function signReceiptUrls(
  supabase: SupabaseClient,
  values: (string | null | undefined)[]
): Promise<(string | null)[]> {
  const paths = values.map(receiptPath);
  const wanted = paths.filter((p): p is string => !!p);
  if (wanted.length === 0) return values.map(() => null);

  const { data } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrls(wanted, SIGNED_TTL_SECONDS);
  const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return paths.map((p) => (p ? (byPath.get(p) ?? null) : null));
}
