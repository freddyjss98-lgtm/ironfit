// Tarjeta "sin fondo" para Instagram (estilo Strava): sello Iron Fit, el WOD
// del día y, al lado de cada parte, lo que anotó el socio. El fondo es
// transparente: se captura como PNG y se pega encima de una foto.

import { Image } from 'expo-image';
import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

import { fmtTime } from './score';
import type { PartScore } from './wod-parts';

export type CardDesign = 'full' | 'min';

export type CardData = {
  dateLabel: string; // "JUE 15 OCT"
  parts: { label: string; score: PartScore | null }[];
  records: { name: string; kg: number }[];
  streak: number | null;
  rx: boolean | null;
};

// footer-brand.png mide 1077×817 (astas + IRON.FIT + "Confía en el proceso").
const SEAL_RATIO = 1077 / 817;

export function fmtPart(p: PartScore): string {
  switch (p.score_type) {
    case 'time':
      return p.time_seconds != null ? fmtTime(p.time_seconds) : '';
    case 'rounds':
      return `${p.rounds ?? 0}${p.reps ? ` + ${p.reps}` : ''}`;
    case 'load':
      return `${p.load_kg} kg`;
    case 'reps':
      return `${p.reps} reps`;
  }
}

export const ShareCard = forwardRef<View, { data: CardData; design: CardDesign }>(function ShareCard({ data, design }, ref) {
  const scored = data.parts.filter((p) => p.score);
  const main = scored[0]?.score ?? null;

  return (
    // collapsable={false}: en Android la vista debe existir de verdad para capturarla.
    <View ref={ref} collapsable={false} style={styles.card}>
      <Image
        source={require('@/assets/images/sello.png')}
        style={{ width: design === 'min' ? 130 : 150, height: (design === 'min' ? 130 : 150) / SEAL_RATIO }}
        contentFit="contain"
      />
      <Text style={styles.date}>WOD · {data.dateLabel}</Text>

      {design === 'min' ? (
        <View style={styles.minBody}>
          {main ? (
            <>
              <Text style={styles.bigScore}>{fmtPart(main)}</Text>
              <Text style={styles.minLabel} numberOfLines={2}>
                {scored[0].label}
              </Text>
            </>
          ) : (
            <Text style={styles.done}>WOD COMPLETADO ✓</Text>
          )}
        </View>
      ) : (
        <View style={styles.rows}>
          {data.parts.map((p, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.label} numberOfLines={2}>
                {p.label}
              </Text>
              {p.score && <Text style={styles.score}>{fmtPart(p.score)}</Text>}
            </View>
          ))}
          {data.records.map((r) => (
            <View key={r.name} style={styles.row}>
              <Text style={styles.label}>{r.name} · récord</Text>
              <Text style={styles.score}>{r.kg} kg ★</Text>
            </View>
          ))}
          {data.parts.length === 0 && data.records.length === 0 && <Text style={styles.done}>WOD COMPLETADO ✓</Text>}
        </View>
      )}

      <View style={styles.footer}>
        {data.rx != null && scored.length > 0 && <Text style={styles.tag}>{data.rx ? 'RX' : 'ESCALADO'}</Text>}
        {data.streak != null && data.streak > 0 && <Text style={styles.streak}>🔥 {data.streak} días de racha</Text>}
      </View>
    </View>
  );
});

const shadow = { textShadowColor: 'rgba(0,0,0,0.65)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 };

const styles = StyleSheet.create({
  card: { width: 340, paddingVertical: 20, paddingHorizontal: 18, alignItems: 'center', backgroundColor: 'transparent', gap: 10 },
  date: { ...shadow, fontFamily: fonts.cond, fontSize: 15, letterSpacing: 3, color: '#fff' },
  rows: { alignSelf: 'stretch', gap: 8, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { ...shadow, flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: '#fff' },
  score: { ...shadow, fontFamily: fonts.display, fontSize: 26, color: colors.accent },
  minBody: { alignItems: 'center', marginTop: 4 },
  bigScore: { ...shadow, fontFamily: fonts.display, fontSize: 72, lineHeight: 80, color: colors.accent },
  minLabel: { ...shadow, fontFamily: fonts.bodySemi, fontSize: 14, color: '#fff', textAlign: 'center' },
  done: { ...shadow, fontFamily: fonts.display, fontSize: 30, color: '#fff', textAlign: 'center', marginTop: 4 },
  footer: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 4 },
  tag: { ...shadow, fontFamily: fonts.cond, fontSize: 13, letterSpacing: 2, color: '#fff', borderWidth: 1, borderColor: '#fff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  streak: { ...shadow, fontFamily: fonts.bodySemi, fontSize: 14, color: '#fff' },
});
