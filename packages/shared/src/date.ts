// Fechas en hora de Ecuador (America/Guayaquil, UTC-5 sin horario de verano).
// El servidor corre en UTC, así que `new Date().toISOString()` da la fecha UTC,
// que adelanta el día a las 19:00 local. Estos helpers evitan ese desfase.

/** Hoy en Ecuador como 'YYYY-MM-DD'. */
export function todayInEcuador(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date());
}

/** Suma (o resta) días a una fecha 'YYYY-MM-DD' y devuelve 'YYYY-MM-DD'. */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
