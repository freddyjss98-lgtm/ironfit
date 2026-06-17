// =============================================================================
// Bot de WhatsApp — orquestación (I/O)
// =============================================================================
// Recibe un mensaje entrante ya parseado, identifica al socio, decide la
// respuesta usando el router puro (format.ts), responde por la Cloud API y
// registra todo en whatsapp_messages / whatsapp_conversations.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendWhatsappText, normalizePhoneEC } from "@/lib/whatsapp/send";
import {
  ecuadorToday,
  parseIntent,
  menuText,
  navFooter,
  unknownText,
  notAMemberText,
  formatMembership,
  formatClasses,
  formatWod,
  handoffText,
  resumeText,
  noClassesToBookText,
  bookingPromptText,
  bookingInvalidText,
  bookingConfirmedText,
  bookingAlreadyText,
  bookingFullText,
  bookingCancelledText,
  type ClassRow,
  type WodRow,
  type BookingOption,
} from "@/lib/whatsapp/bot/format";

/** Mensaje entrante ya extraído del payload del webhook de Meta. */
export type InboundMessage = {
  /** Teléfono del remitente en formato internacional sin '+' (ej: 593991487951). */
  from: string;
  /** ID del mensaje en Meta (wamid) — para idempotencia. */
  waMessageId: string;
  /** Tipo de mensaje de WhatsApp: text, interactive, image, ... */
  type: string;
  /** Texto del mensaje (vacío si no es de texto). */
  body: string;
};

type MemberRow = { id: string; full_name: string; status: string };

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

// ── Consultas ─────────────────────────────────────────────────────────────────

/** Identifica al socio por los últimos 9 dígitos de su teléfono. */
async function findMember(
  supabase: SupabaseClient,
  fromPhone: string
): Promise<MemberRow | null> {
  const core = fromPhone.replace(/\D/g, "").slice(-9);
  if (core.length < 9) return null;

  const { data } = await supabase
    .from("members")
    .select("id, full_name, status")
    .like("phone_digits", `%${core}`)
    .limit(2);

  return data && data.length > 0 ? (data[0] as MemberRow) : null;
}

async function getTodayClasses(
  supabase: SupabaseClient,
  dow: number
): Promise<ClassRow[]> {
  const { data } = await supabase
    .from("class_schedules")
    .select("name, start_time, end_time")
    .eq("active", true)
    .eq("day_of_week", dow)
    .order("start_time", { ascending: true });

  return (data ?? []) as ClassRow[];
}

type BookableClass = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
};

async function getClassesForBooking(
  supabase: SupabaseClient,
  dow: number
): Promise<BookableClass[]> {
  const { data } = await supabase
    .from("class_schedules")
    .select("id, name, start_time, end_time, max_capacity")
    .eq("active", true)
    .eq("day_of_week", dow)
    .order("start_time", { ascending: true });

  return (data ?? []) as BookableClass[];
}

/** Cupos ocupados (confirmados/asistidos) de una clase en una fecha. */
async function countBookings(
  supabase: SupabaseClient,
  scheduleId: string,
  date: string
): Promise<number> {
  const { count } = await supabase
    .from("class_bookings")
    .select("id", { count: "exact", head: true })
    .eq("schedule_id", scheduleId)
    .eq("booking_date", date)
    .in("status", ["confirmed", "attended"]);

  return count ?? 0;
}

/** WOD vigente para hoy: del tipo de programa activo, semana más reciente. */
async function getActiveWod(
  supabase: SupabaseClient,
  dow: number,
  ymd: string
): Promise<WodRow | null> {
  const { data: types } = await supabase
    .from("program_types")
    .select("id")
    .eq("is_active", true);

  const typeIds = (types ?? []).map((t) => t.id);
  if (typeIds.length === 0) return null;

  const { data: program } = await supabase
    .from("weekly_programs")
    .select("id")
    .in("type_id", typeIds)
    .lte("week_start", ymd)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!program) return null;

  const { data: wod } = await supabase
    .from("daily_workouts")
    .select("warmup, strength, wod, accessories")
    .eq("program_id", program.id)
    .eq("day_of_week", dow)
    .maybeSingle();

  return (wod as WodRow) ?? null;
}

async function getMembershipInfo(supabase: SupabaseClient, memberId: string) {
  const { data } = await supabase
    .from("vw_members_with_active_membership")
    .select(
      "full_name, current_plan_name, current_end_date, days_until_expiry, membership_status"
    )
    .eq("id", memberId)
    .maybeSingle();

  return data;
}

// ── Conversación y log ──────────────────────────────────────────────────────────

type BookingPayload = { date: string; options: BookingOption[] };

type Conversation = {
  id: string;
  status: string;
  pending_action: string | null;
  pending_payload: BookingPayload | null;
};

const CONV_COLS = "id, status, pending_action, pending_payload";

