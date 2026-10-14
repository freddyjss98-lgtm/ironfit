// "Mi resultado" y la pizarra del día, debajo de la planificación en Entrenar.

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, SectionLabel } from '@/components/card';
import { colors, fonts, radius, space } from '@/theme';

import { compareScores, fmtScore, SCORE_LABELS, type ScoreType } from './score';
import { useBoard, useMyResult, type BoardRow } from './use-wod';

export function MyResultCard({ memberId, date }: { memberId: string; date: string }) {
  const router = useRouter();
  const mine = useMyResult(memberId, date);
  const open = () => router.push({ pathname: '/wod/registrar', params: { date } });

  if (mine.isPending) return <ActivityIndicator color={colors.accent} />;
  const r = mine.data;
  return (
    <Pressable onPress={open} accessibilityRole="button" style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      {r ? (
        <Card style={styles.mine}>
          <View style={styles.flex}>
            <SectionLabel>Mi resultado</SectionLabel>
            <Text style={styles.mineScore}>{fmtScore(r)}</Text>
            <Text style={styles.small}>
              {r.rx ? 'Rx' : 'Escalado'}
              {r.notes ? ` · ${r.notes}` : ''}
            </Text>
          </View>
          <Text style={styles.edit}>Editar</Text>
        </Card>
      ) : (
        <View style={styles.cta}>
          <Text style={styles.ctaTitle}>Registrar mi resultado</Text>
          <Text style={styles.ctaText}>Tiempo, rondas o kilos · aparece en la pizarra del box</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Board({ date }: { date: string }) {
  const board = useBoard(date, true);
  const [tab, setTab] = useState<ScoreType | null>(null);

  if (board.isPending) return <ActivityIndicator color={colors.accent} />;
  if (board.isError || !board.data.length) {
    return (
      <Card>
        <SectionLabel>Pizarra del box</SectionLabel>
        <Text style={[styles.small, styles.empty]}>
          {board.isError ? 'No se pudo cargar la pizarra.' : 'Nadie ha registrado todavía. ¡Sé el primero!'}
        </Text>
      </Card>
    );
  }

  // Un tiempo no se compara con rondas: una tabla por formato.
  const types = (['time', 'rounds', 'load', 'reps'] as ScoreType[]).filter((t) =>
    board.data.some((r) => r.score_type === t)
  );
  const counts = (t: ScoreType) => board.data.filter((r) => r.score_type === t).length;
  const active = tab && types.includes(tab) ? tab : types.reduce((a, b) => (counts(b) > counts(a) ? b : a));
  const rows: BoardRow[] = board.data.filter((r) => r.score_type === active).sort(compareScores);

  return (
    <Card style={styles.board}>
      <SectionLabel right={`${board.data.length} atleta${board.data.length !== 1 ? 's' : ''}`}>Pizarra del box</SectionLabel>
      {types.length > 1 && (
        <View style={styles.tabs}>
          {types.map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, t === active && styles.tabOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: t === active }}>
              <Text style={[styles.tabText, t === active && styles.tabTextOn]}>
                {SCORE_LABELS[t]} ({counts(t)})
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {rows.map((r, i) => (
        <View key={`${r.display_name}-${i}`} style={[styles.boardRow, r.is_me && styles.meRow]}>
          <Text style={[styles.rank, i < 3 && styles.podium]}>{i + 1}</Text>
          <Text style={[styles.name, r.is_me && styles.meName]} numberOfLines={1}>
            {r.display_name}
            {r.is_me ? ' (tú)' : ''}
          </Text>
          <Text style={[styles.tag, !r.rx && styles.tagScaled]}>{r.rx ? 'Rx' : 'Esc'}</Text>
          <Text style={styles.score}>{fmtScore(r)}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute, marginTop: 2 },
  empty: { marginTop: space.sm },
  mine: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderColor: 'rgba(232,75,31,0.35)' },
  mineScore: { fontFamily: fonts.display, fontSize: 28, color: colors.accent, marginTop: 2 },
  edit: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.fgDim },
  cta: { backgroundColor: colors.accent, borderRadius: radius.lg, padding: space.lg },
  ctaTitle: { fontFamily: fonts.display, fontSize: 20, color: '#fff', textTransform: 'uppercase' },
  ctaText: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  board: { gap: space.xs },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginVertical: space.sm },
  tab: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.line2 },
  tabOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.fgDim },
  tabTextOn: { color: '#fff' },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, paddingHorizontal: space.xs, borderRadius: radius.sm },
  meRow: { backgroundColor: 'rgba(232,75,31,0.10)' },
  rank: { width: 22, fontFamily: fonts.display, fontSize: 16, color: colors.fgMute, textAlign: 'center' },
  podium: { color: colors.accent },
  name: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.fg },
  meName: { fontFamily: fonts.bodySemi },
  tag: { fontFamily: fonts.cond, fontSize: 11, letterSpacing: 1, color: '#34d399' },
  tagScaled: { color: '#fbbf24' },
  score: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.fg, minWidth: 70, textAlign: 'right' },
});
