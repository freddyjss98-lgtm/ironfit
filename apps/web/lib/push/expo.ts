// =============================================================================
// Notificaciones push de la app móvil (Expo Push Service)
// =============================================================================
// La app registra su token en `push_tokens` (RLS: cada usuario los suyos) y el
// servidor los lee con service role para avisar. Igual que el aviso por
// WhatsApp, es best-effort: NUNCA lanza — un push que no sale no debe romper
// la aprobación de una renovación ni el registro de un socio.
//
// Docs: https://docs.expo.dev/push-notifications/sending-notifications/
// =============================================================================

import { createAdminClient } from "@/lib/supabase/admin";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
// Expo acepta hasta 100 mensajes por petición.
const CHUNK = 100;

export type PushMessage = {
  title: string;
  body: string;
  /** Llega a la app con la notificación: sirve para abrir la pantalla correcta. */
  data?: Record<string, unknown>;
};

type Ticket = { status: "ok" | "error"; details?: { error?: string } };

async function sendChunk(tokens: string[], msg: PushMessage): Promise<Ticket[]> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  // Solo hace falta si se activa "Enhanced Security for Push Notifications" en Expo.
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(
      tokens.map((to) => ({ to, sound: "default", title: msg.title, body: msg.body, data: msg.data }))
    ),
  });
  if (!res.ok) throw new Error(`Expo push ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: Ticket[] };
  return json.data ?? [];
}

/** Envía un push a todos los dispositivos de esos usuarios. */
export async function sendPushToUsers(userIds: string[], msg: PushMessage): Promise<void> {
  try {
    if (userIds.length === 0) return;
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("push_tokens")
      .select("token")
      .in("user_id", userIds);
    if (error) throw error;
    const tokens = (data ?? []).map((r) => r.token as string);

    const dead: string[] = [];
    for (let i = 0; i < tokens.length; i += CHUNK) {
      const batch = tokens.slice(i, i + CHUNK);
      const tickets = await sendChunk(batch, msg);
      tickets.forEach((t, j) => {
        // La app se desinstaló o el token caducó: no tiene sentido guardarlo.
        if (t.status === "error" && t.details?.error === "DeviceNotRegistered") dead.push(batch[j]);
      });
    }
    if (dead.length) await supabase.from("push_tokens").delete().in("token", dead);
  } catch (err) {
    console.error("[push] error", err);
  }
}

/** Avisa a todos los admins del gimnasio. */
export async function pushToAdmins(msg: PushMessage): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("profiles").select("id").eq("role", "admin");
    await sendPushToUsers((data ?? []).map((p) => p.id as string), msg);
  } catch (err) {
    console.error("[push] admins", err);
  }
}

/** Avisa al socio (si tiene acceso a la app). */
export async function pushToMember(memberId: string, msg: PushMessage): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("members").select("user_id").eq("id", memberId).maybeSingle();
    if (data?.user_id) await sendPushToUsers([data.user_id as string], msg);
  } catch (err) {
    console.error("[push] member", err);
  }
}
