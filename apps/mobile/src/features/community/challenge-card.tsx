// Tarjeta de un reto del gimnasio: meta, fechas, cuántos lo cumplieron y el
// botón "Reto cumplido".

import { addDays, todayInEcuador } from '@ironfit/shared/date';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { fmtShort } from '@/lib/dates';
import { fmtDistance, fmtDuration, sportEmoji, sportLabel } from '@/features/sports/sports';
import { colors, fonts, space } from '@/theme';

import { useUndoChallenge, type Challenge } from './use-community';

export function goalText(c: Pick<Challenge, 'sport' | 'goal_type' | 'goal_distance_m' | 'goal_seconds'>): string {
  const sport = c.sport === 'any' ? 'Cualquier deporte' : sportLabel(c.sport);
  if (c.goal_type === 'distance') return `${sport} · ${fmtDistance(c.goal_distance_m, c.sport)}`;
  if (c.goal_type === 'time') return `${sport} · ${fmtDuration(c.goal_seconds ?? 0)}`;
  return sport;
}

function dateRange(a: string, b: string): string {
  return a === b ? fmtShort(a) : `${fmtShort(a)} – ${fmtShort(b)}`;
}

export function ChallengeCard({ challenge: c }: { challenge: Challenge }) {
  const router = useRouter();
  const undo = useUndoChallenge();
  const today = todayInEcuador();
  const upcoming = today < c.starts_on;
  // Un día de gracia después del cierre, igual que en la base.
  const closed = today > addDays(c.ends_on, 1);
  const status = upcoming ? 'Próximo' : today > c.ends_on ? 'Terminado' : 'En curso';

  function confirmUndo() {
    Alert.alert('Deshacer reto', 'Se quita la marca de cumplido y su publicación en la comunidad.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Deshacer',
        style: 'destructive',
        onPress: () =>
          undo.mutate(c.my_entry_id!, { onError: (e) => Alert.alert('No se pudo deshacer', e.message) }),
      },
    ]);
  }

  return (
    <Card style={[styles.card, c.my_entry_id ? styles.done : {}]}>
      <View style={styles.top}>
        <Text style={[styles.status, status === 'En curso' && styles.live]}>{status}</Text>
        <Text style={styles.dates}>{dateRange(c.starts_on, c.ends_on)}</Text>
      </View>
      <Text style={styles.title}>
        {c.sport === 'any' ? '🏆' : sportEmoji(c.sport)} {c.title}
      </Text>
      <Text style={styles.goal}>{goalText(c)}</Text>
      {c.description ? <Text style={styles.desc}>{c.description}</Text> : null}
      <Text style={styles.count}>
        {c.completed_count === 0
          ? 'Nadie lo ha cumplido todavía'
          : `${c.completed_count} ${c.completed_count === 1 ? 'socio lo cumplió' : 'socios lo cumplieron'}`}
      </Text>

      {c.my_entry_id ? (
        <Button label="✓ Cumplido" variant="secondary" onPress={confirmUndo} loading={undo.isPending} disabled={closed} />
      ) : upcoming ? (
        <Text style={styles.soon}>Empieza el {fmtShort(c.starts_on)}</Text>
      ) : !closed ? (
        <Button label="Reto cumplido" onPress={() => router.push({ pathname: '/reto/[id]', params: { id: c.id } })} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  done: { borderColor: 'rgba(74,222,128,0.35)' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { fontFamily: fonts.condSemi, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: colors.fgMute },
  live: { color: colors.accent },
  dates: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.fg, textTransform: 'uppercase' },
  goal: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.accent },
  desc: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.fgDim },
  count: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute, marginBottom: space.xs },
  soon: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.fgDim },
});
