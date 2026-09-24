// =============================================================================
// Estados de entrega que reporta Meta por webhook
// =============================================================================
// La Cloud API responde 200 + wamid en cuanto ACEPTA un mensaje, no cuando lo
// entrega. El resultado real llega segundos (o minutos) después como un evento
// `statuses` en el mismo webhook de los mensajes entrantes.
//
// Ignorarlos costó caro: del 1 al 3 de septiembre de 2026 el método de pago de
// Meta estaba caído, la API siguió aceptando todo y el log marcó 'sent' sin un
// solo fallo mientras ningún socio recibía nada. Meta avisó de cada rechazo
// (error 131042) y el webhook lo descartaba.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";

export type StatusEvent = {
  /** wamid del mensaje, tal como lo devolvió la API al enviarlo. */
  waMessageId: string;
  /** sent | delivered | read | failed */
  status: string;
  errorCode: number | null;
  errorTitle: string | null;
};

/**
 * Orden de avance de un mensaje. Meta puede mandar los eventos desordenados,
 * así que un 'delivered' que llega tarde no debe pisar a un 'read'.
 */
const RANK: Record<string, number> = {
  dry_run: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

/** Aplana el payload de Meta a una lista de eventos de estado. */
export function extractStatuses(payload: unknown): StatusEvent[] {
  const out: StatusEvent[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return out;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const value = (change as { value?: { statuses?: unknown[] } })?.value;
      const sts = value?.statuses;
      if (!Array.isArray(sts)) continue;

      for (const s of sts) {
        const st = s as {
          id?: string;
          status?: string;
          errors?: { code?: number; title?: string; message?: string }[];
        };
        if (!st.id || !st.status) continue;

        const err = st.errors?.[0];
        out.push({
          waMessageId: st.id,
          status: st.status,
          errorCode: err?.code ?? null,
          errorTitle: err?.message ?? err?.title ?? null,
        });
      }
    }
  }

  return out;
}

/**
 * Vuelca un evento de estado sobre su fila de reminder_log.
 *
 * Devuelve true si actualizó algo. Un evento sin fila no es un error: también
 * llegan estados de las respuestas del bot, que no se registran en el log.
 *
 * Nota sobre carreras: el evento 'sent' puede llegar antes de que el cron
 * termine de insertar la fila. No importa — no aporta nada sobre lo que ya
 * sabemos, y los que sí importan (delivered/read/failed) llegan después.
 */
export async function applyStatusEvent(
  supabase: SupabaseClient,
  ev: StatusEvent
): Promise<boolean> {
  const { data: row } = await supabase
    .from("reminder_log")
    .select("id, status")
    .eq("provider_message_id", ev.waMessageId)
    .maybeSingle();

  if (!row) return false;

  const actual = row.status as string;

  if (ev.status === "failed") {
    // Un mensaje ya entregado no "se desentrega": si Meta manda un failed
    // tardío, ignorarlo evita que el cron reenvíe algo que el socio ya leyó.
    if (actual === "delivered" || actual === "read") return false;

    await supabase
      .from("reminder_log")
      .update({
        status: "failed",
        error_code: ev.errorCode,
        error: ev.errorTitle ?? `Meta rechazó el envío (${ev.errorCode ?? "sin código"})`,
      })
      .eq("id", row.id);
    return true;
  }

  const nuevo = RANK[ev.status];
  const previo = RANK[actual];
  // Estado desconocido, o uno que no avanza (llegó desordenado): no se toca.
  if (nuevo === undefined || previo === undefined || nuevo <= previo) return false;

  await supabase
    .from("reminder_log")
    .update({
      status: ev.status,
      ...(ev.status === "delivered" ? { delivered_at: new Date().toISOString() } : {}),
    })
    .eq("id", row.id);

  return true;
}
