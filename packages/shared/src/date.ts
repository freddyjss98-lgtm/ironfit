// Fechas en hora de Ecuador (America/Guayaquil, UTC-5 sin horario de verano).
// El servidor corre en UTC, así que `new Date().toISOString()` da la fecha UTC,
// que adelanta el día a las 19:00 local. Estos helpers evitan ese desfase.

// Ecuador continental está en UTC-5 todo el año (el único horario de verano fue
// en 1992-93). Se resta el desfase fijo en vez de usar Intl con timeZone: así da
// lo mismo en Node (web) que en Hermes (app), sin depender del motor ni del
// formato de fecha del locale.
const ECUADOR_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Hoy en Ecuador como 'YYYY-MM-DD'. */
export function todayInEcuador(): string {
  return new Date(Date.now() - ECUADOR_OFFSET_MS).toISOString().slice(0, 10);
}

/** Suma (o resta) días a una fecha 'YYYY-MM-DD' y devuelve 'YYYY-MM-DD'. */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
