// =============================================================================
// Bot de WhatsApp — lógica pura (sin I/O)
// =============================================================================
// Parseo de intención del socio y formateo de las respuestas. Todo aquí es
// determinista y testeable; las consultas a la base viven en handle.ts.
// =============================================================================

import { formatSpanishDate } from "@/lib/reminders/expiry";

const TZ = "America/Guayaquil"; // Ecuador, UTC-5 sin horario de verano

const DOW_ES = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
];

/** Fecha "de hoy" en la zona del gimnasio (el server corre en UTC). */
export function ecuadorToday(): { dow: number; ymd: string; dayLabel: string } {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // "2026-06-16"

  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  // day_of_week para esa fecha-calendario (0=Dom … 6=Sáb), igual que la DB.
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  return { dow, ymd, dayLabel: DOW_ES[dow] };
}

// ── Intención ────────────────────────────────────────────────────────────────

export type Intent =
  | "membership"
  | "classes"
  | "wod"
  | "handoff"
  | "menu"
  | "resume"
  | "unknown";

function strip(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos (diacríticos combinados)
    .toLowerCase()
    .trim();
}

/** Mapea el texto entrante del socio a una intención del menú. */
export function parseIntent(raw: string): Intent {
  const t = strip(raw);

  if (/^(1|membresia|mi membresia|vencimiento|vence|plan)\b/.test(t))
    return "membership";
  if (/^(2|clases?|horarios?)\b/.test(t)) return "classes";
  if (/^(3|rutina|wod|entreno|entrenamiento|workout)\b/.test(t)) return "wod";
  if (/^(4|asesor|humano|persona|recepcion|hablar|ayuda)\b/.test(t))
    return "handoff";
  if (/^(bot|reanudar|volver al bot|salir)\b/.test(t)) return "resume";
  if (/^(menu|inicio|hola|buenas|buenos dias|0|\?|hi|hey)\b/.test(t))
    return "menu";

  return "unknown";
}

// ── Textos y formateadores ─────────────────────────────────────────────────────

export function menuText(): string {
  return (
    "🏋️ *Iron Fit Club* — ¿En qué te ayudo?\n\n" +
    "Responde con un número:\n" +
    "1️⃣  Mi membresía (estado y vencimiento)\n" +
    "2️⃣  Clases de hoy\n" +
    "3️⃣  Rutina del día (WOD)\n" +
    "4️⃣  Hablar con un asesor\n\n" +
    "Escribe *menú* en cualquier momento para volver aquí. 💪"
  );
}

export function unknownText(): string {
  return "No entendí eso 🤔\n\n" + menuText();
}

/** Bienvenida cuando el número no corresponde a ningún socio registrado. */
export function notAMemberText(): string {
  return (
    "¡Hola! 👋 Soy el asistente de *Iron Fit Club*.\n\n" +
    "No encuentro tu número en nuestros registros de socios. Si ya eres " +
    "socio, avísanos para vincular tu WhatsApp. Si quieres información para " +
    "inscribirte, escribe *asesor* y con gusto te atendemos. 💪"
  );
}

export type MembershipInfo = {
  firstName: string;
  planName: string | null;
  endDate: string | null; // 'YYYY-MM-DD'
  daysUntilExpiry: number | null;
  membershipStatus: string; // 'active' | 'expired' | 'no_membership'
};

export function formatMembership(m: MembershipInfo): string {
  const plan = m.planName ? `*${m.planName}*` : "tu plan";

  if (m.membershipStatus === "no_membership" || !m.endDate) {
    return (
      `Hola ${m.firstName} 👋 No tengo una membresía activa registrada a tu ` +
      `nombre. Acércate a recepción o escribe *asesor* para renovar. 💪`
    );
  }

  const fecha = formatSpanishDate(m.endDate);

  if (m.membershipStatus === "expired" || (m.daysUntilExpiry ?? 0) < 0) {
    return (
      `Hola ${m.firstName} 👋 Tu membresía ${plan} *venció* el ${fecha}. ` +
      `Renuévala para seguir entrenando — escribe *asesor* y te ayudamos. 🔥`
    );
  }

  const dias = m.daysUntilExpiry ?? 0;
  const cuando =
    dias === 0
      ? "*hoy*"
      : dias === 1
        ? "*mañana*"
        : `en *${dias} días*`;

  return (
    `Hola ${m.firstName} 👋 Tu membresía ${plan} está *activa* y vence ` +
    `${cuando} (${fecha}). ¡A darle con todo! 💪🔥`
  );
}

/** "06:00:00" → "6:00 am" */
function formatTime(t: string): string {
  const [hhStr, mm] = t.split(":");
  const hh = parseInt(hhStr, 10);
  const ampm = hh < 12 ? "am" : "pm";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${mm} ${ampm}`;
}

export type ClassRow = { name: string; start_time: string; end_time: string };

export function formatClasses(classes: ClassRow[], dayLabel: string): string {
  const dia = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);

  if (classes.length === 0) {
    return `📅 *Clases de hoy (${dia})*\n\nNo hay clases programadas para hoy 😌`;
  }

  const lines = classes
    .map(
      (c) =>
        `• ${formatTime(c.start_time)}–${formatTime(c.end_time)}  ${c.name}`
    )
    .join("\n");

  return `📅 *Clases de hoy (${dia})*\n\n${lines}`;
}

export type WodRow = {
  warmup: string | null;
  strength: string | null;
  wod: string | null;
  accessories: string | null;
};

export function formatWod(w: WodRow | null, dayLabel: string): string {
  const dia = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);

  if (!w || (!w.warmup && !w.strength && !w.wod && !w.accessories)) {
    return `🔥 *Rutina de hoy (${dia})*\n\nAún no hay rutina publicada para hoy. ¡Pregunta a tu coach! 💪`;
  }

  const sections: string[] = [];
  if (w.warmup) sections.push(`*Calentamiento*\n${w.warmup}`);
  if (w.strength) sections.push(`*Fuerza*\n${w.strength}`);
  if (w.wod) sections.push(`*WOD*\n${w.wod}`);
  if (w.accessories) sections.push(`*Accesorios*\n${w.accessories}`);

  return `🔥 *Rutina de hoy (${dia})*\n\n${sections.join("\n\n")}`;
}

export function handoffText(firstName: string): string {
  return (
    `Listo ${firstName} 🙌 Un asesor de *Iron Fit Club* continuará la ` +
    `conversación por aquí lo antes posible (horario de atención).\n\n` +
    `Cuando quieras volver al asistente automático, escribe *bot*.`
  );
}

export function resumeText(): string {
  return "Volviste al asistente automático 🤖\n\n" + menuText();
}
