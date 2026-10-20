// Tarjeta "sin fondo" para Instagram (estilo Strava): sello Iron Fit y el WOD
// del día completo — cada sección con sus ejercicios y, al lado del título,
// lo que anotó el socio. El fondo es transparente: se captura como PNG y se
// pega encima de una foto.

import { Image } from 'expo-image';
import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

import { fmtTime } from './score';
import type { PartScore } from './wod-parts';

export type CardDesign = 'full' | 'min';

export type CardSection = { title: string; lines: string[]; score: PartScore | null };

export type CardData = {
  dateLabel: string; // "JUE 15 OCT"
  sections: CardSection[];
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

/** Tamaño del texto según cuánto WOD hay: siempre tiene que caber en una historia. */
function sizes(totalLines: number) {
  if (totalLines > 30) return { line: 10, lh: 13, title: 13, score: 20, seal: 110 };
  if (totalLines > 20) return { line: 11.5, lh: 15, title: 14, score: 22, seal: 125 };
  return { line: 13, lh: 17, title: 15, score: 26, seal: 150 };
}

export const ShareCard = forwardRef<View, { data: CardData; design: CardDesign }>(function ShareCard({ data, design }, ref) {
  const scored = data.sections.filter((s) => s.score);
  const main = scored[0]?.score ?? null;
  const total = data.sections.reduce((n, s) => n + s.lines.length + 1, 0) + data.records.length;
  const z = sizes(total);
  const sealW = design === 'min' ? 130 : z.seal;

  return (
    // collapsable={false}: en Android la vista debe existir de verdad para capturarla.
    <View ref={ref} collapsable={false} style={styles.card}>
      <Image source={require('@/assets/images/sello.png')} style={{ width: sealW, height: sealW / SEAL_RATIO }} contentFit="contain" />
      <Text style={styles.date}>WOD · {data.dateLabel}</Text>

      {design === 'min' ? (
        <View style={styles.minBody}>
          {main ? (
            <>
              <Text style={styles.bigScore}>{fmtPart(main)}</Text>
              <Text style={styles.minLabel} numberOfLines={2}>
                {scored[0].title}
              </Text>
            </>
          ) : (
            <Text style={styles.done}>WOD COMPLETADO ✓</Text>
          )}
        </View>
      ) : (
        <View style={styles.sections}>
          {data.sections.map((s, i) => (
            <View key={i} style={styles.section}>
              {(s.title || s.score) && (
                <View style={styles.titleRow}>
                  <Text style={[styles.title, { fontSize: z.title }]} numberOfLines={2}>
                    {s.title}
                  </Text>
                  {s.score && <Text style={[styles.score, { fontSize: z.score }]}>{fmtPart(s.score)}</Text>}
                </View>
              )}
              {s.lines.map((l, j) => (
                <Text key={j} style={[styles.line, { fontSize: z.line, lineHeight: z.lh }]}>
                  {l}
                </Text>
              ))}
            </View>
          ))}
          {data.records.map((r) => (
            <View key={r.name} style={styles.titleRow}>
              <Text style={[styles.title, { fontSize: z.title }]}>{r.name} · récord</Text>
              <Text style={[styles.score, { fontSize: z.score }]}>{r.kg} kg ★</Text>
            </View>
          ))}
          {data.sections.length === 0 && data.records.length === 0 && <Text style={styles.done}>WOD COMPLETADO ✓</Text>}
        </View>
      )}

      <View style={styles.footer}>
        {data.rx != null && scored.length > 0 && <Text style={styles.tag}>{data.rx ? 'RX' : 'ESCALADO'}</Text>}
        {data.streak != null && data.streak > 0 && <Text style={styles.streak}>🔥 {data.streak} días de racha</Text>}
      </View>
    </View>
  );
});

const shadow = { textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 };

const styles = StyleSheet.create({
  card: { width: 340, paddingVertical: 18, paddingHorizontal: 18, alignItems: 'center', backgroundColor: 'transparent', gap: 8 },
  date: { ...shadow, fontFamily: fonts.cond, fontSize: 15, letterSpacing: 3, color: '#fff' },
  sections: { alignSelf: 'stretch', gap: 10, marginTop: 4 },
  section: { gap: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  title: { ...shadow, flex: 1, fontFamily: fonts.cond, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.accent },
  score: { ...shadow, fontFamily: fonts.display, color: '#fff' },
  line: { ...shadow, fontFamily: fonts.bodyMedium, color: '#fff' },
  minBody: { alignItems: 'center', marginTop: 4 },
  bigScore: { ...shadow, fontFamily: fonts.display, fontSize: 72, lineHeight: 80, color: colors.accent },
  minLabel: { ...shadow, fontFamily: fonts.bodySemi, fontSize: 14, color: '#fff', textAlign: 'center' },
  done: { ...shadow, fontFamily: fonts.display, fontSize: 30, color: '#fff', textAlign: 'center', marginTop: 4 },
  footer: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 4 },
  tag: { ...shadow, fontFamily: fonts.cond, fontSize: 13, letterSpacing: 2, color: '#fff', borderWidth: 1, borderColor: '#fff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  streak: { ...shadow, fontFamily: fonts.bodySemi, fontSize: 14, color: '#fff' },
});
