// Dinero en dólares sin Intl (se ve igual en cualquier teléfono): $1,234.50
export function fmtMoney(n: number): string {
  const [int, dec] = Math.abs(n).toFixed(2).split('.');
  return `${n < 0 ? '-' : ''}$${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`;
}

export const PAYMENT_METHODS: Record<string, string> = {
  transfer: 'Transferencia',
  cash: 'Efectivo',
  card: 'Tarjeta',
  other: 'Otro',
};
