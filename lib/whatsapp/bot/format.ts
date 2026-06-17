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
  | "book"
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
  if (/^(4|reservar|reserva|agendar|apartar|booking)\b/.test(t)) return "book";
  if (/^(5|asesor|humano|persona|recepcion|hablar|ayuda)\b/.test(t))
    return "handoff";
  if (/^(bot|reanudar|volver al bot)\b/.test(t)) return "resume";
  if (/^(menu|inicio|hola|buenas|buenos dias|0|\?|hi|hey)\b/.test(t))
    return "menu";

  return "unknown";
}

// ── Textos y formateadores ─────────────────────────────────────────────────────

/**
 * Pie de navegación que se agrega a las respuestas de datos para que la
 * conversación no "muera": recuerda las opciones sin reimprimir todo el menú.
 */
export function navFooter(): string {
  return (
    "\n\n— — — — —\n" +
    "¿Algo más? 👉 *1* Membresía · *2* Clases · *3* Rutina · *4* Reservar · *5* Asesor\n" +
    "(o escribe *menú*)"
  );
}

export function menuText(): string {
  return (
    "🏋️ *Iron Fit Club* — ¿En qué te ayudo?\n\n" +
    "Responde con un número:\n" +
    "1️⃣  Mi membresía (estado y vencimiento)\n" +
    "2️⃣  Clases de hoy\n" +
    "3️⃣  Rutina del día (WOD)\n" +
    "4️⃣  Reservar una clase\n" +
    "5️⃣  Hablar con un asesor\n\n" +
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
    `Hola ${firstName} 🙌 Para hablar directamente con un asesor de ` +
    `*Iron Fit Club*, escríbenos o llámanos al:\n\n` +
    `📱 *+593 959 888 060*\n\n` +
    `¡Te atendemos con gusto! 💪`
  );
}

// ── Reservar clase (flujo de 2 pasos) ───────────────────────────────────────────

/** Opción de clase ofrecida para reservar (snapshot guardado en la conversación). */
export type BookingOption = {
  n: number;
  schedule_id: string;
  name: string;
  start_time: string; // "06:00:00"
  end_time: string;
  max_capacity: number;
};

export function noClassesToBookText(dayLabel: string): string {
  const dia = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
  return `📅 Hoy (${dia}) no hay clases disponibles para reservar 😌`;
}

export function bookingPromptText(
  options: BookingOption[],
  dayLabel: string
): string {
  const dia = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
  const lines = options
    .map((o) => `*${o.n})* ${formatTime(o.start_time)}  ${o.name}`)
    .join("\n");
  return (
    `📅 *Reservar clase — ${dia}*\n\n` +
    `Responde con el *número* de la clase que quieres reservar:\n${lines}\n\n` +
    `(o escribe *menú* para cancelar)`
  );
}

export function bookingInvalidText(): string {
  return (
    "No reconocí ese número 🤔. Responde con el *número* de una clase de la " +
    "lista, o escribe *menú* para cancelar."
  );
}

export function bookingConfirmedText(o: BookingOption): string {
  return (
    `✅ ¡Listo! Reservaste *${o.name}* hoy a las *${formatTime(o.start_time)}*. ` +
    `¡Te esperamos! 💪🔥`
  );
}

export function bookingAlreadyText(o: BookingOption): string {
  return `Ya tenías reservada *${o.name}* a las *${formatTime(o.start_time)}* para hoy ✅`;
}

export function bookingFullText(o: BookingOption): string {
  return (
    `😕 La clase *${o.name}* de las *${formatTime(o.start_time)}* ya llegó a su ` +
    `cupo máximo. Elige otra de la lista o escribe *menú*.`
  );
}

export function bookingCancelledText(): string {
  return "Reserva cancelada 👍\n\n" + menuText();
}
