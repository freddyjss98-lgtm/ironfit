// Sub-pestaña "Fuerza": rutinas, historial por ejercicio con récords y 1RM
// estimado, y sesiones. Equivale a EntrenamientoClient del portal web.

import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, SectionLabel } from '@/components/card';
import { Locked } from '@/features/training/locked';
import { fmtShort } from '@/lib/dates';
import { colors, fonts, space } from '@/theme';

import { est1RM, muscleLabel, useDeleteRoutine, useDeleteSession, useStrength, type Session } from './use-strength';

const nice = (n: number) => String(Math.round(n * 10) / 10);

type Point = { date: string; volume: number; topWeight: number; best1rm: number; sets: string };

function historyByExercise(sessions: Session[]) {
  const byEx = new Map<string, Point[]>();
  for (const s of [...sessions].reverse()) {
    const groups = new Map<string, { w: number; r: number }[]>();
    for (const x of s.sets) groups.set(x.exercise_id, [...(groups.get(x.exercise_id) ?? []), { w: x.weight_kg, r: x.reps }]);
    for (const [exId, sets] of groups) {
      byEx.set(exId, [
        ...(byEx.get(exId) ?? []),
        {
          date: s.session_date,
          volume: sets.reduce((a, x) => a + x.w * x.r, 0),
          topWeight: Math.max(...sets.map((x) => x.w)),
          best1rm: Math.max(...sets.map((x) => est1RM(x.w, x.r))),
          sets: sets.map((x) => `${nice(x.w)}×${x.r}`).join('  '),
        },
      ]);
    }
  }
  return byEx;
}

