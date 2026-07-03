// Formato de moneda estándar del proyecto (es-EC, USD, 2 decimales).
// Único punto de verdad: antes había 6+ copias locales de este formateador.

const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtMoney(n: number): string {
  return money.format(n);
}
