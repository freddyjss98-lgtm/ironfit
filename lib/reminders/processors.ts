// =============================================================================
// Procesadores de recordatorios WhatsApp
// =============================================================================
// Cada procesador sabe (a) cómo buscar sus candidatos en la DB y (b) cómo armar
// el texto y la plantilla de Meta. El cron (app/api/cron/reminders/route.ts)
// itera sobre todos, aplica idempotencia por (member_id + reference_date) y
// envía. Para agregar un tipo nuevo: añade un ReminderProcessor a la lista.
//
// Los nombres de plantilla se pueden sobreescribir por env; por defecto usan el
// nombre que se registró en Meta, así no hace falta agregar envs en Vercel.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TemplateMessage } from "@/lib/whatsapp/send";
import {
  REMINDER_TYPE_EXPIRY,
  EXPIRY_REMINDER_DAYS,
  buildExpiryMessage,
  buildExpiryTemplate,
  formatSpanishDate,
  type ExpiryCandidate,
} from "@/lib/reminders/expiry";

export const REMINDER_TYPE_EXPIRED = "membership_expired";
export const REMINDER_TYPE_WELCOME = "member_welcome";
export const REMINDER_TYPE_WINBACK = "member_winback";
export const REMINDER_TYPE_BIRTHDAY = "member_birthday";
export const REMINDER_TYPE_CLASS = "class_reminder";

const LANG = process.env.WHATSAPP_TEMPLATE_LANG ?? "es";
const TPL = {
  expired: process.env.WHATSAPP_TEMPLATE_EXPIRED ?? "membership_expired",
  welcome: process.env.WHATSAPP_TEMPLATE_WELCOME ?? "member_welcome",
  winback: process.env.WHATSAPP_TEMPLATE_WINBACK ?? "member_winback",
  birthday: process.env.WHATSAPP_TEMPLATE_BIRTHDAY ?? "member_birthday",
  classReminder: process.env.WHATSAPP_TEMPLATE_CLASS ?? "class_reminder",
};

/** Un candidato listo para enviar: ya trae el texto y la plantilla armados. */
export type ReminderCandidate = {
  memberId: string;
  phone: string;
  /** Clave de idempotencia junto al tipo: no se reenvía si ya hubo éxito. */
  referenceDate: string; // 'YYYY-MM-DD'
  previewText: string;
  template: TemplateMessage;
};

export type ReminderProcessor = {
  type: string;
  /** Etiqueta legible para el resumen del cron. */
  label: string;
  fetchCandidates: (supabase: SupabaseClient) => Promise<ReminderCandidate[]>;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function firstName(full: string): string {
  return (full ?? "").trim().split(/\s+/)[0] || full;
}

/** 'YYYY-MM-DD' de hoy en la zona del gimnasio (el server corre en UTC). */
function todayEc(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
  }).format(new Date());
}

