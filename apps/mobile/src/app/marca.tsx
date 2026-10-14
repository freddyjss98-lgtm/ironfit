import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, SectionLabel } from '@/components/card';
import { Screen } from '@/components/screen';
import { bestByLift, liftName, percentOf, useAddLift, useDeleteLift, useLiftRecords, type LiftKey } from '@/features/records/lifts';
import { Locked } from '@/features/training/locked';
import { useActiveMembership } from '@/features/training/use-active';
import { useAuth } from '@/lib/auth';
import { fmtShort } from '@/lib/dates';
import { colors, fonts, radius, space } from '@/theme';

const PERCENTS = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

export default function LiftScreen() {
  const { lift } = useLocalSearchParams<{ lift: LiftKey }>();
  const { member } = useAuth();
  const memberId = member!.id;
  const records = useLiftRecords(memberId);
  const active = useActiveMembership(memberId);
  const add = useAddLift(memberId);
  const del = useDeleteLift(memberId);
  const [weight, setWeight] = useState('');
  const [custom, setCustom] = useState('');

  const history = (records.data ?? []).filter((r) => r.lift === lift);
  const best = bestByLift(history).get(lift) ?? null;

  function save() {
    const w = Number(weight.replace(',', '.'));
    if (!Number.isFinite(w) || w <= 0) return Alert.alert('Peso inválido', 'Escribe los kilos de tu 1RM.');
    const isPR = !best || w > best.weight_kg;
    add.mutate(
      { lift, weight_kg: w, notes: null },
      {
        onSuccess: () => {
          setWeight('');
          if (isPR && best) Alert.alert('¡Nuevo récord! 🎉', `${liftName(lift)}: ${w} kg (antes ${best.weight_kg} kg).`);
        },
        onError: (e) => Alert.alert('No se pudo guardar', e.message),
      }
    );
  }

  function remove(id: string) {
    Alert.alert('Borrar marca', '¿Borrar este registro?', [
      { text: 'No', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => del.mutate(id) },
    ]);
  }

  const customPct = Number(custom.replace(',', '.'));

  return (
    <Screen>
      <Stack.Screen options={{ title: liftName(lift) }} />

      <Card style={styles.best}>
        <SectionLabel>Tu 1RM</SectionLabel>
        <Text style={styles.bestValue}>{best ? `${best.weight_kg} kg` : '—'}</Text>
        {best && <Text style={styles.small}>Desde el {fmtShort(best.recorded_on)}</Text>}
      </Card>

      {active.data === false ? (
        <Locked what="Registrar récords" />
      ) : (
        <View style={styles.addRow}>
          <TextInput
            value={weight}
            onChangeText={(t) => setWeight(t.replace(/[^\d.,]/g, ''))}
            placeholder="Nuevo 1RM (kg)"
            placeholderTextColor={colors.fgMute}
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <View style={styles.addBtn}>
            <Button label="Guardar" onPress={save} loading={add.isPending} />
          </View>
        </View>
      )}

      {best && (
        <Card style={styles.calc}>
          <SectionLabel>Calculadora de %</SectionLabel>
          <Text style={styles.small}>El WOD dice “70% de tu 1RM”: estos son tus kilos.</Text>
          <View style={styles.grid}>
            {PERCENTS.map((p) => (
              <View key={p} style={styles.cell}>
                <Text style={styles.pct}>{p}%</Text>
                <Text style={styles.kg}>{percentOf(best.weight_kg, p)} kg</Text>
              </View>
            ))}
          </View>
          <View style={styles.customRow}>
            <TextInput
              value={custom}
              onChangeText={(t) => setCustom(t.replace(/[^\d.,]/g, ''))}
              placeholder="Otro %"
              placeholderTextColor={colors.fgMute}
              keyboardType="decimal-pad"
              style={[styles.input, styles.customInput]}
            />
            <Text style={styles.customResult}>
              {customPct > 0 ? `= ${percentOf(best.weight_kg, customPct)} kg` : ''}
            </Text>
          </View>
        </Card>
      )}

      {history.length > 0 && (
        <Card style={styles.list}>
          {history.map((r, i) => (
            <Pressable key={r.id} onLongPress={() => remove(r.id)} style={[styles.row, i > 0 && styles.rowBorder]}>
              <Text style={styles.date}>{fmtShort(r.recorded_on)}</Text>
              <Text style={[styles.weight, r.id === best?.id && { color: colors.accent }]}>
                {r.weight_kg} kg{r.id === best?.id ? ' ★' : ''}
              </Text>
            </Pressable>
          ))}
          <Text style={[styles.small, styles.hint]}>Mantén presionado un registro para borrarlo.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute, marginTop: 2 },
  best: { alignItems: 'center' },
  bestValue: { fontFamily: fonts.display, fontSize: 48, color: colors.accent },
  addRow: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  addBtn: { width: 120 },
  input: {
    flex: 1,
    minHeight: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.sm + 2,
    paddingHorizontal: space.lg,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.fg,
  },
  calc: { gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  cell: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pct: { fontFamily: fonts.cond, fontSize: 12, letterSpacing: 1, color: colors.fgMute },
  kg: { fontFamily: fonts.display, fontSize: 18, color: colors.fg },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  customInput: { flex: 0, width: 110 },
  customResult: { fontFamily: fonts.display, fontSize: 22, color: colors.accent },
  list: { padding: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(36,36,36,0.6)' },
  date: { fontFamily: fonts.body, fontSize: 14, color: colors.fgDim },
  weight: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.fg },
  hint: { paddingHorizontal: space.lg, paddingBottom: space.md },
});
