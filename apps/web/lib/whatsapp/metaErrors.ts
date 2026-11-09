// =============================================================================
// Códigos de error de Meta, en cristiano
// =============================================================================
// El log guarda el código crudo que devuelve la Cloud API. Un "131042" no le
// dice nada a quien atiende el gimnasio, y ese fue justo el problema del 1 al 3
// de septiembre de 2026: el error existía, nadie podía leerlo.
//
// Cada entrada dice QUÉ pasó y QUÉ hacer, porque un error sin salida es igual
// de inútil que ninguno.
// =============================================================================

export type MetaError = {
  /** Qué pasó, en una línea. */
  que: string;
  /** Qué hacer al respecto. */
  accion: string;
};

const ERRORES: Record<number, MetaError> = {
  131042: {
    que: "Problema de facturación en la cuenta de Meta",
    accion:
      "Revisa el método de pago de la cuenta de WhatsApp Business. Mientras esté caído, Meta acepta los mensajes pero no los entrega.",
  },
  131026: {
    que: "El número no puede recibir el mensaje",
    accion: "Suele ser que no tiene WhatsApp o está mal escrito. Verifica el número del socio.",
  },
  130472: {
    que: "Meta no entregó este mensaje de marketing a este número",
    accion: "El número cayó en un experimento de Meta. No depende del gimnasio y no se reintenta.",
  },
  132001: {
    que: "La plantilla no existe con ese nombre o idioma",
    accion: "Compara el nombre exacto en WhatsApp Manager con el que usa el sistema.",
  },
  132000: {
    que: "La plantilla esperaba otra cantidad de datos",
    accion: "Alguien editó la plantilla en Meta y cambió sus variables. Hay que ajustar el código.",
  },
  132005: {
    que: "El texto quedó más largo de lo que permite la plantilla",
    accion: "Normalmente un nombre o un plan demasiado largo. Acorta el dato.",
  },
  131047: {
    que: "Pasaron más de 24 horas desde el último mensaje del socio",
    accion: "Fuera de esa ventana solo se puede escribir con plantilla. Es normal en los avisos automáticos.",
  },
  131049: {
    que: "Meta decidió no entregarlo para cuidar la experiencia del usuario",
    accion: "Pasa con mensajes de marketing muy seguidos. Espacia los envíos a ese socio.",
  },
  131031: {
    que: "La cuenta está bloqueada",
    accion: "Revisa el estado de la cuenta en WhatsApp Manager: suele ser una violación de políticas.",
  },
  131048: {
    que: "Se alcanzó el límite por calidad del número",
    accion: "Demasiados bloqueos o reportes de socios. Revisa la calidad del número en Meta.",
  },
  130429: {
    que: "Demasiados mensajes en poco tiempo",
    accion: "Meta limitó el ritmo. El cron lo reintenta en la siguiente corrida.",
  },
  133010: {
    que: "El número del gimnasio no está registrado en la API",
    accion: "Hay que volver a registrarlo en WhatsApp Manager.",
  },
};

/**
 * Fallos posteriores a la aceptación de Meta que se resuelven solos o arreglando
 * la cuenta. Cualquier otro código apunta al destinatario y repetirlo no cambia nada.
 */
const REINTENTABLES = new Set([
  131042, // método de pago caído
  131031, // cuenta bloqueada
  131048, // límite por calidad
  130429, // demasiados mensajes
  133010, // número no registrado
  131000, // error interno de Meta
  131016, // servicio no disponible
  133004, // servidor no disponible
]);

/**
 * ¿Este fallo ya es definitivo para el cron?
 *
 * Meta responde 200 al enviar y avisa del rechazo después, por webhook. Como la
 * copia al admin sale en ese 200, reintentar a un número que no puede recibir
 * le mandaba al admin una copia diaria de un mensaje que el socio nunca recibió.
 * Si Meta ni siquiera lo aceptó (sin wamid) no salió nada y sí se reintenta.
 */
export function esFalloDefinitivo(fila: {
  provider_message_id: string | null;
  error_code: number | null;
}): boolean {
  if (!fila.provider_message_id) return false;
  return fila.error_code == null || !REINTENTABLES.has(fila.error_code);
}

/**
 * Traduce el error de una fila del log. `code` puede venir null en los fallos
 * viejos (antes de que el webhook registrara los estados) — ahí se devuelve el
 * texto crudo, que es lo único que hay.
 */
export function explicarError(
  code: number | null | undefined,
  textoCrudo: string | null | undefined
): MetaError | null {
  if (code != null && ERRORES[code]) return ERRORES[code];
  if (!textoCrudo) return null;

  // Los fallos anteriores al webhook guardaban el mensaje de Meta con el código
  // entre paréntesis, ej. "(#132001) Template name does not exist...".
  const m = textoCrudo.match(/\(#(\d+)\)/);
  if (m) {
    const encontrado = ERRORES[parseInt(m[1], 10)];
    if (encontrado) return encontrado;
  }

  return { que: textoCrudo, accion: "" };
}
