// Sub-pestaña "Deportes": totales de la semana y del mes, y el historial de
// actividades fuera del box.

import { addDays, todayInEcuador } from '@ironfit/shared/date';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, SectionLabel } from '@/components/card';
import { Locked } from '@/features/training/locked';
import { ecuadorDateOf, fmtShort } from '@/lib/dates';
import { colors, fonts, space } from '@/theme';

import { fmtDistance, fmtDuration, fmtPace, sportEmoji, sportLabel } from './sports';
import { useActivities, useDeleteActivity, type Activity } from './use-activities';

function totals(rows: Activity[]) {
  return rows.reduce(
    (t, a) => ({
      count: t.count + 1,
      meters: t.meters + (a.sport === 'swim' ? 0 : (a.distance_m ?? 0)),
      seconds: t.seconds + a.duration_seconds,
      kcal: t.kcal + (a.calories ?? 0),
    }),
    { count: 0, meters: 0, seconds: 0, kcal: 0 }
  );
}

function Totals({ label, rows }: { label: string; rows: Activity[] }) {
  const t = totals(rows);
  return (
    <Card style={styles.totals}>
      <SectionLabel right={`${t.count} ${t.count === 1 ? 'actividad' : 'actividades'}`}>{label}</SectionLabel>
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.value}>{t.meters ? (t.meters / 1000).toFixed(1) : '0'}</Text>
          <Text style={styles.unit}>km</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.value}>{t.seconds >= 3600 ? (t.seconds / 3600).toFixed(1) : Math.round(t.seconds / 60)}</Text>
          <Text style={styles.unit}>{t.seconds >= 3600 ? 'horas' : 'min'}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.value}>{t.kcal}</Text>
          <Text style={styles.unit}>kcal</Text>
        </View>
      </View>
    </Card>
  );
}

export function SportsTab({ memberId, active }: { memberId: string; active: boolean }) {
  const router = useRouter();
  const activities = useActivities(memberId);
  const del = useDeleteActivity(memberId);

  if (activities.isPending) return <ActivityIndicator color={colors.accent} />;
  if (activities.isError) return <Text style={styles.dim}>No se pudieron cargar tus actividades.</Text>;
  const rows = activities.data;

  // Semana de lunes a domingo y mes calendario, en hora de Ecuador.
  const today = todayInEcuador();
  const dow = (new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const weekStart = addDays(today, -dow);
  const monthStart = today.slice(0, 8) + '01';
  const day = (a: Activity) => ecuadorDateOf(a.started_at);

  function remove(a: Activity) {
    Alert.alert('Borrar actividad', `¿Borrar ${sportLabel(a.sport).toLowerCase()} del ${fmtShort(day(a))}? También se quita de la comunidad.`, [
      { text: 'No', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => del.mutate(a.id, { onError: (e) => Alert.alert('No se pudo borrar', e.message) }) },
    ]);
  }

  return (
    <>
      {active ? (
        <Button label="Registrar actividad" onPress={() => router.push('/deportes/registrar')} />
      ) : (
        <Locked what="Registrar actividades" />
      )}

      <Totals label="Esta semana" rows={rows.filter((a) => day(a) >= weekStart)} />
      <Totals label="Este mes" rows={rows.filter((a) => day(a) >= monthStart)} />

      {rows.length === 0 ? (
        <Text style={styles.dim}>
          Corre, pedalea, nada o sube una montaña y regístralo aquí: suma para los retos del gimnasio.
        </Text>
      ) : (
        <Card style={styles.list}>
          {rows.map((a, i) => (
            <Pressable
              key={a.id}
              onLongPress={() => remove(a)}
              accessibilityHint="Mantén presionado para borrar"
              style={[styles.row, i > 0 && styles.rowBorder]}>
              <Text style={styles.emoji}>{sportEmoji(a.sport)}</Text>
              <View style={styles.flex}>
                <Text style={styles.name}>
                  {sportLabel(a.sport)} · {fmtShort(day(a))}
                </Text>
                <Text style={styles.small}>
                  {[
                    fmtDuration(a.duration_seconds),
                    fmtPace(a.sport, a.duration_seconds, a.distance_m),
                    a.calories ? `${a.calories} kcal${a.calories_estimated ? ' (est.)' : ''}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Text style={styles.dist}>{fmtDistance(a.distance_m, a.sport) ?? ''}</Text>
            </Pressable>
          ))}
        </Card>
      )}
      {rows.length > 0 && <Text style={styles.hint}>Mantén presionada una actividad para borrarla.</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.fgDim },
  totals: { gap: space.md },
  metrics: { flexDirection: 'row' },
  metric: { flex: 1, alignItems: 'center' },
  value: { fontFamily: fonts.display, fontSize: 26, color: colors.fg },
  unit: { fontFamily: fonts.condSemi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.fgMute },
  list: { padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(36,36,36,0.6)' },
  emoji: { fontSize: 22 },
  name: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.fg },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute },
  dist: { fontFamily: fonts.display, fontSize: 18, color: colors.accent },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute, textAlign: 'center' },
});