async function getOrCreateConversation(
  supabase: SupabaseClient,
  phone: string,
  memberId: string | null
): Promise<Conversation> {
  const { data: existing } = await supabase
    .from("whatsapp_conversations")
    .select(`${CONV_COLS}, member_id`)
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    // Vincula el socio si antes era desconocido.
    const patch: Record<string, unknown> = {
      last_message_at: new Date().toISOString(),
    };
    if (!existing.member_id && memberId) patch.member_id = memberId;
    await supabase
      .from("whatsapp_conversations")
      .update(patch)
      .eq("id", existing.id);

    return {
      id: existing.id,
      status: existing.status,
      pending_action: existing.pending_action,
      pending_payload: existing.pending_payload as BookingPayload | null,
    };
  }

  const { data: created } = await supabase
    .from("whatsapp_conversations")
    .insert({
      phone,
      member_id: memberId,
      last_message_at: new Date().toISOString(),
    })
    .select(CONV_COLS)
    .single();

  return created as Conversation;
}

async function setPending(
  supabase: SupabaseClient,
  conversationId: string,
  action: string,
  payload: BookingPayload
) {
  await supabase
    .from("whatsapp_conversations")
    .update({ pending_action: action, pending_payload: payload })
    .eq("id", conversationId);
}

async function clearPending(supabase: SupabaseClient, conversationId: string) {
  await supabase
    .from("whatsapp_conversations")
    .update({ pending_action: null, pending_payload: null })
    .eq("id", conversationId);
}

async function alreadyProcessed(
  supabase: SupabaseClient,
  waMessageId: string
): Promise<boolean> {
  if (!waMessageId) return false;
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("wa_message_id", waMessageId)
    .eq("direction", "inbound")
    .maybeSingle();
  return !!data;
}

// ── Flujo principal ─────────────────────────────────────────────────────────────

export type ProcessResult = {
  handled: boolean;
  reason?: string;
  intent?: string;
  replied?: boolean;
};

/**
 * Procesa un mensaje entrante de un socio: identifica, decide la respuesta por
 * menú, la envía y registra todo. Idempotente por waMessageId.
 */
export async function processInboundMessage(
  supabase: SupabaseClient,
  msg: InboundMessage
): Promise<ProcessResult> {
  const phone = normalizePhoneEC(msg.from);
  if (!phone) return { handled: false, reason: "phone_invalid" };

  // Idempotencia: Meta reintenta el webhook varias veces.
  if (await alreadyProcessed(supabase, msg.waMessageId)) {
    return { handled: false, reason: "duplicate" };
  }

  const member = await findMember(supabase, msg.from);
  const conversation = await getOrCreateConversation(supabase, phone, member?.id ?? null);

  // Registrar el mensaje entrante.
  await supabase.from("whatsapp_messages").insert({
    conversation_id: conversation.id,
    member_id: member?.id ?? null,
    direction: "inbound",
    wa_message_id: msg.waMessageId,
    from_phone: phone,
    body: msg.body,
    msg_type: msg.type,
  });

  const intent = parseIntent(msg.body);
  const name = member ? firstName(member.full_name) : "";

  // ── Modo handoff: un humano está atendiendo; el bot calla salvo "bot" ───────
  if (conversation.status === "handoff") {
    if (intent === "resume") {
      await supabase
        .from("whatsapp_conversations")
        .update({ status: "bot" })
        .eq("id", conversation.id);
      await reply(supabase, conversation.id, member?.id ?? null, phone, resumeText(), "resume");
      return { handled: true, intent: "resume", replied: true };
    }
    // Silencio: solo registramos el entrante (ya hecho) para que lo vea recepción.
    return { handled: true, intent: "handoff_silent", replied: false };
  }

  // ── Número no registrado como socio ─────────────────────────────────────────
  if (!member) {
    if (intent === "handoff") {
      await markHandoff(supabase, conversation.id);
      await reply(supabase, conversation.id, null, phone, handoffText("👋"), "handoff");
      return { handled: true, intent: "handoff", replied: true };
    }
    await reply(supabase, conversation.id, null, phone, notAMemberText(), "not_member");
    return { handled: true, intent: "not_member", replied: true };
  }

  // ── Flujo de reserva en curso (paso 2): el número elige la clase ────────────
  if (conversation.pending_action === "book_class") {
    return handleBookingSelection(supabase, conversation, member.id, phone, msg.body);
  }

  // ── Socio identificado: enrutar por menú ────────────────────────────────────
  let text: string;
  switch (intent) {
    case "membership": {
      const info = await getMembershipInfo(supabase, member.id);
      text = formatMembership({
        firstName: name,
        planName: info?.current_plan_name ?? null,
        endDate: info?.current_end_date ?? null,
        daysUntilExpiry: info?.days_until_expiry ?? null,
        membershipStatus: info?.membership_status ?? "no_membership",
      });
      break;
    }
    case "classes": {
      const { dow, dayLabel } = ecuadorToday();
      text = formatClasses(await getTodayClasses(supabase, dow), dayLabel);
      break;
    }
    case "wod": {
      const { dow, ymd, dayLabel } = ecuadorToday();
      text = formatWod(await getActiveWod(supabase, dow, ymd), dayLabel);
      break;
    }
    case "book": {
      const { dow, ymd, dayLabel } = ecuadorToday();
      const classes = await getClassesForBooking(supabase, dow);
      if (classes.length === 0) {
        text = noClassesToBookText(dayLabel) + navFooter();
        break;
      }
      const options: BookingOption[] = classes.map((c, i) => ({
        n: i + 1,
        schedule_id: c.id,
        name: c.name,
        start_time: c.start_time,
        end_time: c.end_time,
        max_capacity: c.max_capacity,
      }));
      await setPending(supabase, conversation.id, "book_class", {
        date: ymd,
        options,
      });
      text = bookingPromptText(options, dayLabel);
      break;
    }
    case "handoff": {
      await markHandoff(supabase, conversation.id);
      text = handoffText(name);
      break;
    }
    case "menu":
    case "resume":
      text = menuText();
      break;
    default:
      text = unknownText();
  }

  // Las respuestas de datos invitan a seguir (que no "muera" la conversación).
  if (intent === "membership" || intent === "classes" || intent === "wod") {
    text += navFooter();
  }

  await reply(supabase, conversation.id, member.id, phone, text, intent);
  return { handled: true, intent, replied: true };
}

