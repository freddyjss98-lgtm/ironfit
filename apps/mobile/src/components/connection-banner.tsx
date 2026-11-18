import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import { sportLabel } from '@/features/sports/sports';
import { useAuth } from '@/lib/auth';
import { ecuadorDateOf, fmtShort } from '@/lib/dates';
import { checkConnection, useOnline } from '@/lib/offline/network';
import { flushOutbox, MAX_ATTEMPTS, removeItem, useOutbox, type OutboxItem } from '@/lib/offline/outbox';
import { colors, fonts, radius, space } from '@/theme';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function itemLabel(i: OutboxItem): string {
  const p = i.payload as { sport?: string; started_at?: string; date?: string };
  const day = fmtShort(p.date ?? (p.started_at ? ecuadorDateOf(p.started_at) : null));
  switch (i.kind) {
    case 'activity':
      return `${sportLabel(p.sport)} del ${day}`;
    case 'wod':
      return `WOD del ${day}`;
    case 'strength':
      return `Sesión de fuerza del ${day}`;
    case 'body':
      return `Medidas del ${day}`;
  }
}

/**
 * Franja arriba de cada pantalla: sin conexión (se ve lo último guardado) y
 * registros que esperan en la bandeja de salida. No ocupa nada si todo está al día.
 */
export function ConnectionBanner() {
  const online = useOnline();
  const { session } = useAuth();
  const all = useOutbox();
  const mine = all.filter((i) => i.userId === session?.user.id);
  const failed = mine.filter((i) => i.attempts >= MAX_ATTEMPTS);
  const waiting = mine.length - failed.length;

  // Sin sesión (login, registro) no hay datos guardados ni pendientes que mostrar.
  if (!session || (online && mine.length === 0)) return null;

  const text = failed.length
    ? `${plural(failed.length, 'registro no se pudo enviar', 'registros no se pudieron enviar')} · Toca para ver`
    : !online
      ? waiting
        ? `Sin conexión · ${plural(waiting, 'registro se enviará', 'registros se enviarán')} cuando vuelva la señal`
        : 'Sin conexión · estás viendo lo último que se cargó'
      : `Enviando ${plural(waiting, 'registro', 'registros')}…`;

  function details() {
    if (!mine.length) {
      checkConnection();
      return;
    }
    const lines = mine.map((i) => `• ${itemLabel(i)}${i.error ? `\n   ${i.error}` : ''}`).join('\n');
    Alert.alert('Pendientes de enviar', lines, [
      { text: 'Cerrar', style: 'cancel' },
      ...(failed.length
        ? [
            {
              text: 'Descartar los que fallaron',
              style: 'destructive' as const,
              onPress: () =>
                Alert.alert('Descartar', 'Se borran del teléfono los registros que no se pudieron enviar.', [
                  { text: 'No', style: 'cancel' },
                  { text: 'Descartar', style: 'destructive', onPress: () => failed.forEach((i) => void removeItem(i.id)) },
                ]),
            },
          ]
        : []),
      {
        text: 'Reintentar',
        onPress: () => {
          checkConnection();
          void flushOutbox({ includeFailed: true });
        },
      },
    ]);
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={details}
      style={[styles.box, failed.length ? styles.error : styles.info]}>
      <Text style={[styles.text, failed.length ? styles.errorText : null]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.sm + 2, paddingHorizontal: space.lg, paddingVertical: space.sm + 2 },
  info: { backgroundColor: colors.surface, borderColor: colors.line2 },
  error: { backgroundColor: colors.dangerBg, borderColor: 'rgba(239,68,68,0.3)' },
  text: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.fgDim },
  errorText: { color: colors.danger },
});
