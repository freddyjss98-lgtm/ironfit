// =============================================================================
// WhatsApp helpers — phone normalization + message templates (Ecuador)
// =============================================================================

/** Build a wa.me link, normalizing Ecuadorian phone numbers to E.164 (593…). */
export function waLink(phone: string | null | undefined, message?: string): string {
  const clean = (phone ?? "").replace(/\D/g, "");
  const num = clean.startsWith("593")
    ? clean
    : clean.startsWith("0")
      ? `593${clean.slice(1)}`
      : `593${clean}`;
  return message
    ? `https://wa.me/${num}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${num}`;
}

const first = (name: string) => name.split(" ")[0];

export function expiryMessage(name: string, plan: string | null, endDate: string): string {
  return `Hola ${first(name)}! 👋 Tu membresía${plan ? ` *${plan}*` : ""} en Iron Fit Club vence el *${endDate}*. Te invitamos a renovar para seguir entrenando sin interrupción. 💪🔥`;
}

export function birthdayMessage(name: string): string {
  return `Hola ${first(name)}! 🎂 Todo el equipo de Iron Fit Club te desea un feliz cumpleaños. ¡Sigue entrenando fuerte! 💪🔥`;
}

export function winBackMessage(name: string): string {
  return `Hola ${first(name)}! 👋 Te extrañamos en Iron Fit Club. Notamos que llevas unos días sin venir — ¿todo bien? Tu progreso te espera, ¡vuelve cuando quieras! 💪🔥`;
}

export function noMembershipMessage(name: string): string {
  return `Hola ${first(name)}! 👋 Te echamos de menos en Iron Fit Club. ¿Listo para retomar el entrenamiento? Escríbenos y te ayudamos a elegir tu plan ideal. 💪🔥`;
}