/** '06:00:00' → '6:00 am' */
function formatTime(t: string): string {
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${ampm}`;
}

/** PostgREST devuelve relaciones to-one a veces como objeto, a veces array. */
function one<T>(x: T | T[] | null | undefined): T | null {
  if (Array.isArray(x)) return x[0] ?? null;
  return x ?? null;
}

// ── Procesadores ────────────────────────────────────────────────────────────

/** Aviso de vencimiento próximo (0..7 días). Reusa la lógica de expiry.ts. */
const expiryProcessor: ReminderProcessor = {
  type: REMINDER_TYPE_EXPIRY,
  label: "Vencimientos por avisar",
  async fetchCandidates(supabase) {
    const { data } = await supabase
      .from("vw_members_with_active_membership")
      .select(
        "id, full_name, phone, current_plan_name, current_end_date, days_until_expiry"
      )
      .eq("status", "active")
      .eq("membership_status", "active")
      .gte("days_until_expiry", 0)
      .lte("days_until_expiry", EXPIRY_REMINDER_DAYS);

    return (data ?? [])
      .filter(
        (r) => r.phone && r.current_end_date && r.days_until_expiry != null
      )
      .map((r) => {
        const c: ExpiryCandidate = {
          id: r.id,
          full_name: r.full_name,
          phone: r.phone,
          current_plan_name: r.current_plan_name,
          current_end_date: r.current_end_date,
          days_until_expiry: r.days_until_expiry,
        };
        return {
          memberId: r.id,
          phone: r.phone,
          referenceDate: r.current_end_date,
          previewText: buildExpiryMessage(c),
          template: buildExpiryTemplate(c),
        };
      });
  },
};

/** Membresía ya vencida (1-3 días atrás, sin renovar). */
const expiredProcessor: ReminderProcessor = {
  type: REMINDER_TYPE_EXPIRED,
  label: "Membresías vencidas",
  async fetchCandidates(supabase) {
    const { data } = await supabase
      .from("vw_recently_expired")
      .select("member_id, full_name, phone, plan_name, end_date");

    return (data ?? [])
      .filter((r) => r.phone && r.end_date)
      .map((r) => {
        const fn = firstName(r.full_name);
        const plan = r.plan_name ?? "actual";
        const fecha = formatSpanishDate(r.end_date);
        return {
          memberId: r.member_id,
          phone: r.phone,
          referenceDate: r.end_date,
          previewText:
            `Hola ${fn} 👋 Tu membresía *${plan}* en Iron Fit Club venció el ` +
            `*${fecha}*. Renueva cuando gustes para seguir entrenando 💪`,
          template: {
            templateName: TPL.expired,
            languageCode: LANG,
            bodyParams: [fn, plan, fecha],
          },
        };
      });
  },
};

/** Bienvenida a socios nuevos (registrados en las últimas ~48h). */
const welcomeProcessor: ReminderProcessor = {
  type: REMINDER_TYPE_WELCOME,
  label: "Bienvenidas",
  async fetchCandidates(supabase) {
    const since = new Date(Date.now() - 2 * 86400000).toISOString();
    const { data } = await supabase
      .from("vw_members_with_active_membership")
      .select(
        "id, full_name, phone, current_plan_name, current_end_date, created_at"
      )
      .eq("status", "active")
      .eq("membership_status", "active")
      .gte("created_at", since);

    return (data ?? [])
      .filter((r) => r.phone && r.created_at)
      .map((r) => {
        const fn = firstName(r.full_name);
        const plan = r.current_plan_name ?? "actual";
        const fecha = r.current_end_date
          ? formatSpanishDate(r.current_end_date)
          : "";
        return {
          memberId: r.id,
          phone: r.phone,
          referenceDate: String(r.created_at).slice(0, 10),
          previewText:
            `¡Bienvenido a Iron Fit Club, ${fn}! 🎉 Tu membresía *${plan}* ` +
            `quedó activa hasta el *${fecha}*.`,
          template: {
            templateName: TPL.welcome,
            languageCode: LANG,
            bodyParams: [fn, plan, fecha],
          },
        };
      });
  },
};

/** Reenganche de socios inactivos (14-30 días sin asistir), 1 vez cada 30 días. */
const winbackProcessor: ReminderProcessor = {
  type: REMINDER_TYPE_WINBACK,
  label: "Reactivaciones",
  async fetchCandidates(supabase) {
    const { data } = await supabase
      .from("vw_inactive_members")
      .select("member_id, full_name, phone, days_inactive");

    let rows = (data ?? []).filter((r) => r.phone && r.days_inactive != null);

    // Evita repetir el reenganche: silencia si ya se envió en los últimos 30 días.
    if (rows.length > 0) {
      const cutoff = new Date(Date.now() - 30 * 86400000)
        .toISOString()
        .slice(0, 10);
      const { data: recent } = await supabase
        .from("reminder_log")
        .select("member_id")
        .eq("reminder_type", REMINDER_TYPE_WINBACK)
        .neq("status", "failed")
        .gte("reference_date", cutoff)
        .in(
          "member_id",
          rows.map((r) => r.member_id)
        );
      const suppressed = new Set((recent ?? []).map((x) => x.member_id));
      rows = rows.filter((r) => !suppressed.has(r.member_id));
    }

    const ref = todayEc();
    return rows.map((r) => {
      const fn = firstName(r.full_name);
      const dias = String(r.days_inactive);
      return {
        memberId: r.member_id,
        phone: r.phone,
        referenceDate: ref,
        previewText:
          `Hola ${fn} 👋 ¡Te extrañamos en Iron Fit Club! Hace *${dias} días* ` +
          `que no te vemos. Vuelve cuando quieras y lo retomamos juntos 💪🔥`,
        template: {
          templateName: TPL.winback,
          languageCode: LANG,
          bodyParams: [fn, dias],
        },
      };
    });
  },
};

/** Felicitación de cumpleaños (una vez al año). */
const birthdayProcessor: ReminderProcessor = {
  type: REMINDER_TYPE_BIRTHDAY,
  label: "Cumpleaños",
  async fetchCandidates(supabase) {
    const { data } = await supabase
      .from("vw_birthdays_today")
      .select("member_id, full_name, phone");

    const ref = todayEc(); // cambia cada año → una felicitación por año
    return (data ?? [])
      .filter((r) => r.phone)
      .map((r) => {
        const fn = firstName(r.full_name);
        return {
          memberId: r.member_id,
          phone: r.phone,
          referenceDate: ref,
          previewText:
            `¡Feliz cumpleaños, ${fn}! 🎉🎂 Todo el equipo de Iron Fit Club ` +
            `te desea un día increíble.`,
          template: {
            templateName: TPL.birthday,
            languageCode: LANG,
            bodyParams: [fn],
          },
        };
      });
  },
};

type BookingRow = {
  member_id: string;
  start_time: string;
  class_schedules: { name: string } | { name: string }[] | null;
  members:
    | { full_name: string; phone: string }
    | { full_name: string; phone: string }[]
    | null;
};

/** Recordatorio de clase(s) reservada(s) para hoy. */
const classProcessor: ReminderProcessor = {
  type: REMINDER_TYPE_CLASS,
  label: "Recordatorios de clase",
  async fetchCandidates(supabase) {
    const today = todayEc();
    const { data } = await supabase
      .from("class_bookings")
      .select(
        "member_id, start_time, class_schedules(name), members(full_name, phone)"
      )
      .eq("booking_date", today)
      .eq("status", "confirmed")
      .order("start_time", { ascending: true });

    // Agrupa por socio: un solo mensaje que lista todas sus clases de hoy.
    const byMember = new Map<
      string,
      { name: string; phone: string; items: string[] }
    >();
    for (const r of (data ?? []) as unknown as BookingRow[]) {
      const mem = one(r.members);
      const sched = one(r.class_schedules);
      if (!mem?.phone || !sched?.name) continue;
      const entry =
        byMember.get(r.member_id) ??
        { name: mem.full_name, phone: mem.phone, items: [] };
      entry.items.push(`${sched.name} a las ${formatTime(r.start_time)}`);
      byMember.set(r.member_id, entry);
    }

    return [...byMember.entries()].map(([memberId, e]) => {
      const fn = firstName(e.name);
      const lista = e.items.join(" y ");
      return {
        memberId,
        phone: e.phone,
        referenceDate: today,
        previewText:
          `Hola ${fn} 👋 Hoy tienes reservada tu clase: ${lista}. ` +
          `¡Te esperamos en Iron Fit Club! 💪`,
        template: {
          templateName: TPL.classReminder,
          languageCode: LANG,
          bodyParams: [fn, lista],
        },
      };
    });
  },
};

/** Orden de ejecución del cron. */
export const reminderProcessors: ReminderProcessor[] = [
  expiryProcessor,
  expiredProcessor,
  welcomeProcessor,
  winbackProcessor,
  birthdayProcessor,
  classProcessor,
];