async function markHandoff(supabase: SupabaseClient, conversationId: string) {
  await supabase
    .from("whatsapp_conversations")
    .update({ status: "handoff", handoff_at: new Date().toISOString() })
    .eq("id", conversationId);
}

const BOOK_CANCEL = /^(menu|menú|cancelar|salir|0|no)\b/;

/**
 * Paso 2 de "reservar clase": el socio respondió con el número de la clase.
 * Valida cupo, evita duplicados y confirma. Mantiene el estado pendiente solo
 * si la elección fue inválida o la clase estaba llena (para reintentar).
 */
async function handleBookingSelection(
  supabase: SupabaseClient,
  conversation: Conversation,
  memberId: string,
  phone: string,
  body: string
): Promise<ProcessResult> {
  const payload = conversation.pending_payload;

  // Sin opciones guardadas → reseteo y muestro el menú.
  if (!payload || !Array.isArray(payload.options)) {
    await clearPending(supabase, conversation.id);
    await reply(supabase, conversation.id, memberId, phone, menuText(), "book_reset");
    return { handled: true, intent: "book_reset", replied: true };
  }

  const t = body.trim().toLowerCase();

  // Cancelar / volver al menú.
  if (BOOK_CANCEL.test(t)) {
    await clearPending(supabase, conversation.id);
    await reply(supabase, conversation.id, memberId, phone, bookingCancelledText(), "book_cancel");
    return { handled: true, intent: "book_cancel", replied: true };
  }

  // Elegir por número.
  const n = parseInt(t.replace(/\D/g, ""), 10);
  const option = payload.options.find((o) => o.n === n);
  if (!option) {
    // Elección inválida: mantenemos el estado para que reintente.
    await reply(supabase, conversation.id, memberId, phone, bookingInvalidText(), "book_invalid");
    return { handled: true, intent: "book_invalid", replied: true };
  }

  // Chequeo de cupo (mantenemos estado si está llena, para elegir otra).
  const taken = await countBookings(supabase, option.schedule_id, payload.date);
  if (taken >= option.max_capacity) {
    await reply(supabase, conversation.id, memberId, phone, bookingFullText(option), "book_full");
    return { handled: true, intent: "book_full", replied: true };
  }

  // Crear la reserva (el unique de la tabla evita duplicados).
  const { error } = await supabase.from("class_bookings").insert({
    schedule_id: option.schedule_id,
    member_id: memberId,
    booking_date: payload.date,
    status: "confirmed",
  });

  await clearPending(supabase, conversation.id);

  if (error) {
    const text =
      error.code === "23505"
        ? bookingAlreadyText(option)
        : "Ups, no pude registrar la reserva 😕. Intenta de nuevo o escribe *asesor*.";
    await reply(supabase, conversation.id, memberId, phone, text + navFooter(), "book_error");
    return { handled: true, intent: "book_error", replied: true };
  }

  await reply(
    supabase,
    conversation.id,
    memberId,
    phone,
    bookingConfirmedText(option) + navFooter(),
    "book_confirm"
  );
  return { handled: true, intent: "book_confirm", replied: true };
}

/** Envía una respuesta de texto y la registra como mensaje saliente. */
async function reply(
  supabase: SupabaseClient,
  conversationId: string,
  memberId: string | null,
  toPhone: string,
  body: string,
  intent: string
) {
  const result = await sendWhatsappText({ to: toPhone, body });

  await supabase.from("whatsapp_messages").insert({
    conversation_id: conversationId,
    member_id: memberId,
    direction: "outbound",
    wa_message_id: result.providerMessageId ?? null,
    to_phone: toPhone,
    body,
    msg_type: "text",
    intent,
  });
}
