import { todayInEcuador } from '@ironfit/shared/date';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { DateField } from '@/components/date-field';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { Body } from '@/components/text';
import { METRICS, useAddMeasurement, type MetricKey } from '@/features/body/use-body';
import { useAuth } from '@/lib/auth';
import { colors, fonts, radius, space } from '@/theme';

export default function RegisterMeasurementScreen() {
  const router = useRouter();
  const { member, session } = useAuth();
  const add = useAddMeasurement(member!.id, session!.user.id);
  const [date, setDate] = useState(todayInEcuador());
  const [values, setValues] = useState<Partial<Record<MetricKey, string>>>({});
  const [notes, setNotes] = useState('');

  function submit() {
    const parsed: Partial<Record<MetricKey, number>> = {};
    for (const m of METRICS) {
      const raw = values[m.key]?.replace(',', '.').trim();
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) parsed[m.key] = n;
      }
    }
    add.mutate({ values: parsed, notes: notes.trim() || null, date }, { onSuccess: () => router.back() });
  }

  return (
    <Screen>
      <Body dim>Llena solo lo que mediste. Con el peso basta para empezar.</Body>
      <DateField label="Fecha" value={date} onChange={setDate} maximumDate={new Date()} />
      <View style={styles.grid}>
        {METRICS.map((m) => (
          <View key={m.key} style={styles.field}>
            <Text style={styles.label}>
              {m.label} ({m.unit})
            </Text>
            <TextInput
              value={values[m.key] ?? ''}
              onChangeText={(t) => setValues((v) => ({ ...v, [m.key]: t.replace(/[^\d.,]/g, '') }))}
              keyboardType="decimal-pad"
              style={styles.input}
              selectionColor={colors.accent}
              accessibilityLabel={m.label}
            />
          </View>
        ))}
      </View>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Nota (opcional)"
        placeholderTextColor={colors.fgMute}
        style={[styles.input, styles.notes]}
      />
      {add.error && <Notice message={add.error.message} />}
      <Button label="Guardar medición" onPress={submit} loading={add.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  field: { flexBasis: '45%', flexGrow: 1, gap: space.xs },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.fgDim },
  input: {
    minHeight: 48,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.sm + 2,
    paddingHorizontal: space.md,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.fg,
  },
  notes: { fontFamily: fonts.body, fontSize: 14 },
});
