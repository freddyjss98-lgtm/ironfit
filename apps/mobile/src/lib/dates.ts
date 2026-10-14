// Formato de fechas en español para la app, sin Intl: así se ve igual en
// cualquier teléfono. Las fechas de la base llegan como 'YYYY-MM-DD'.

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const ECUADOR_OFFSET_MS = 5 * 60 * 60 * 1000;

function parts(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, dow };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** '2026-10-12' → '12 oct' */
export function fmtShort(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const { m, d } = parts(ymd);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

/** '2026-10-12' → 'Lunes 12 de octubre' */
export function fmtWeekdayLong(ymd: string): string {
  const { m, d, dow } = parts(ymd);
  return `${cap(WEEKDAYS[dow])} ${d} de ${MONTHS[m - 1]}`;
}

/** Hora actual en Ecuador (0-23). */
export function ecuadorHour(): number {
  return new Date(Date.now() - ECUADOR_OFFSET_MS).getUTCHours();
}

export function greeting(): string {
  const h = ecuadorHour();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** ¿Hoy (Ecuador) es el cumpleaños de esta fecha de nacimiento? */
export function isBirthdayToday(birthday: string, todayYmd: string): boolean {
  return birthday.slice(5) === todayYmd.slice(5);
}
