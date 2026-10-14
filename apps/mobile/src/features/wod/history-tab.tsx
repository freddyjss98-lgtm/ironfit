// Sub-pestaña "WODs": mis resultados registrados.

import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/card';
import { fmtWeekdayLong } from '@/lib/dates';
import { colors, fonts, space } from '@/theme';

import { fmtScore, SCORE_LABELS } from './score';
import { useWodHistory } from './use-wod';

export function WodHistoryTab({ memberId }: { memberId: string }) {
  const router = useRouter();
  const history = useWodHistory(memberId);

  if (history.isPending) return <ActivityIndicator color={colors.accent} />;
  const rows = history.data ?? [];

  if (rows.length === 0) {
    return (
      <Card>
        <Text style={styles.empty}>
          Aún no registras ningún WOD. En la pestaña Entrenar, debajo de la planificación del día, toca “Registrar mi
          resultado”.
        </Text>
      </Card>
    );
  }

  return (
    <>
      <Text style={styles.intro}>{rows.length} WOD{rows.length !== 1 ? 's' : ''} registrados</Text>
      <Card style={styles.list}>
        {rows.map((r, i) => (
          <Pressable
            key={r.id}
            onPress={() => router.push({ pathname: '/wod/registrar', params: { date: r.workout_date } })}
            style={[styles.row, i > 0 && styles.rowBorder]}>
            <View style={styles.flex}>
              <Text style={styles.date}>{fmtWeekdayLong(r.workout_date)}</Text>
              <Text style={styles.small}>
                {SCORE_LABELS[r.score_type]} · {r.rx ? 'Rx' : 'Escalado'}
                {r.notes ? ` · ${r.notes}` : ''}
              </Text>
            </View>
            <Text style={styles.score}>{fmtScore(r)}</Text>
          </Pressable>
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { fontFamily: fonts.body, fontSize: 14, color: colors.fgDim },
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.fgDim },
  list: { padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(36,36,36,0.6)' },
  date: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.fg },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute, marginTop: 2 },
  score: { fontFamily: fonts.display, fontSize: 18, color: colors.accent },
});
