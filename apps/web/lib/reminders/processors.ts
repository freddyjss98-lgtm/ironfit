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
  planLabel,
  type ExpiryCandidate,
} from "@/lib/reminders/expiry";

export const REMINDER_TYPE_EXPIRED = "membership_expired";
export const REMINDER_TYPE_WELCOME = "member_welcome";
export const REMINDER_TYPE_WINBACK = "member_winback";
export const REMINDER_TYPE_BIRTHDAY = "member_birthday";
export const REMINDER_TYPE_ACTIVATED = "membership_activated";
export const REMINDER_TYPE_ADMIN_COPY = "admin_copy";

const LANG = process.env.WHATSAPP_TEMPLATE_LANG ?? "es";
const TPL = {
  expired: process.env.WHATSAPP_TEMPLATE_EXPIRED ?? "membership_expired",
  welcome: process.env.WHATSAPP_TEMPLATE_WELCOME ?? "member_welcome",
  // OJO: la plantilla en Meta quedó con guión bajo final (membership_activated_).
  activated: process.env.WHATSAPP_TEMPLATE_ACTIVATED ?? "membership_activated_",
  winback: process.env.WHATSAPP_TEMPLATE_WINBACK ?? "member_winback",
  birthday: process.env.WHATSAPP_TEMPLATE_BIRTHDAY ?? "member_birthday",
};

// Copia al admin: cada aviso enviado a un socio se replica al WhatsApp del gym.
export const ADMIN_PHONE = process.env.ADMIN_WHATSAPP ?? "593959888060";
export const ADMIN_COPY_TEMPLATE =
  process.env.WHATSAPP_TEMPLATE_ADMIN_COPY ?? "admin_copy";

/** Un candidato listo para enviar: ya trae el texto y la plantilla armados. */
export type ReminderCandidate = {
  memberId: string;
  /** Nombre completo del socio (para la copia al admin). */
  memberName?: string;
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

/**
 * Arma la plantilla de copia para el admin a partir de un aviso ya enviado:
 * {{1}} = a quién se envió (nombre · teléfono), {{2}} = el mensaje original.
 */
export function buildAdminCopyTemplate(c: ReminderCandidate): TemplateMessage {
  const quien = c.memberName ? `${c.memberName} · ${c.phone}` : c.phone;
  return {
    templateName: ADMIN_COPY_TEMPLATE,
    languageCode: LANG,
    bodyParams: [quien, c.previewText],
  };
}

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
          memberName: r.full_name,
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
        const plan = planLabel(r.plan_name);
        const fecha = formatSpanishDate(r.end_date);
        return {
          memberId: r.member_id,
          memberName: r.full_name,
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

/**
 * Bienvenida a TODO socio nuevo (registrado en las últimas ~48h) que aún NO
 * tiene membresía activa: lo invita a adquirirla. A quien se registra y activa
 * membresía de una lo cubre membership_activated (para no decirle "compra" a
 * quien ya compró).
 */
const welcomeProcessor: ReminderProcessor = {
  type: REMINDER_TYPE_WELCOME,
  label: "Bienvenidas",
  async fetchCandidates(supabase) {
    const since = new Date(Date.now() - 2 * 86400000).toISOString();
    const { data: news } = await supabase
      .from("members")
      .select("id, full_name, phone, created_at")
      .eq("status", "active")
      .is("deleted_at", null)
      .gte("created_at", since);

    const rows = (news ?? []).filter((r) => r.phone);
    if (rows.length === 0) return [];

    // Excluir a quienes ya tienen membresía activa (esos reciben la de activación).
    const today = todayEc();
    const { data: active } = await supabase
      .from("memberships")
      .select("member_id")
      .in(
        "member_id",
        rows.map((r) => r.id)
      )
      .eq("status", "active")
      .gte("end_date", today);
    const withMembership = new Set((active ?? []).map((a) => a.member_id));

    return rows
      .filter((r) => !withMembership.has(r.id))
      .map((r) => {
        const fn = firstName(r.full_name);
        return {
          memberId: r.id,
          memberName: r.full_name,
          phone: r.phone,
          referenceDate: String(r.created_at).slice(0, 10),
          previewText:
            `¡Bienvenido a Iron Fit Club, ${fn}! 🎉 Adquiere tu membresía en ` +
            `nuestro portal para empezar a entrenar 💪 Escribe *menú* si necesitas ayuda.`,
          template: {
            templateName: TPL.welcome,
            languageCode: LANG,
            bodyParams: [fn],
          },
        };
      });
  },
};

type MembershipRow = {
  member_id: string;
  end_date: string;
  created_at: string;
  members:
    | { full_name: string; phone: string }
    | { full_name: string; phone: string }[]
    | null;
  membership_plans: { name: string } | { name: string }[] | null;
};

/** Confirmación al activar una membresía (alta o renovación, últimas ~48h). */
const activatedProcessor: ReminderProcessor = {
  type: REMINDER_TYPE_ACTIVATED,
  label: "Membresías activadas",
  async fetchCandidates(supabase) {
    const since = new Date(Date.now() - 2 * 86400000).toISOString();
    const { data } = await supabase
      .from("memberships")
      .select(
        "member_id, end_date, created_at, members(full_name, phone), membership_plans(name)"
      )
      .eq("status", "active")
      .gte("created_at", since);

    const out: ReminderCandidate[] = [];
    for (const r of (data ?? []) as unknown as MembershipRow[]) {
      const mem = one(r.members);
      const plan = one(r.membership_plans);
      if (!mem?.phone || !r.end_date) continue;
      const fn = firstName(mem.full_name);
      const planName = planLabel(plan?.name);
      const fecha = formatSpanishDate(r.end_date);
      out.push({
        memberId: r.member_id,
        memberName: mem.full_name,
        phone: mem.phone,
        // Llave por end_date (igual que el aviso instantáneo) → no se duplican.
        referenceDate: r.end_date,
        previewText:
          `¡Gracias por tu membresía, ${fn}! 🎉 Tu plan *${planName}* en Iron ` +
          `Fit Club quedó activo hasta el *${fecha}*. ¡A entrenar con todo! 💪🔥`,
        template: {
          templateName: TPL.activated,
          languageCode: LANG,
          bodyParams: [fn, planName, fecha],
        },
      });
    }
    return out;
  },
};

/**
 * Reenganche: socios SIN membresía activa cuya última membresía venció hace
 * ~15 días (sin renovar). NO usa asistencia (no todos la marcan), así los
 * socios activos nunca lo reciben. Una sola vez por vencimiento (llave end_date).
 */
const winbackProcessor: ReminderProcessor = {
  type: REMINDER_TYPE_WINBACK,
  label: "Reactivaciones",
  async fetchCandidates(supabase) {
    const { data } = await supabase
      .from("vw_lapsed_members")
      .select("member_id, full_name, phone, end_date, days_since_expiry");

    return (data ?? [])
      .filter((r) => r.phone && r.days_since_expiry != null)
      .map((r) => {
        const fn = firstName(r.full_name);
        const dias = String(r.days_since_expiry);
        return {
          memberId: r.member_id,
          memberName: r.full_name,
          phone: r.phone,
          referenceDate: r.end_date, // idempotencia: 1 reenganche por vencimiento
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
          memberName: r.full_name,
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

/** Orden de ejecución del cron. */
export const reminderProcessors: ReminderProcessor[] = [
  expiryProcessor,
  expiredProcessor,
  welcomeProcessor,
  activatedProcessor,
  winbackProcessor,
  birthdayProcessor,
];
