// Sub-pestaña "Récords": la mejor marca de cada levantamiento y acceso a la
// calculadora de % (pantalla /marca).

import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/card';
import { fmtShort } from '@/lib/dates';
import { colors, fonts, space } from '@/theme';

import { bestByLift, LIFTS, useLiftRecords } from './lifts';

export function RecordsTab({ memberId }: { memberId: string }) {
  const router = useRouter();
  const records = useLiftRecords(memberId);

  if (records.isPending) return <ActivityIndicator color={colors.accent} />;
  const best = bestByLift(records.data ?? []);

  return (
    <>
      <Text style={styles.intro}>Tus 1RM. Toca un levantamiento para registrar una marca o calcular tus porcentajes.</Text>
      <Card style={styles.list}>
        {LIFTS.map((l, i) => {
          const b = best.get(l.key);
          return (
            <Pressable
              key={l.key}
              onPress={() => router.push({ pathname: '/marca', params: { lift: l.key } })}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { opacity: 0.7 }]}>
              <View style={styles.flex}>
                <Text style={styles.name}>{l.name}</Text>
                {b && <Text style={styles.small}>{fmtShort(b.recorded_on)}</Text>}
              </View>
              <Text style={[styles.value, !b && styles.empty]}>{b ? `${b.weight_kg} kg` : 'Registrar'}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { fontFamily: fonts.body, fontSize: 14, color: colors.fgDim },
  list: { padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(36,36,36,0.6)' },
  name: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.fg },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute },
  value: { fontFamily: fonts.display, fontSize: 18, color: colors.accent },
  empty: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.fgMute },
  chevron: { fontSize: 22, color: colors.fgMute },
});