export function StrengthTab({ memberId, active }: { memberId: string; active: boolean }) {
  const router = useRouter();
  const strength = useStrength(memberId);
  const delSession = useDeleteSession(memberId);
  const delRoutine = useDeleteRoutine(memberId);

  if (strength.isPending) return <ActivityIndicator color={colors.accent} />;
  if (strength.isError) return <Text style={styles.dim}>No se pudo cargar tu registro.</Text>;
  const { exercises, sessions, routines } = strength.data;
  const ex = (id: string) => exercises.find((e) => e.id === id);
  const history = [...historyByExercise(sessions)].sort((a, b) => b[1][b[1].length - 1].date.localeCompare(a[1][a[1].length - 1].date));
  const totalVolume = sessions.reduce((a, s) => a + s.sets.reduce((b, x) => b + x.weight_kg * x.reps, 0), 0);

  return (
    <>
      {active ? (
        <Button label="Registrar sesión" onPress={() => router.push('/fuerza/sesion')} />
      ) : (
        <Locked what="Registrar entrenamientos" />
      )}

      {sessions.length > 0 && (
        <View style={styles.tiles}>
          <Card style={styles.tile}>
            <SectionLabel>Sesiones</SectionLabel>
            <Text style={styles.tileValue}>{sessions.length}</Text>
          </Card>
          <Card style={styles.tile}>
            <SectionLabel>Kg movidos</SectionLabel>
            <Text style={[styles.tileValue, { color: colors.accent }]}>{String(Math.round(totalVolume)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</Text>
          </Card>
        </View>
      )}

      <Card style={styles.gap}>
        <SectionLabel>Mis rutinas</SectionLabel>
        {routines.length === 0 && <Text style={styles.small}>Guarda tus entrenos repetidos como rutina para cargarlos de un toque.</Text>}
        {routines.map((r) => (
          <View key={r.id} style={styles.routine}>
            <View style={styles.flex}>
              <Text style={styles.name}>{r.name}</Text>
              <Text style={styles.small} numberOfLines={1}>
                {r.exercises.map((e) => ex(e.exercise_id)?.name ?? '').join(' · ')}
              </Text>
            </View>
            {active && (
              <Pressable onPress={() => router.push({ pathname: '/fuerza/sesion', params: { routine: r.id } })}>
                <Text style={styles.link}>Usar</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() =>
                Alert.alert('Borrar rutina', `¿Borrar "${r.name}"?`, [
                  { text: 'No', style: 'cancel' },
                  { text: 'Borrar', style: 'destructive', onPress: () => delRoutine.mutate(r.id) },
                ])
              }
              hitSlop={8}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        ))}
        {active && (
          <Pressable onPress={() => router.push('/fuerza/rutina')}>
            <Text style={styles.link}>+ Nueva rutina</Text>
          </Pressable>
        )}
      </Card>

      {history.map(([exId, points]) => {
        const last = points[points.length - 1];
        const prev = points.length > 1 ? points[points.length - 2] : null;
        const pct = prev && prev.volume > 0 ? ((last.volume - prev.volume) / prev.volume) * 100 : null;
        const prWeight = Math.max(...points.map((p) => p.topWeight));
        const pr1rm = Math.max(...points.map((p) => p.best1rm));
        const before = points.slice(0, -1);
        const lastIsPR =
          before.length > 0 &&
          (last.topWeight >= Math.max(...before.map((p) => p.topWeight)) || last.best1rm >= Math.max(...before.map((p) => p.best1rm)));
        const e = ex(exId);
        return (
          <Card key={exId} style={styles.gap}>
            <View style={styles.exHead}>
              <View style={styles.flex}>
                <Text style={styles.name}>
                  {e?.name ?? 'Ejercicio'} {lastIsPR ? <Text style={styles.star}>★</Text> : null}
                </Text>
                <Text style={styles.small}>
                  {e ? muscleLabel(e.muscle_group) : ''} · {points.length} sesión{points.length !== 1 ? 'es' : ''}
                </Text>
              </View>
              {pct != null && (
                <Text style={[styles.pct, { color: pct >= 0 ? '#34d399' : '#f87171' }]}>
                  {pct >= 0 ? '▲' : '▼'} {Math.abs(Math.round(pct))}%
                </Text>
              )}
            </View>
            <View style={styles.prs}>
              <View>
                <Text style={styles.prLabel}>Mejor peso</Text>
                <Text style={styles.prValue}>{nice(prWeight)} kg</Text>
              </View>
              <View>
                <Text style={styles.prLabel}>1RM estimado</Text>
                <Text style={styles.prValue}>{Math.round(pr1rm)} kg</Text>
              </View>
            </View>
            <Text style={styles.small}>
              Última ({fmtShort(last.date)}): {last.sets}
            </Text>
          </Card>
        );
      })}

      {sessions.length > 0 && (
        <Card style={styles.list}>
          <View style={styles.listHead}>
            <SectionLabel>Sesiones</SectionLabel>
          </View>
          {sessions.slice(0, 30).map((s) => (
            <Pressable
              key={s.id}
              onLongPress={() =>
                Alert.alert('Borrar sesión', `¿Borrar la sesión del ${fmtShort(s.session_date)}?`, [
                  { text: 'No', style: 'cancel' },
                  { text: 'Borrar', style: 'destructive', onPress: () => delSession.mutate(s.id) },
                ])
              }
              style={styles.sessionRow}>
              <Text style={styles.date}>{fmtShort(s.session_date)}</Text>
              <Text style={styles.small} numberOfLines={1}>
                {[...new Set(s.sets.map((x) => ex(x.exercise_id)?.name ?? ''))].join(' · ')}
              </Text>
            </Pressable>
          ))}
          <Text style={styles.hint}>Mantén presionada una sesión para borrarla.</Text>
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.sm },
  dim: { fontFamily: fonts.body, fontSize: 14, color: colors.fgDim },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute },
  tiles: { flexDirection: 'row', gap: space.md },
  tile: { flex: 1 },
  tileValue: { fontFamily: fonts.display, fontSize: 24, color: colors.fg, marginTop: space.xs },
  routine: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  name: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.fg },
  link: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.accent },
  remove: { fontSize: 14, color: colors.fgMute },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  star: { color: '#fcd34d' },
  pct: { fontFamily: fonts.bodySemi, fontSize: 13 },
  prs: { flexDirection: 'row', gap: space.xl },
  prLabel: { fontFamily: fonts.condSemi, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.fgMute },
  prValue: { fontFamily: fonts.display, fontSize: 18, color: '#fde68a' },
  list: { padding: 0 },
  listHead: { paddingHorizontal: space.lg, paddingTop: space.md },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  date: { width: 56, fontFamily: fonts.bodySemi, fontSize: 13, color: colors.fg },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute, paddingHorizontal: space.lg, paddingBottom: space.md },
});
