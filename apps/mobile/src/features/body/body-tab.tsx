// Sub-pestaña "Cuerpo": última medición, gráfico de peso, meta e historial.

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, SectionLabel } from '@/components/card';
import { LineChart } from '@/components/line-chart';
import { Locked } from '@/features/training/locked';
import { fmtShort } from '@/lib/dates';
import { colors, fonts, radius, space } from '@/theme';

import { METRICS, useBody, useDeleteMeasurement, useSetGoal, type Measurement, type MetricKey } from './use-body';

const nice = (n: number) => String(Math.round(n * 10) / 10);

function Delta({ diff, goodDir }: { diff: number; goodDir: 'up' | 'down' }) {
  if (Math.abs(diff) < 0.05) return <Text style={styles.deltaFlat}>=</Text>;
  const good = goodDir === 'up' ? diff > 0 : diff < 0;
  return (
    <Text style={[styles.delta, { color: good ? '#34d399' : '#f87171' }]}>
      {diff > 0 ? '▲' : '▼'} {nice(Math.abs(diff))}
    </Text>
  );
}

export function BodyTab({ memberId, userId, active }: { memberId: string; userId: string; active: boolean }) {
  const router = useRouter();
  const body = useBody(memberId, userId);
  const del = useDeleteMeasurement(memberId);
  const goal = useSetGoal(memberId);
  const [goalInput, setGoalInput] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);

  if (body.isPending) return <ActivityIndicator color={colors.accent} />;
  if (body.isError) return <Text style={styles.dim}>No se pudieron cargar tus medidas.</Text>;
  const { rows, targetWeight } = body.data;
  const latest = rows[0] ?? null;
  // Diferencia de cada medida contra la medición anterior que la tenga.
  const prevOf = (key: MetricKey) => rows.slice(1).find((r) => r[key] != null)?.[key] ?? null;
  const weightPoints = rows
    .filter((r) => r.weight != null)
    .slice(0, 20)
    .reverse()
    .map((r) => ({ label: fmtShort(r.measured_at), value: r.weight! }));
  const currentWeight = rows.find((r) => r.weight != null)?.weight ?? null;

  function saveGoal() {
    const v = goalInput.trim() === '' ? null : Number(goalInput.replace(',', '.'));
    if (v != null && (!Number.isFinite(v) || v <= 0)) return Alert.alert('Meta inválida', 'Escribe tu peso meta en kg.');
    goal.mutate(v, { onSuccess: () => setEditingGoal(false), onError: (e) => Alert.alert('No se pudo guardar', e.message) });
  }

  function remove(m: Measurement) {
    if (!m.is_own) return Alert.alert('Medición del gimnasio', 'Esta medición la registró el gimnasio y no se puede borrar desde aquí.');
    Alert.alert('Borrar medición', `¿Borrar la medición del ${fmtShort(m.measured_at)}?`, [
      { text: 'No', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => del.mutate(m.id) },
    ]);
  }

  return (
    <>
      {active ? (
        <Button label="Registrar medición" onPress={() => router.push('/cuerpo/registrar')} />
      ) : (
        <Locked what="Registrar medidas" />
      )}

      {latest ? (
        <Card style={styles.gap}>
          <SectionLabel right={fmtShort(latest.measured_at)}>Última medición</SectionLabel>
          <View style={styles.metrics}>
            {METRICS.filter((m) => latest[m.key] != null).map((m) => {
              const prev = prevOf(m.key);
              return (
                <View key={m.key} style={styles.metric}>
                  <Text style={styles.metricLabel}>{m.label}</Text>
                  <Text style={styles.metricValue}>
                    {nice(latest[m.key]!)} <Text style={styles.unit}>{m.unit}</Text>
                  </Text>
                  {prev != null && <Delta diff={latest[m.key]! - prev} goodDir={m.goodDir} />}
                </View>
              );
            })}
          </View>
        </Card>
      ) : (
        <Card>
          <Text style={styles.dim}>
            Aún no tienes medidas. Registra tu peso hoy y vuelve en unas semanas para ver cómo cambias.
          </Text>
        </Card>
      )}

      <Card style={styles.gap}>
        <SectionLabel>Meta de peso</SectionLabel>
        {editingGoal ? (
          <View style={styles.goalRow}>
            <TextInput
              value={goalInput}
              onChangeText={(t) => setGoalInput(t.replace(/[^\d.,]/g, ''))}
              placeholder="kg (vacío para quitarla)"
              placeholderTextColor={colors.fgMute}
              keyboardType="decimal-pad"
              style={styles.input}
            />
            <Pressable onPress={saveGoal} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>{goal.isPending ? '…' : 'Guardar'}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.goalRow}>
            <Text style={styles.goalText}>
              {targetWeight != null
                ? currentWeight != null
                  ? `${targetWeight} kg · te ${currentWeight > targetWeight ? 'faltan' : 'sobran'} ${nice(Math.abs(currentWeight - targetWeight))} kg`
                  : `${targetWeight} kg`
                : 'Sin meta'}
            </Text>
            <Pressable
              onPress={() => {
                setGoalInput(targetWeight != null ? String(targetWeight) : '');
                setEditingGoal(true);
              }}>
              <Text style={styles.link}>{targetWeight != null ? 'Cambiar' : 'Poner meta'}</Text>
            </Pressable>
          </View>
        )}
      </Card>

      {weightPoints.length >= 2 && (
        <Card style={styles.gap}>
          <SectionLabel>Peso en el tiempo</SectionLabel>
          <LineChart points={weightPoints} target={targetWeight} />
        </Card>
      )}

      {rows.length > 0 && (
        <Card style={styles.list}>
          {rows.map((r, i) => (
            <Pressable key={r.id} onLongPress={() => remove(r)} style={[styles.row, i > 0 && styles.rowBorder]}>
              <Text style={styles.date}>{fmtShort(r.measured_at)}</Text>
              <Text style={styles.rowText} numberOfLines={1}>
                {METRICS.filter((m) => r[m.key] != null)
                  .map((m) => `${m.label} ${nice(r[m.key]!)}`)
                  .join(' · ')}
              </Text>
            </Pressable>
          ))}
          <Text style={styles.hint}>Mantén presionada una medición para borrarla.</Text>
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.sm },
  dim: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.fgDim },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  metric: { flexBasis: '45%', flexGrow: 1 },
  metricLabel: { fontFamily: fonts.condSemi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.fgMute },
  metricValue: { fontFamily: fonts.display, fontSize: 24, color: colors.fg },
  unit: { fontFamily: fonts.body, fontSize: 13, color: colors.fgMute },
  delta: { fontFamily: fonts.bodySemi, fontSize: 12 },
  deltaFlat: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.fgMute },
  goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  goalText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.fg },
  link: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.accent },
  input: {
    flex: 1,
    minHeight: 44,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.sm + 2,
    paddingHorizontal: space.md,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.fg,
  },
  smallBtn: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  smallBtnText: { fontFamily: fonts.bodySemi, fontSize: 14, color: '#fff' },
  list: { padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(36,36,36,0.6)' },
  date: { width: 56, fontFamily: fonts.bodySemi, fontSize: 13, color: colors.fg },
  rowText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.fgDim },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute, paddingHorizontal: space.lg, paddingBottom: space.md },
});
