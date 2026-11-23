// Iron Fit Online: la membresía digital de la app. Precios de referencia para
// los textos; al cobrar (Bloque 2) se muestran los que devuelve la tienda,
// que ya vienen en la moneda y con los impuestos del usuario.

import type { AppSubscription } from '@/features/training/use-active';
import { ecuadorDateOf, fmtShort } from '@/lib/dates';

export const ONLINE_NAME = 'Iron Fit Online';
export const TRIAL_DAYS = 7;
export const PLANS = [
  { id: 'monthly', label: 'Mensual', price: '$2,99', per: 'al mes', note: null },
  { id: 'annual', label: 'Anual', price: '$24,99', per: 'al año', note: 'Ahorra 30 %' },
] as const;

export const INCLUDED = [
  { icon: '🏋️', text: 'El WOD de cada día que programa Iron Fit' },
  { icon: '📈', text: 'Tu registro del WOD y la pizarra del box' },
  { icon: '🏆', text: 'Récords, porcentajes de carga y registro de fuerza' },
  { icon: '📍', text: 'Graba tus carreras y salidas con GPS' },
  { icon: '🔥', text: 'Retos del gimnasio y la comunidad' },
  { icon: '📏', text: 'Tus medidas, tu peso y tu meta' },
] as const;

/** Una línea sobre el estado de la suscripción, o null si no tiene. */
export function subscriptionLine(s: AppSubscription | null): string | null {
  if (!s?.active || !s.expires_at) return null;
  const day = fmtShort(ecuadorDateOf(s.expires_at));
  if (s.status === 'billing_issue') return 'Hay un problema con tu pago: revísalo en la tienda para no perder el acceso.';
  if (s.status === 'trial' || s.period_type === 'trial') return `Prueba gratis hasta el ${day}`;
  if (!s.will_renew || s.status === 'cancelled') return `Activa hasta el ${day} · no se renovará`;
  return `Activa · se renueva el ${day}`;
}
